import { rawPrisma } from "@/lib/db";
import { withTenant } from "@/lib/tenant";
import { SessionUser } from "@/lib/auth";
import { canViewEmployee, canViewCompensation, canEditEmployee } from "./policies";
import { CreateEmployeeInput, UpdateEmployeeInput, EmployeeProfileDTO } from "./schema";
import { logAudit } from "@/lib/audit";
import { EmployeeStatus, Prisma } from "@prisma/client";

/**
 * Checks if assigning newManagerId to employeeId would create a circular reporting chain.
 */
export async function wouldCreateManagerCycle(
  employeeId: string,
  newManagerId: string,
  organizationId: string
): Promise<boolean> {
  if (employeeId === newManagerId) return true;

  let currentId: string | null = newManagerId;
  const visited = new Set<string>([employeeId]);

  while (currentId) {
    if (visited.has(currentId)) {
      return true;
    }
    visited.add(currentId);

    const manager: { managerId: string | null } | null = await rawPrisma.employee.findFirst({
      where: { id: currentId, organizationId },
      select: { managerId: true },
    });

    currentId = manager?.managerId ?? null;
  }

  return false;
}

export interface ListEmployeesParams {
  search?: string;
  departmentId?: string;
  status?: EmployeeStatus;
  page?: number;
  limit?: number;
}

/**
 * Lists employees within the user's organization with pagination and search.
 * Compensation data is omitted unless caller has OWNER or HR role.
 */
