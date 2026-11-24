import { rawPrisma } from "@/lib/db";
import { withTenant } from "@/lib/tenant";
import { SessionUser } from "@/lib/auth";
import { canApproveLeave } from "./policies";
import { RequestLeaveInput, LeaveBalanceDTO, LeaveRequestDTO } from "./schema";
import { logAudit } from "@/lib/audit";
import { LeaveStatus, Prisma } from "@prisma/client";

/**
 * Calculates working days between two dates, excluding weekends and public holidays.
 */
export async function calculateWorkingDays(
  startDateStr: string,
  endDateStr: string,
  organizationId: string,
  isHalfDay = false
): Promise<number> {
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);

  if (start > end) {
    throw new Error("Start date cannot be after end date");
  }

  if (isHalfDay) {
    if (startDateStr !== endDateStr) {
      throw new Error("Half-day leave must be on a single date");
    }
    const dayOfWeek = start.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      throw new Error("Half-day leave cannot be on a weekend");
    }
    const holiday = await rawPrisma.publicHoliday.findFirst({
      where: { organizationId, date: start },
    });
    if (holiday) {
      throw new Error(`The selected date is a public holiday: ${holiday.name}`);
    }
    return 0.5;
  }

  // Fetch all public holidays within the date range
  const holidays = await rawPrisma.publicHoliday.findMany({
    where: {
      organizationId,
      date: { gte: start, lte: end },
    },
    select: { date: true },
  });

  const holidayDates = new Set(
    holidays.map((h) => h.date.toISOString().split("T")[0])
  );

  let workingDays = 0;
  const current = new Date(start);

  while (current <= end) {
    const dayOfWeek = current.getUTCDay();
    const dateStr = current.toISOString().split("T")[0];

    // Exclude Saturday (6) and Sunday (0)
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isHoliday = holidayDates.has(dateStr);

    if (!isWeekend && !isHoliday) {
      workingDays++;
    }

    current.setUTCDate(current.getUTCDate() + 1);
  }

  return workingDays;
}

/**
 * Computes dynamic leave balances for an employee in the current calendar year.
 * Prevents drifting counter columns by calculating: allowance - sum(approved days).
 */
export async function getLeaveBalances(
  employeeId: string,
  organizationId: string,
  targetYear?: number
): Promise<LeaveBalanceDTO[]> {
  const employee = await rawPrisma.employee.findUnique({
    where: { id: employeeId },
    select: { organizationId: true },
  });

  if (!employee || employee.organizationId !== organizationId) {
    throw new Error("Employee not found in organization");
  }

  const currentYear = targetYear ?? new Date().getFullYear();
  const yearStart = new Date(Date.UTC(currentYear, 0, 1));
  const yearEnd = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));

  const [leaveTypes, requests, holidays] = await Promise.all([
    rawPrisma.leaveType.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
    }),
    rawPrisma.leaveRequest.findMany({
      where: {
        employeeId,
        startDate: { lte: yearEnd },
        endDate: { gte: yearStart },
        status: { in: [LeaveStatus.APPROVED, LeaveStatus.PENDING] },
      },
    }),
    rawPrisma.publicHoliday.findMany({
      where: {
        organizationId,
        date: { gte: yearStart, lte: yearEnd },
      },
      select: { date: true },
    }),
  ]);

  const holidayDates = new Set(holidays.map((h) => h.date.toISOString().split("T")[0]));

  return leaveTypes.map((lt) => {
    const typeRequests = requests.filter((r) => r.leaveTypeId === lt.id);

    let approvedDays = 0;
    let pendingDays = 0;

    for (const req of typeRequests) {
      // Calculate working days that specifically fall within currentYear
      const clampedStart = req.startDate < yearStart ? yearStart : req.startDate;
      const clampedEnd = req.endDate > yearEnd ? yearEnd : req.endDate;

      let reqDaysInYear = 0;
      const cur = new Date(clampedStart);
      while (cur <= clampedEnd) {
        const dow = cur.getUTCDay();
        const dStr = cur.toISOString().split("T")[0];
        if (dow !== 0 && dow !== 6 && !holidayDates.has(dStr)) {
          const isSingleDayHalf =
            Number(req.daysCount) % 1 !== 0 &&
            req.startDate.toISOString().split("T")[0] === req.endDate.toISOString().split("T")[0];
          reqDaysInYear += isSingleDayHalf ? 0.5 : 1;
        }
        cur.setUTCDate(cur.getUTCDate() + 1);
      }

      if (req.status === LeaveStatus.APPROVED) {
        approvedDays += reqDaysInYear;
      } else if (req.status === LeaveStatus.PENDING) {
        pendingDays += reqDaysInYear;
      }
    }

    const remainingDays = Math.max(0, lt.daysAllowance - approvedDays);

    return {
      leaveTypeId: lt.id,
      name: lt.name,
      annualAllowance: lt.daysAllowance,
      approvedDays,
      pendingDays,
      remainingDays,
    };
  });
}

