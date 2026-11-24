import { rawPrisma } from "@/lib/db";
import { withTenant } from "@/lib/tenant";
import { SessionUser } from "@/lib/auth";
import { canViewCompensation } from "@/modules/people/policies";
import { Prisma, Role, LeaveStatus, TaskStatus, InvoiceStatus, FeedbackType } from "@prisma/client";

// ==========================================
// 1. WORKLOAD & CAPACITY (Cross-Module)
// ==========================================

export interface EmployeeWorkloadDTO {
  employeeId: string;
  employeeName: string;
  jobTitle: string;
  departmentName?: string | null;
  totalCapacityHours: number;
  approvedLeaveHours: number;
  netAvailableHours: number;
  allocatedTaskHours: number;
  allocationPctTotal: number;
  utilizationRatePct: number;
  isOverallocated: boolean;
}

/**
 * Computes workload and net capacity across People and Work:
 * Net Capacity = (Working Days × 8 hrs) - (Approved Leave Days × 8 hrs) - (Public Holidays × 8 hrs)
 * Allocated Work = Sum of active project allocations and pending task estimates.
 */
export async function getTeamWorkload(
  organizationId: string,
  startDateStr: string,
  endDateStr: string,
  user: SessionUser
): Promise<EmployeeWorkloadDTO[]> {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  const [employees, holidays, leaveRequests, members, tasks] = await Promise.all([
    rawPrisma.employee.findMany({
      where: { organizationId, status: "ACTIVE" },
      include: { department: { select: { name: true } } },
      orderBy: { lastName: "asc" },
    }),
    rawPrisma.publicHoliday.findMany({
      where: { organizationId, date: { gte: start, lte: end } },
    }),
    rawPrisma.leaveRequest.findMany({
      where: {
        employee: { organizationId },
        status: LeaveStatus.APPROVED,
        startDate: { lte: end },
        endDate: { gte: start },
      },
    }),
    rawPrisma.projectMember.findMany({
      where: { project: { organizationId, status: "ACTIVE" } },
    }),
    rawPrisma.task.findMany({
      where: {
        organizationId,
        status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
        assigneeId: { not: null },
      },
      select: { assigneeId: true, estimateHours: true },
    }),
  ]);

  // Compute total working days in range (excluding weekends and holidays)
  let totalWorkDays = 0;
  const holidayDateSet = new Set(holidays.map((h) => h.date.toISOString().split("T")[0]));
  const cur = new Date(start);

  while (cur <= end) {
    const dayOfWeek = cur.getUTCDay();
    const dateStr = cur.toISOString().split("T")[0];
    if (dayOfWeek !== 0 && dayOfWeek !== 6 && !holidayDateSet.has(dateStr)) {
      totalWorkDays++;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  const grossCapacityHours = totalWorkDays * 8;

  return employees.map((emp) => {
    // Approved leave hours falling strictly within this period
    const empLeave = leaveRequests.filter((l) => l.employeeId === emp.id);
    let overlappingLeaveDays = 0;
    for (const l of empLeave) {
      const clampStart = l.startDate < start ? start : l.startDate;
      const clampEnd = l.endDate > end ? end : l.endDate;
      const lCur = new Date(clampStart);
      while (lCur <= clampEnd) {
        const dow = lCur.getUTCDay();
        const dStr = lCur.toISOString().split("T")[0];
        if (dow !== 0 && dow !== 6 && !holidayDateSet.has(dStr)) {
          const isHalf =
            Number(l.daysCount) % 1 !== 0 &&
            l.startDate.toISOString().split("T")[0] === l.endDate.toISOString().split("T")[0];
          overlappingLeaveDays += isHalf ? 0.5 : 1;
        }
        lCur.setUTCDate(lCur.getUTCDate() + 1);
      }
    }
    const approvedLeaveHours = overlappingLeaveDays * 8;

    const netAvailableHours = Math.max(0, grossCapacityHours - approvedLeaveHours);

    // Project allocation percentages
    const empMemberships = members.filter((m) => m.employeeId === emp.id);
    const allocationPctTotal = empMemberships.reduce((sum, m) => sum + m.allocationPct, 0);

    // Active estimated task hours assigned to this person
    const empTasks = tasks.filter((t) => t.assigneeId === emp.id);
    const allocatedTaskHours = empTasks.reduce((sum, t) => sum + Number(t.estimateHours), 0);

    const utilizationRatePct =
      netAvailableHours > 0
        ? Math.round((allocatedTaskHours / netAvailableHours) * 100)
        : 0;

    return {
      employeeId: emp.id,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      jobTitle: emp.jobTitle,
      departmentName: emp.department?.name,
      totalCapacityHours: grossCapacityHours,
      approvedLeaveHours,
      netAvailableHours,
      allocatedTaskHours,
      allocationPctTotal,
      utilizationRatePct,
      isOverallocated: allocationPctTotal > 100 || allocatedTaskHours > netAvailableHours,
    };
  });
}

// ==========================================
// 2. PROJECT PROFITABILITY (Role-Guarded)
// ==========================================

export interface ProjectProfitabilityDTO {
  projectId: string;
  projectName: string;
  clientName: string;
  totalBilledRevenue: number;
  totalTrackedHours: number;
  totalBillableHours: number;
  // STRICT: Cost and margin are only visible if canViewCompensation is true!
  totalLaborCost: number | null;
  grossMarginAmount: number | null;
  grossMarginPct: number | null;
  canViewFinancials: boolean;
}

/**
 * Computes project profitability:
 * Revenue = Sum of invoice line items for this project.
 * Labor Cost = Sum of (time_entry.hours × compensation.hourlyCost effective on entry date).
 * Strictly strips labor cost and profit margin for callers who do not have compensation access!
 */
export async function getProjectProfitability(
  projectId: string,
  user: SessionUser
): Promise<ProjectProfitabilityDTO | null> {
  const project = await rawPrisma.project.findFirst({
    where: { id: projectId, organizationId: user.organizationId },
    include: {
      client: { select: { name: true } },
      timeEntries: {
        include: {
          employee: {
            include: {
              compensations: {
                orderBy: { effectiveFrom: "desc" },
              },
            },
          },
        },
      },
    },
  });

  if (!project) return null;

  const invoices = await rawPrisma.invoice.findMany({
    where: {
      organizationId: user.organizationId,
      clientId: project.clientId,
      status: { in: [InvoiceStatus.SENT, InvoiceStatus.PAID] },
    },
    include: {
      lineItems: {
        include: {
          timeEntries: {
            where: { projectId: project.id },
            select: { id: true },
          },
        },
      },
    },
  });

  // Calculate total billed revenue from invoices for this project
  const totalBilledRevenue = invoices.reduce((sum, inv) => {
    const projectLines = inv.lineItems.filter((l) => {
      if (l.timeEntries.length > 0) return true;
      return l.description.includes(`(${project.name})`) || l.description.endsWith(`: ${project.name}`);
    });
    return sum + projectLines.reduce((lineSum, l) => lineSum + Number(l.amount), 0);
  }, 0);

  const totalTrackedHours = project.timeEntries.reduce((sum, e) => sum + Number(e.hours), 0);
  const totalBillableHours = project.timeEntries
    .filter((e) => e.billable)
    .reduce((sum, e) => sum + Number(e.hours), 0);

  const hasCompAccess = canViewCompensation(user);

  let totalLaborCost: number | null = null;
  let grossMarginAmount: number | null = null;
  let grossMarginPct: number | null = null;

  if (hasCompAccess) {
    let costSum = 0;

    for (const entry of project.timeEntries) {
      const entryDate = entry.date;
      // Find compensation record effective on the entry date
      const comp = entry.employee.compensations.find((c) => {
        const afterStart = c.effectiveFrom <= entryDate;
        const beforeEnd = !c.effectiveTo || c.effectiveTo >= entryDate;
        return afterStart && beforeEnd;
      }) ?? entry.employee.compensations[0];

      const hourlyCost = comp ? Number(comp.hourlyCost) : 50.0;
      costSum += Number(entry.hours) * hourlyCost;
    }

    totalLaborCost = Math.round(costSum * 100) / 100;
    grossMarginAmount = Math.round((totalBilledRevenue - totalLaborCost) * 100) / 100;
    grossMarginPct =
      totalBilledRevenue > 0
        ? Math.round((grossMarginAmount / totalBilledRevenue) * 100)
        : 0;
  }

  return {
    projectId: project.id,
    projectName: project.name,
    clientName: project.client.name,
    totalBilledRevenue,
    totalTrackedHours,
    totalBillableHours,
    totalLaborCost,
    grossMarginAmount,
    grossMarginPct,
    canViewFinancials: hasCompAccess,
  };
}

export async function getAllProjectsProfitability(
  organizationId: string,
  user: SessionUser
): Promise<ProjectProfitabilityDTO[]> {
  const projects = await rawPrisma.project.findMany({
    where: { organizationId },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  const results = await Promise.all(
    projects.map((p) => getProjectProfitability(p.id, user))
  );

  return results.filter((p): p is ProjectProfitabilityDTO => p !== null);
}

export interface EmployeeUtilizationDTO {
  employeeId: string;
  employeeName: string;
  totalTrackedHours: number;
  billableHours: number;
  nonBillableHours: number;
  netAvailableCapacityHours: number;
  utilizationPct: number;
}

/**
 * Computes individual employee billable utilization percentage:
 * Utilization = Billable Hours / Net Working Capacity Hours
 * Surfaced on performance review profiles for Managers and HR.
 */
export async function getEmployeeUtilization(
  employeeId: string,
  startDateStr: string,
  endDateStr: string,
  user: SessionUser
): Promise<EmployeeUtilizationDTO> {
  const employee = await rawPrisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, firstName: true, lastName: true, organizationId: true, managerId: true },
  });

  if (!employee || employee.organizationId !== user.organizationId) {
    throw new Error("Employee not found in organization");
  }

  const isSelf = user.employeeId === employeeId;
  const isManager = user.role === Role.MANAGER && employee.managerId === user.employeeId;
  const isPrivileged = user.role === Role.OWNER || user.role === Role.HR;
  if (!isSelf && !isManager && !isPrivileged) {
    throw new Error("Unauthorized to view this employee's utilization");
  }

  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  const [timeEntries, holidays, leaveRequests] = await Promise.all([
    rawPrisma.timeEntry.findMany({
      where: {
        employeeId,
        date: { gte: start, lte: end },
        organizationId: user.organizationId,
      },
    }),
    rawPrisma.publicHoliday.findMany({
      where: {
        organizationId: user.organizationId,
        date: { gte: start, lte: end },
      },
    }),
    rawPrisma.leaveRequest.findMany({
      where: {
        employeeId,
        startDate: { lte: end },
        endDate: { gte: start },
        status: LeaveStatus.APPROVED,
      },
    }),
  ]);

  const holidaySet = new Set(holidays.map((h) => h.date.toISOString().split("T")[0]));
  let workDays = 0;
  const cur = new Date(start);
  while (cur <= end) {
    const dow = cur.getUTCDay();
    const dStr = cur.toISOString().split("T")[0];
    if (dow !== 0 && dow !== 6 && !holidaySet.has(dStr)) {
      workDays++;
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  let leaveWorkingDays = 0;
  for (const l of leaveRequests) {
    const clampStart = l.startDate < start ? start : l.startDate;
    const clampEnd = l.endDate > end ? end : l.endDate;
    const lCur = new Date(clampStart);
    while (lCur <= clampEnd) {
      const dow = lCur.getUTCDay();
      const dStr = lCur.toISOString().split("T")[0];
      if (dow !== 0 && dow !== 6 && !holidaySet.has(dStr)) {
        const isHalf =
          Number(l.daysCount) % 1 !== 0 &&
          l.startDate.toISOString().split("T")[0] === l.endDate.toISOString().split("T")[0];
        leaveWorkingDays += isHalf ? 0.5 : 1;
      }
      lCur.setUTCDate(lCur.getUTCDate() + 1);
    }
  }

  const grossCapacity = workDays * 8;
  const netCapacity = Math.max(0, grossCapacity - leaveWorkingDays * 8);

  const billableHours = timeEntries
    .filter((e) => e.billable)
    .reduce((sum, e) => sum + Number(e.hours), 0);
  const totalTrackedHours = timeEntries.reduce((sum, e) => sum + Number(e.hours), 0);
  const nonBillableHours = Math.max(0, totalTrackedHours - billableHours);

  const utilizationPct =
    netCapacity > 0 ? Math.round((billableHours / netCapacity) * 100) : 0;

  return {
    employeeId: employee.id,
    employeeName: `${employee.firstName} ${employee.lastName}`,
    totalTrackedHours,
    billableHours,
    nonBillableHours,
    netAvailableCapacityHours: netCapacity,
    utilizationPct,
  };
}

// ==========================================
// 3. OKR & PROJECT SYNC
// ==========================================

/**
 * Automatically syncs an OKR Key Result linked to a Project based on task completion.
 */
export async function syncProjectKeyResults(projectId: string, organizationId: string) {
  const [keyResults, project] = await Promise.all([
    rawPrisma.keyResult.findMany({
      where: { projectId },
      include: { objective: true },
    }),
    rawPrisma.project.findUnique({
      where: { id: projectId },
      include: { tasks: true },
    }),
  ]);

  if (!project || keyResults.length === 0) return;

  const totalTasks = project.tasks.length;
  const completedTasks = project.tasks.filter((t) => t.status === TaskStatus.DONE).length;
  const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return withTenant(organizationId, async (tx) => {
    for (const kr of keyResults) {
      // Scale currentValue proportionally to targetValue
      const target = Number(kr.targetValue);
      const newCurrentValue = (progressPct / 100) * target;

      await tx.keyResult.update({
        where: { id: kr.id },
        data: { currentValue: new Prisma.Decimal(newCurrentValue) },
      });
    }
  });
}

// ==========================================
// 4. ONBOARDING STARTER TASKS
// ==========================================

/**
 * Automatically creates real tasks in an internal onboarding project when a checklist is started.
 */
export async function createOnboardingStarterTasks(
  checklistId: string,
  organizationId: string
) {
  const checklist = await rawPrisma.onboardingChecklist.findUnique({
    where: { id: checklistId },
    include: {
      employee: true,
      template: {
        include: {
          items: { where: { createsStarterTask: true } },
        },
      },
    },
  });

  if (!checklist || checklist.template.items.length === 0) return;

  // Find or create internal onboarding project
  let internalProject = await rawPrisma.project.findFirst({
    where: { organizationId, name: "Internal Onboarding & Ops" },
  });

  return withTenant(organizationId, async (tx) => {
    if (!internalProject) {
      const defaultClient = await tx.client.findFirst({ where: { organizationId } });
      if (!defaultClient) return;

      internalProject = await tx.project.create({
        data: {
          organizationId,
          clientId: defaultClient.id,
          name: "Internal Onboarding & Ops",
          type: "FIXED",
          status: "ACTIVE",
          budget: new Prisma.Decimal(0),
        },
      });
    }

    for (const tplItem of checklist.template.items) {
      const task = await tx.task.create({
        data: {
          organizationId,
          projectId: internalProject.id,
          assigneeId: checklist.employeeId,
          title: `[Onboarding] ${tplItem.title} (${checklist.employee.firstName})`,
          status: TaskStatus.TODO,
          estimateHours: new Prisma.Decimal(2.0),
          position: 1.0,
        },
      });

      await tx.onboardingItem.updateMany({
        where: {
          checklistId: checklist.id,
          title: tplItem.title,
        },
        data: {
          taskId: task.id,
        },
      });
    }
  });
}

// ==========================================
// 5. EXECUTIVE DASHBOARD ANALYTICS
// ==========================================

export interface ExecutiveDashboardData {
  metrics: {
    activeEmployees: number;
    activeProjects: number;
    totalTrackedHours: number;
    billableHours: number;
    totalBilledRevenue: number;
    averageUtilizationPct: number;
    openTasksCount: number;
  };
  monthlyHoursTrend: Array<{
    month: string;
    billable: number;
    nonBillable: number;
  }>;
  departmentUtilization: Array<{
    department: string;
    allocatedHours: number;
    capacityHours: number;
    utilizationPct: number;
  }>;
  recentKudos: Array<{
    id: string;
    giverName: string;
    recipientName: string;
    message: string;
    createdAt: Date;
  }>;
  projectsProfitability: ProjectProfitabilityDTO[];
  teamWorkload: EmployeeWorkloadDTO[];
}

export async function getExecutiveDashboardMetrics(
  organizationId: string,
  user: SessionUser
): Promise<ExecutiveDashboardData> {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  const startDateStr = startOfMonth.toISOString().split("T")[0];
  const endDateStr = endOfMonth.toISOString().split("T")[0];

  const [
    activeEmployeesCount,
    activeProjectsCount,
    openTasksCount,
    allTimeEntries,
    recentKudosRaw,
    projectsProfitability,
    teamWorkload,
  ] = await Promise.all([
    rawPrisma.employee.count({
      where: { organizationId, status: "ACTIVE" },
    }),
    rawPrisma.project.count({
      where: { organizationId, status: "ACTIVE" },
    }),
    rawPrisma.task.count({
      where: {
        organizationId,
        status: { in: [TaskStatus.TODO, TaskStatus.IN_PROGRESS] },
      },
    }),
    rawPrisma.timeEntry.findMany({
      where: {
        organizationId,
        date: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) },
      },
      select: {
        date: true,
        hours: true,
        billable: true,
      },
    }),
    rawPrisma.feedback.findMany({
      where: { organizationId, type: FeedbackType.PUBLIC_KUDOS },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        sender: { select: { firstName: true, lastName: true } },
        receiver: { select: { firstName: true, lastName: true } },
      },
    }),
    getAllProjectsProfitability(organizationId, user),
    getTeamWorkload(organizationId, startDateStr, endDateStr, user),
  ]);

  // Aggregate monthly hours trend for past 6 months
  const monthMap = new Map<string, { billable: number; nonBillable: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = d.toLocaleString("default", { month: "short" });
    monthMap.set(key, { billable: 0, nonBillable: 0 });
  }

  for (const entry of allTimeEntries) {
    const key = entry.date.toLocaleString("default", { month: "short" });
    const existing = monthMap.get(key);
    if (existing) {
      if (entry.billable) {
        existing.billable += Number(entry.hours);
      } else {
        existing.nonBillable += Number(entry.hours);
      }
    }
  }

  const monthlyHoursTrend = Array.from(monthMap.entries()).map(([month, data]) => ({
    month,
    billable: Math.round(data.billable),
    nonBillable: Math.round(data.nonBillable),
  }));

  // Aggregated department utilization from teamWorkload
  const deptMap = new Map<string, { allocated: number; capacity: number }>();
  for (const member of teamWorkload) {
    const dept = member.departmentName || "General";
    const existing = deptMap.get(dept) || { allocated: 0, capacity: 0 };
    existing.allocated += member.allocatedTaskHours;
    existing.capacity += member.netAvailableHours;
    deptMap.set(dept, existing);
  }

  const departmentUtilization = Array.from(deptMap.entries()).map(([department, data]) => ({
    department,
    allocatedHours: Math.round(data.allocated),
    capacityHours: Math.round(data.capacity),
    utilizationPct: data.capacity > 0 ? Math.round((data.allocated / data.capacity) * 100) : 0,
  }));

  const totalTrackedHours = allTimeEntries.reduce(
    (sum: number, e: { hours: Prisma.Decimal }) => sum + Number(e.hours),
    0
  );
  const billableHours = allTimeEntries
    .filter((e: { billable: boolean }) => e.billable)
    .reduce((sum: number, e: { hours: Prisma.Decimal }) => sum + Number(e.hours), 0);

  const totalBilledRevenue = projectsProfitability.reduce(
    (sum: number, p: ProjectProfitabilityDTO) => sum + p.totalBilledRevenue,
    0
  );

  const totalCapacity = teamWorkload.reduce(
    (sum: number, m: EmployeeWorkloadDTO) => sum + m.netAvailableHours,
    0
  );
  const totalAllocated = teamWorkload.reduce(
    (sum: number, m: EmployeeWorkloadDTO) => sum + m.allocatedTaskHours,
    0
  );
  const averageUtilizationPct =
    totalCapacity > 0 ? Math.round((totalAllocated / totalCapacity) * 100) : 0;

  const recentKudos = recentKudosRaw.map((k) => ({
    id: k.id,
    giverName: `${k.sender.firstName} ${k.sender.lastName}`,
    recipientName: `${k.receiver.firstName} ${k.receiver.lastName}`,
    message: k.message,
    createdAt: k.createdAt,
  }));

  return {
    metrics: {
      activeEmployees: activeEmployeesCount,
      activeProjects: activeProjectsCount,
      totalTrackedHours: Math.round(totalTrackedHours),
      billableHours: Math.round(billableHours),
      totalBilledRevenue: Math.round(totalBilledRevenue),
      averageUtilizationPct,
      openTasksCount,
    },
    monthlyHoursTrend,
    departmentUtilization,
    recentKudos,
    projectsProfitability,
    teamWorkload,
  };
}
