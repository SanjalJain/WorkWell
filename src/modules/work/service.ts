import { rawPrisma } from "@/lib/db";
import { withTenant } from "@/lib/tenant";
import { SessionUser } from "@/lib/auth";
import { canManageProject, canLogTime, canEditTimeEntry } from "./policies";
import {
  CreateClientInput,
  CreateProjectInput,
  AddProjectMemberInput,
  CreateTaskInput,
  MoveTaskInput,
  LogTimeInput,
  ProjectDTO,
  TaskDTO,
  TimeEntryDTO,
  WeeklyTimesheetDTO,
  WeeklyTimesheetRowDTO,
  WeeklyTimesheetDayDTO,
} from "./schema";
import { logAudit } from "@/lib/audit";
import { Prisma, Role, ProjectStatus, TaskStatus } from "@prisma/client";
import { syncProjectKeyResults } from "@/modules/shared/service";

// ==========================================
// 1. CLIENT SERVICES
// ==========================================

export async function createClient(input: CreateClientInput, user: SessionUser) {
  if (user.role !== Role.OWNER && user.role !== Role.HR) {
    throw new Error("Unauthorized to create clients");
  }

  return withTenant(user.organizationId, async (tx) => {
    const existing = await tx.client.findFirst({
      where: { organizationId: user.organizationId, name: input.name },
    });
    if (existing) {
      throw new Error(`A client with name "${input.name}" already exists`);
    }

    const client = await tx.client.create({
      data: {
        organizationId: user.organizationId,
        name: input.name,
        email: input.email ?? null,
        billingAddress: input.billingAddress ?? null,
      },
    });

    await logAudit(
      {
        organizationId: user.organizationId,
        userId: user.userId,
        action: "CREATE_CLIENT",
        entity: "Client",
        entityId: client.id,
      },
      tx
    );

    return client;
  });
}

export async function listClients(user: SessionUser) {
  return rawPrisma.client.findMany({
    where: { organizationId: user.organizationId },
    orderBy: { name: "asc" },
  });
}

// ==========================================
// 2. PROJECT SERVICES
// ==========================================

export async function createProject(input: CreateProjectInput, user: SessionUser) {
  if (!canManageProject(user)) {
    throw new Error("Unauthorized to create projects");
  }

  // Validate client belongs to the user's organization
  const client = await rawPrisma.client.findFirst({
    where: { id: input.clientId, organizationId: user.organizationId },
  });
  if (!client) {
    throw new Error("Specified client does not belong to your organization");
  }

  // If lead is specified, validate lead belongs to organization
  if (input.leadId) {
    const lead = await rawPrisma.employee.findFirst({
      where: { id: input.leadId, organizationId: user.organizationId },
    });
    if (!lead) {
      throw new Error("Specified project lead does not belong to your organization");
    }
  }

  return withTenant(user.organizationId, async (tx) => {
    const project = await tx.project.create({
      data: {
        organizationId: user.organizationId,
        clientId: input.clientId,
        leadId: input.leadId ?? null,
        name: input.name,
        type: input.type,
        status: ProjectStatus.PLANNING,
        budget: new Prisma.Decimal(input.budget),
      },
    });

    // Automatically add lead as project member if set
    if (input.leadId) {
      await tx.projectMember.create({
        data: {
          projectId: project.id,
          employeeId: input.leadId,
          role: "Lead",
          allocationPct: 100,
        },
      });
    }

    await logAudit(
      {
        organizationId: user.organizationId,
        userId: user.userId,
        action: "CREATE_PROJECT",
        entity: "Project",
        entityId: project.id,
        metadata: { name: input.name, type: input.type, budget: input.budget },
      },
      tx
    );

    return project;
  });
}

export async function updateProjectStatus(
  projectId: string,
  status: ProjectStatus,
  user: SessionUser
) {
  if (!canManageProject(user)) {
    throw new Error("Unauthorized to update project status");
  }

  const project = await rawPrisma.project.findFirst({
    where: { id: projectId, organizationId: user.organizationId },
  });
  if (!project) throw new Error("Project not found");

  return withTenant(user.organizationId, async (tx) => {
    const updated = await tx.project.update({
      where: { id: projectId },
      data: { status },
    });

    await logAudit(
      {
        organizationId: user.organizationId,
        userId: user.userId,
        action: `PROJECT_STATUS_${status}`,
        entity: "Project",
        entityId: projectId,
        metadata: { from: project.status, to: status },
      },
      tx
    );

    return updated;
  });
}