export async function listEmployees(
  params: ListEmployeesParams,
  user: SessionUser
): Promise<{ employees: EmployeeProfileDTO[]; total: number; page: number; totalPages: number }> {
  if (!canViewEmployee(user)) {
    throw new Error("Unauthorized to view employee directory");
  }

  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(50, Math.max(1, params.limit ?? 10));
  const skip = (page - 1) * limit;

  const where: Prisma.EmployeeWhereInput = {
    organizationId: user.organizationId,
    ...(params.departmentId ? { departmentId: params.departmentId } : {}),
    ...(params.status ? { status: params.status } : {}),
    ...(params.search
      ? {
          OR: [
            { firstName: { contains: params.search, mode: "insensitive" } },
            { lastName: { contains: params.search, mode: "insensitive" } },
            { jobTitle: { contains: params.search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, records] = await Promise.all([
    rawPrisma.employee.count({ where }),
    rawPrisma.employee.findMany({
      where,
      skip,
      take: limit,
      include: {
        department: true,
        manager: true,
        user: true,
        compensations: canViewCompensation(user)
          ? {
              orderBy: { effectiveFrom: "desc" },
              take: 1,
            }
          : false,
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  const employees: EmployeeProfileDTO[] = records.map((emp) => {
    const comp = emp.compensations && emp.compensations.length > 0 ? emp.compensations[0] : null;

    return {
      id: emp.id,
      firstName: emp.firstName,
      lastName: emp.lastName,
      fullName: `${emp.firstName} ${emp.lastName}`,
      email: emp.user?.email ?? "",
      jobTitle: emp.jobTitle,
      status: emp.status,
      startDate: emp.startDate.toISOString().split("T")[0],
      department: emp.department ? { id: emp.department.id, name: emp.department.name } : null,
      manager: emp.manager
        ? {
            id: emp.manager.id,
            name: `${emp.manager.firstName} ${emp.manager.lastName}`,
            jobTitle: emp.manager.jobTitle,
          }
        : null,
      role: emp.user?.role ?? "EMPLOYEE",
      compensation:
        canViewCompensation(user) && comp
          ? {
              id: comp.id,
              hourlyCost: comp.hourlyCost.toFixed(2),
              billableRate: comp.billableRate.toFixed(2),
              effectiveFrom: comp.effectiveFrom.toISOString().split("T")[0],
              effectiveTo: comp.effectiveTo ? comp.effectiveTo.toISOString().split("T")[0] : null,
            }
          : null,
    };
  });

  return {
    employees,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Retrieves a detailed profile for a single employee, shaped by caller's role.
 * Writes an audit record if compensation is queried.
 */
export async function getEmployeeProfile(
  employeeId: string,
  user: SessionUser
): Promise<EmployeeProfileDTO | null> {
  if (!canViewEmployee(user)) {
    throw new Error("Unauthorized to view employee details");
  }

  const emp = await rawPrisma.employee.findFirst({
    where: { id: employeeId, organizationId: user.organizationId },
    include: {
      department: true,
      manager: true,
      reports: true,
      user: true,
      compensations: canViewCompensation(user)
        ? {
            orderBy: { effectiveFrom: "desc" },
            take: 1,
          }
        : false,
    },
  });

  if (!emp) return null;

  const showComp = canViewCompensation(user);
  const comp = emp.compensations && emp.compensations.length > 0 ? emp.compensations[0] : null;

  if (showComp && comp) {
    await logAudit({
      organizationId: user.organizationId,
      userId: user.userId,
      action: "VIEW_COMPENSATION",
      entity: "Compensation",
      entityId: comp.id,
      metadata: { targetEmployeeId: emp.id, viewedByRole: user.role },
    });
  }

  return {
    id: emp.id,
    firstName: emp.firstName,
    lastName: emp.lastName,
    fullName: `${emp.firstName} ${emp.lastName}`,
    email: emp.user?.email ?? "",
    jobTitle: emp.jobTitle,
    status: emp.status,
    startDate: emp.startDate.toISOString().split("T")[0],
    department: emp.department ? { id: emp.department.id, name: emp.department.name } : null,
    manager: emp.manager
      ? {
          id: emp.manager.id,
          name: `${emp.manager.firstName} ${emp.manager.lastName}`,
          jobTitle: emp.manager.jobTitle,
        }
      : null,
    directReports: emp.reports.map((r) => ({
      id: r.id,
      name: `${r.firstName} ${r.lastName}`,
      jobTitle: r.jobTitle,
    })),
    role: emp.user?.role ?? "EMPLOYEE",
    compensation:
      showComp && comp
        ? {
            id: comp.id,
            hourlyCost: comp.hourlyCost.toFixed(2),
            billableRate: comp.billableRate.toFixed(2),
            effectiveFrom: comp.effectiveFrom.toISOString().split("T")[0],
            effectiveTo: comp.effectiveTo ? comp.effectiveTo.toISOString().split("T")[0] : null,
          }
        : null,
  };
}

/**
 * Creates an employee, corresponding user account, and initial compensation record.
 */
export async function createEmployee(data: CreateEmployeeInput, user: SessionUser) {
  if (!canEditEmployee(user)) {
    throw new Error("Unauthorized: Only Owner or HR can create employees");
  }

  return withTenant(user.organizationId, async (tx) => {
    // Check email uniqueness within tenant
    const existingUser = await tx.user.findFirst({
      where: { organizationId: user.organizationId, email: data.email },
    });

    if (existingUser) {
      throw new Error(`A user with email ${data.email} already exists in this organization`);
    }

    if (data.managerId) {
      const manager = await tx.employee.findFirst({
        where: { id: data.managerId, organizationId: user.organizationId },
      });
      if (!manager) {
        throw new Error("Specified manager was not found in this organization");
      }
    }

    const employee = await tx.employee.create({
      data: {
        organizationId: user.organizationId,
        firstName: data.firstName,
        lastName: data.lastName,
        jobTitle: data.jobTitle,
        departmentId: data.departmentId ?? null,
        managerId: data.managerId ?? null,
        status: EmployeeStatus.ACTIVE,
        startDate: data.startDate ? new Date(data.startDate) : new Date(),
      },
    });

    const userAccount = await tx.user.create({
      data: {
        organizationId: user.organizationId,
        email: data.email,
        employeeId: employee.id,
        role: data.role,
      },
    });

    if (data.hourlyCost !== undefined && data.billableRate !== undefined) {
      await tx.compensation.create({
        data: {
          employeeId: employee.id,
          hourlyCost: new Prisma.Decimal(data.hourlyCost),
          billableRate: new Prisma.Decimal(data.billableRate),
          effectiveFrom: employee.startDate,
        },
      });
    }

    await logAudit(
      {
        organizationId: user.organizationId,
        userId: user.userId,
        action: "CREATE_EMPLOYEE",
        entity: "Employee",
        entityId: employee.id,
        metadata: { email: data.email, role: data.role },
      },
      tx
    );

    return { employee, userAccount };
  });
}

/**
 * Updates an employee's details, enforcing cycle checks on manager reassignments.
 */
export async function updateEmployee(id: string, data: UpdateEmployeeInput, user: SessionUser) {
  if (!canEditEmployee(user)) {
    throw new Error("Unauthorized: Only Owner or HR can update employee metadata");
  }

  if (data.managerId) {
    const isCycle = await wouldCreateManagerCycle(id, data.managerId, user.organizationId);
    if (isCycle) {
      throw new Error("Invalid manager: Setting this manager would create a circular reporting chain");
    }
  }

  return withTenant(user.organizationId, async (tx) => {
    const updated = await tx.employee.update({
      where: { id },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        jobTitle: data.jobTitle,
        departmentId: data.departmentId,
        managerId: data.managerId,
        status: data.status,
      },
    });

    await logAudit(
      {
        organizationId: user.organizationId,
        userId: user.userId,
        action: "UPDATE_EMPLOYEE",
        entity: "Employee",
        entityId: id,
        metadata: data as Record<string, unknown>,
      },
      tx
    );

    return updated;
  });
}

export interface OrgChartNode {
  id: string;
  name: string;
  jobTitle: string;
  departmentName?: string | null;
  reports: OrgChartNode[];
}

/**
 * Builds the organizational reporting hierarchy tree.
 */
export async function getOrgChart(user: SessionUser): Promise<OrgChartNode[]> {
  if (!canViewEmployee(user)) {
    throw new Error("Unauthorized to view org chart");
  }

  const allEmployees = await rawPrisma.employee.findMany({
    where: { organizationId: user.organizationId, status: EmployeeStatus.ACTIVE },
    include: { department: true },
  });

  const nodeMap = new Map<string, OrgChartNode>();

  allEmployees.forEach((emp) => {
    nodeMap.set(emp.id, {
      id: emp.id,
      name: `${emp.firstName} ${emp.lastName}`,
      jobTitle: emp.jobTitle,
      departmentName: emp.department?.name,
      reports: [],
    });
  });

  const roots: OrgChartNode[] = [];

  allEmployees.forEach((emp) => {
    const node = nodeMap.get(emp.id)!;
    if (emp.managerId && nodeMap.has(emp.managerId)) {
      nodeMap.get(emp.managerId)!.reports.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}