/**
 * Submits a new leave request with overlap validation and balance verification.
 */
export async function requestLeave(input: RequestLeaveInput, user: SessionUser) {
  if (!user.employeeId) {
    throw new Error("Only employees can request leave");
  }

  const startDate = new Date(input.startDate);
  const endDate = new Date(input.endDate);

  if (startDate > endDate) {
    throw new Error("Start date must be before or equal to end date");
  }

  const workingDays = await calculateWorkingDays(
    input.startDate,
    input.endDate,
    user.organizationId,
    input.isHalfDay
  );

  if (workingDays <= 0) {
    throw new Error("The selected date range contains no working days (all weekends or public holidays)");
  }

  return withTenant(user.organizationId, async (tx) => {
    // 1. Check for overlapping requests
    const overlapping = await tx.leaveRequest.findFirst({
      where: {
        employeeId: user.employeeId!,
        status: { in: [LeaveStatus.PENDING, LeaveStatus.APPROVED] },
        OR: [
          { startDate: { lte: endDate }, endDate: { gte: startDate } },
        ],
      },
    });

    if (overlapping) {
      throw new Error("You already have a pending or approved leave request overlapping these dates");
    }

    // 2. Check remaining balance across all years spanned by request
    const sYear = startDate.getUTCFullYear();
    const eYear = endDate.getUTCFullYear();

    for (let yr = sYear; yr <= eYear; yr++) {
      const balances = await getLeaveBalances(user.employeeId!, user.organizationId, yr);
      const targetBalance = balances.find((b) => b.leaveTypeId === input.leaveTypeId);

      if (!targetBalance) {
        throw new Error("Invalid leave type selected");
      }

      const yStart = new Date(Date.UTC(yr, 0, 1));
      const yEnd = new Date(Date.UTC(yr, 11, 31, 23, 59, 59, 999));
      const clampedStart = startDate < yStart ? yStart : startDate;
      const clampedEnd = endDate > yEnd ? yEnd : endDate;

      const yearDays = await calculateWorkingDays(
        clampedStart.toISOString().split("T")[0],
        clampedEnd.toISOString().split("T")[0],
        user.organizationId,
        input.isHalfDay
      );

      const availableDays = targetBalance.remainingDays - targetBalance.pendingDays;
      if (yearDays > availableDays) {
        throw new Error(
          `Insufficient leave balance for year ${yr}. Requested ${yearDays} days, but only ${availableDays} days available (${targetBalance.pendingDays} days pending).`
        );
      }
    }

    // 3. Create the leave request
    const request = await tx.leaveRequest.create({
      data: {
        employeeId: user.employeeId!,
        leaveTypeId: input.leaveTypeId,
        startDate,
        endDate,
        daysCount: new Prisma.Decimal(workingDays),
        status: LeaveStatus.PENDING,
        reason: input.reason ?? null,
      },
    });

    await logAudit(
      {
        organizationId: user.organizationId,
        userId: user.userId,
        action: "REQUEST_LEAVE",
        entity: "LeaveRequest",
        entityId: request.id,
        metadata: { days: workingDays, startDate: input.startDate, endDate: input.endDate },
      },
      tx
    );

    return request;
  });
}

/**
 * Approves or Rejects a leave request using atomic concurrency locking (WHERE status = 'PENDING').
 */