export async function listProjects(user: SessionUser): Promise<ProjectDTO[]> {
  const isClient = user.role === Role.CLIENT;

  const where: Prisma.ProjectWhereInput = {
    organizationId: user.organizationId,
    ...(isClient && user.clientId ? { clientId: user.clientId } : {}),
  };

  const projects = await rawPrisma.project.findMany({
    where,
    include: {
      client: { select: { id: true, name: true } },
      lead: { select: { id: true, firstName: true, lastName: true } },
      members: { select: { id: true } },
      tasks: { select: { id: true } },
      timeEntries: { select: { hours: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return projects.map((p) => {
    const totalHours = p.timeEntries.reduce((sum, te) => sum + Number(te.hours), 0);

    return {
      id: p.id,
      name: p.name,
      clientId: p.clientId,
      clientName: p.client.name,
      leadId: p.leadId,
      leadName: p.lead ? `${p.lead.firstName} ${p.lead.lastName}` : null,
      type: p.type,
      status: p.status,
      budget: Number(p.budget).toFixed(2),
      totalLoggedHours: totalHours.toFixed(1),
      memberCount: p.members.length,
      taskCount: p.tasks.length,
      createdAt: p.createdAt.toISOString().split("T")[0],
    };
  });
}

export async function getProjectDetails(projectId: string, user: SessionUser) {
  const isClient = user.role === Role.CLIENT;

  const [project, hoursAgg] = await Promise.all([
    rawPrisma.project.findFirst({
      where: {
        id: projectId,
        organizationId: user.organizationId,
        ...(isClient && user.clientId ? { clientId: user.clientId } : {}),
      },
      include: {
        client: true,
        lead: true,
        members: {
          include: {
            employee: {
              select: { id: true, firstName: true, lastName: true, jobTitle: true },
            },
          },
        },
        tasks: {
          include: {
            assignee: {
              select: { id: true, firstName: true, lastName: true, jobTitle: true },
            },
          },
          orderBy: [{ status: "asc" }, { position: "asc" }],
        },
        timeEntries: {
          take: 10,
          orderBy: { date: "desc" },
          include: {
            employee: { select: { firstName: true, lastName: true } },
          },
        },
      },
    }),
    rawPrisma.timeEntry.aggregate({
      where: {
        projectId,
        organizationId: user.organizationId,
      },
      _sum: { hours: true },
    }),
  ]);

  if (!project) return null;

  const totalLoggedHours = Number(hoursAgg._sum.hours ?? 0);

  return {
    ...project,
    budget: Number(project.budget).toFixed(2),
    totalLoggedHours: totalLoggedHours.toFixed(1),
  };
}

export async function addProjectMember(input: AddProjectMemberInput, user: SessionUser) {
  if (!canManageProject(user)) {
    throw new Error("Unauthorized to add project members");
  }

  // Validate employee belongs to organization
  const employee = await rawPrisma.employee.findFirst({
    where: { id: input.employeeId, organizationId: user.organizationId },
  });
  if (!employee) {
    throw new Error("Target employee does not belong to your organization");
  }

  return withTenant(user.organizationId, async (tx) => {
    return tx.projectMember.upsert({
      where: {
        projectId_employeeId: {
          projectId: input.projectId,
          employeeId: input.employeeId,
        },
      },
      create: {
        projectId: input.projectId,
        employeeId: input.employeeId,
        allocationPct: input.allocationPct,
        role: input.role,
      },
      update: {
        allocationPct: input.allocationPct,
        role: input.role,
      },
    });
  });
}

// ==========================================
// 3. KANBAN TASK SERVICES
// ==========================================

export async function createTask(input: CreateTaskInput, user: SessionUser) {
  // Validate project belongs to organization
  const project = await rawPrisma.project.findFirst({
    where: { id: input.projectId, organizationId: user.organizationId },
  });
  if (!project) throw new Error("Project not found in organization");

  if (input.assigneeId) {
    const assignee = await rawPrisma.employee.findFirst({
      where: { id: input.assigneeId, organizationId: user.organizationId },
    });
    if (!assignee) throw new Error("Assignee not found in organization");
  }

  // Find max position in this status to place card at bottom
  const lastTask = await rawPrisma.task.findFirst({
    where: { projectId: input.projectId, status: input.status },
    orderBy: { position: "desc" },
    select: { position: true },
  });

  const nextPosition = (lastTask?.position ?? 0) + 1.0;

  return withTenant(user.organizationId, async (tx) => {
    const task = await tx.task.create({
      data: {
        organizationId: user.organizationId,
        projectId: input.projectId,
        title: input.title,
        description: input.description ?? null,
        status: input.status,
        assigneeId: input.assigneeId ?? null,
        estimateHours: new Prisma.Decimal(input.estimateHours),
        position: nextPosition,
      },
      include: {
        assignee: { select: { id: true, firstName: true, lastName: true, jobTitle: true } },
      },
    });

    await logAudit(
      {
        organizationId: user.organizationId,
        userId: user.userId,
        action: "CREATE_TASK",
        entity: "Task",
        entityId: task.id,
        metadata: { title: input.title, projectId: input.projectId },
      },
      tx
    );

    return task;
  });
}

/**
 * Moves a task to a new status and fractional position.
 */
export async function moveTask(input: MoveTaskInput, user: SessionUser) {
  if (user.role === Role.CLIENT) {
    throw new Error("Clients are not permitted to update task status");
  }

  const task = await rawPrisma.task.findFirst({
    where: { id: input.taskId, organizationId: user.organizationId },
  });
  if (!task) throw new Error("Task not found");

  const updatedTask = await withTenant(user.organizationId, async (tx) => {
    return tx.task.update({
      where: { id: input.taskId },
      data: {
        status: input.status,
        position: input.position,
      },
    });
  });

  // Automatically sync linked project OKRs
  await syncProjectKeyResults(task.projectId, user.organizationId);

  return updatedTask;
}

// ==========================================
// 4. TIME TRACKING SERVICES
// ==========================================

export async function logTime(input: LogTimeInput, user: SessionUser) {
  if (!user.employeeId) {
    throw new Error("Only employees can log project hours");
  }

  const project = await rawPrisma.project.findFirst({
    where: { id: input.projectId, organizationId: user.organizationId },
    include: { members: true },
  });

  if (!project) throw new Error("Project not found");

  if (!canLogTime(user, project)) {
    throw new Error("Cannot log time on a completed or archived project");
  }

  // Check project membership (Owner & Manager can log without strict membership, employees must be assigned)
  const isMember = project.members.some((m) => m.employeeId === user.employeeId);
  const isPrivileged = user.role === Role.OWNER || user.role === Role.MANAGER;

  if (!isMember && !isPrivileged) {
    throw new Error("You must be an assigned member of this project to log time");
  }

  const logDate = new Date(input.date);

  return withTenant(user.organizationId, async (tx) => {
    // Daily hour cap check inside transaction to prevent race conditions
    const existingEntriesToday = await tx.timeEntry.findMany({
      where: {
        employeeId: user.employeeId!,
        date: logDate,
      },
      select: { hours: true },
    });

    const loggedHoursToday = existingEntriesToday.reduce((sum, e) => sum + Number(e.hours), 0);
    if (loggedHoursToday + input.hours > 24) {
      throw new Error(
        `Daily limit exceeded. You already logged ${loggedHoursToday} hours for this date. Maximum allowed is 24 hours.`
      );
    }

    const entry = await tx.timeEntry.create({
      data: {
        organizationId: user.organizationId,
        projectId: input.projectId,
        employeeId: user.employeeId!,
        date: logDate,
        hours: new Prisma.Decimal(input.hours),
        billable: input.billable,
        description: input.description ?? null,
      },
    });

    await logAudit(
      {
        organizationId: user.organizationId,
        userId: user.userId,
        action: "LOG_TIME",
        entity: "TimeEntry",
        entityId: entry.id,
        metadata: { hours: input.hours, date: input.date, projectId: input.projectId },
      },
      tx
    );

    return entry;
  });
}

export async function deleteTimeEntry(entryId: string, user: SessionUser) {
  const entry = await rawPrisma.timeEntry.findUnique({
    where: { id: entryId },
  });

  if (!entry || entry.organizationId !== user.organizationId) {
    throw new Error("Time entry not found");
  }

  const editCheck = canEditTimeEntry(user, entry);
  if (!editCheck.allowed) {
    throw new Error(editCheck.reason || "Unauthorized to delete this time entry");
  }

  return withTenant(user.organizationId, async (tx) => {
    await tx.timeEntry.delete({ where: { id: entryId } });
    return { success: true };
  });
}

/**
 * Computes weekly timesheet grid data for a given employee and Monday start date.
 */
export async function getWeeklyTimesheet(
  employeeId: string,
  weekStartDateStr: string,
  user: SessionUser
): Promise<WeeklyTimesheetDTO> {
  const targetEmployee = await rawPrisma.employee.findUnique({
    where: { id: employeeId },
    select: { organizationId: true, managerId: true },
  });

  if (!targetEmployee || targetEmployee.organizationId !== user.organizationId) {
    throw new Error("Employee not found in organization");
  }

  const isSelf = user.employeeId === employeeId;
  const isManager = user.role === Role.MANAGER && targetEmployee.managerId === user.employeeId;
  const isPrivileged = user.role === Role.OWNER || user.role === Role.HR;

  if (!isSelf && !isManager && !isPrivileged) {
    throw new Error("Unauthorized to view this employee's timesheet");
  }

  const weekStart = new Date(weekStartDateStr);
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

  const dates: { dateStr: string; dayName: string }[] = [];
  const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setUTCDate(d.getUTCDate() + i);
    dates.push({
      dateStr: d.toISOString().split("T")[0],
      dayName: dayNames[i],
    });
  }

  const entries = await rawPrisma.timeEntry.findMany({
    where: {
      employeeId,
      date: { gte: weekStart, lte: weekEnd },
      organizationId: user.organizationId,
    },
    include: {
      project: {
        include: { client: { select: { name: true } } },
      },
    },
  });

  // Group by project
  const projectMap = new Map<
    string,
    { projectName: string; clientName: string; dailyHours: { [date: string]: number } }
  >();

  entries.forEach((e) => {
    const dateStr = e.date.toISOString().split("T")[0];
    const hours = Number(e.hours);

    if (!projectMap.has(e.projectId)) {
      projectMap.set(e.projectId, {
        projectName: e.project.name,
        clientName: e.project.client.name,
        dailyHours: {},
      });
    }

    const row = projectMap.get(e.projectId)!;
    row.dailyHours[dateStr] = (row.dailyHours[dateStr] ?? 0) + hours;
  });

  const rows: WeeklyTimesheetRowDTO[] = Array.from(projectMap.entries()).map(([projectId, data]) => {
    const totalProjectHours = Object.values(data.dailyHours).reduce((sum, h) => sum + h, 0);
    return {
      projectId,
      projectName: data.projectName,
      clientName: data.clientName,
      dailyHours: data.dailyHours,
      totalProjectHours,
    };
  });

  // Calculate daily column totals
  const days: WeeklyTimesheetDayDTO[] = dates.map(({ dateStr, dayName }) => {
    const dayEntries = entries.filter((e) => e.date.toISOString().split("T")[0] === dateStr);
    const totalHours = dayEntries.reduce((sum, e) => sum + Number(e.hours), 0);
    const billableHours = dayEntries
      .filter((e) => e.billable)
      .reduce((sum, e) => sum + Number(e.hours), 0);

    return {
      date: dateStr,
      dayName,
      totalHours,
      billableHours,
    };
  });

  const totalWeekHours = entries.reduce((sum, e) => sum + Number(e.hours), 0);
  const totalBillableHours = entries
    .filter((e) => e.billable)
    .reduce((sum, e) => sum + Number(e.hours), 0);

  return {
    employeeId,
    weekStartDate: dates[0].dateStr,
    weekEndDate: dates[6].dateStr,
    rows,
    days,
    totalWeekHours,
    totalBillableHours,
  };
}

export async function listRecentTimeEntries(user: SessionUser): Promise<TimeEntryDTO[]> {
  const isHRorOwner = user.role === Role.OWNER || user.role === Role.HR;

  let employeeFilter: Prisma.TimeEntryWhereInput = {};
  if (user.role === Role.MANAGER && user.employeeId) {
    const directReports = await rawPrisma.employee.findMany({
      where: { managerId: user.employeeId, organizationId: user.organizationId },
      select: { id: true },
    });
    const allowedIds = [user.employeeId, ...directReports.map((r) => r.id)];
    employeeFilter = { employeeId: { in: allowedIds } };
  } else if (!isHRorOwner && user.employeeId) {
    employeeFilter = { employeeId: user.employeeId };
  }

  const entries = await rawPrisma.timeEntry.findMany({
    where: {
      organizationId: user.organizationId,
      ...employeeFilter,
    },
    include: {
      project: { select: { name: true } },
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: { date: "desc" },
    take: 25,
  });

  return entries.map((e) => ({
    id: e.id,
    projectId: e.projectId,
    projectName: e.project.name,
    employeeId: e.employeeId,
    employeeName: `${e.employee.firstName} ${e.employee.lastName}`,
    date: e.date.toISOString().split("T")[0],
    hours: Number(e.hours).toFixed(2),
    billable: e.billable,
    description: e.description,
    isLocked: !!e.invoiceLineItemId,
    createdAt: e.createdAt.toISOString().split("T")[0],
  }));
}