export async function decideLeave(
  leaveRequestId: string,
  decision: "APPROVED" | "REJECTED",
  user: SessionUser
) {
  const req = await rawPrisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    include: {
      employee: {
        select: { id: true, managerId: true, firstName: true, lastName: true, organizationId: true },
      },
    },
  });

  if (!req || req.employee.organizationId !== user.organizationId) {
    throw new Error("Leave request not found");
  }

  // Authorization and anti-self-approval validation
  if (!canApproveLeave(user, req.employee)) {
    throw new Error("Unauthorized to decide this leave request");
  }

  return withTenant(user.organizationId, async (tx) => {
    // If approving, re-verify employee has sufficient balance remaining
    if (decision === "APPROVED") {
      const sYear = req.startDate.getUTCFullYear();
      const eYear = req.endDate.getUTCFullYear();
      for (let yr = sYear; yr <= eYear; yr++) {
        const balances = await getLeaveBalances(req.employee.id, user.organizationId, yr);
        const targetBal = balances.find((b) => b.leaveTypeId === req.leaveTypeId);
        if (targetBal && targetBal.remainingDays <= 0) {
          throw new Error(`Cannot approve leave request: employee has no remaining leave balance in ${yr}`);
        }
      }
    }

    // Conditional atomic update to prevent double approvals from two tabs
    const updated = await tx.leaveRequest.updateMany({
      where: {
        id: leaveRequestId,
        status: LeaveStatus.PENDING,
      },
      data: {
        status: decision === "APPROVED" ? LeaveStatus.APPROVED : LeaveStatus.REJECTED,
        decidedBy: user.userId,
        decidedAt: new Date(),
      },
    });

    if (updated.count === 0) {
      throw new Error("Leave request has already been processed or cancelled");
    }

    await logAudit(
      {
        organizationId: user.organizationId,
        userId: user.userId,
        action: `DECIDE_LEAVE_${decision}`,
        entity: "LeaveRequest",
        entityId: leaveRequestId,
        metadata: { decision, decidedFor: req.employee.id },
      },
      tx
    );

    return { success: true, decision };
  });
}

/**
 * Cancels a pending or upcoming leave request by the requester.
 */
export async function cancelLeave(leaveRequestId: string, user: SessionUser) {
  const req = await rawPrisma.leaveRequest.findUnique({
    where: { id: leaveRequestId },
    include: {
      employee: { select: { organizationId: true } },
    },
  });

  if (!req || req.employee.organizationId !== user.organizationId) {
    throw new Error("Leave request not found");
  }
  if (req.employeeId !== user.employeeId) {
    throw new Error("You can only cancel your own leave requests");
  }

  if (req.status === LeaveStatus.REJECTED || req.status === LeaveStatus.CANCELLED) {
    throw new Error("Leave request is already finalized");
  }

  return withTenant(user.organizationId, async (tx) => {
    const updated = await tx.leaveRequest.update({
      where: { id: leaveRequestId },
      data: { status: LeaveStatus.CANCELLED },
    });

    await logAudit(
      {
        organizationId: user.organizationId,
        userId: user.userId,
        action: "CANCEL_LEAVE",
        entity: "LeaveRequest",
        entityId: leaveRequestId,
      },
      tx
    );

    return updated;
  });
}

/**
 * Lists leave requests with role-conditioned visibility:
 * - HR/Owner: sees all leave requests in the organization.
 * - Manager: sees own requests + pending direct report requests.
 * - Employee: sees own requests.
 */
export async function listLeaveRequests(user: SessionUser): Promise<LeaveRequestDTO[]> {
  const isHRorOwner = user.role === "OWNER" || user.role === "HR";
  const isManager = user.role === "MANAGER";

  let where: Prisma.LeaveRequestWhereInput = {
    employee: { organizationId: user.organizationId },
  };

  if (!isHRorOwner) {
    if (isManager && user.employeeId) {
      where = {
        OR: [
          { employeeId: user.employeeId },
          { employee: { managerId: user.employeeId } },
        ],
      };
    } else if (user.employeeId) {
      where = { employeeId: user.employeeId };
    } else {
      return [];
    }
  }

  const requests = await rawPrisma.leaveRequest.findMany({
    where,
    include: {
      employee: {
        select: { id: true, firstName: true, lastName: true, jobTitle: true, managerId: true },
      },
      leaveType: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return requests.map((r) => ({
    id: r.id,
    employeeId: r.employeeId,
    employeeName: `${r.employee.firstName} ${r.employee.lastName}`,
    employeeJobTitle: r.employee.jobTitle,
    leaveTypeId: r.leaveTypeId,
    leaveTypeName: r.leaveType.name,
    startDate: r.startDate.toISOString().split("T")[0],
    endDate: r.endDate.toISOString().split("T")[0],
    daysCount: Number(r.daysCount),
    status: r.status,
    reason: r.reason,
    decidedBy: r.decidedBy,
    decidedAt: r.decidedAt ? r.decidedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString().split("T")[0],
    canApprove: canApproveLeave(user, r.employee) && r.status === LeaveStatus.PENDING,
  }));
}
