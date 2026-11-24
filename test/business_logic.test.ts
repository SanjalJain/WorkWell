import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { Role, LeaveStatus } from "@prisma/client";
import { rawPrisma } from "../src/lib/db";
import { getLeaveBalances, requestLeave } from "../src/modules/people/leave-service";
import { wouldCreateObjectiveCycle, createObjective } from "../src/modules/performance/service";
import { canManageObjective } from "../src/modules/performance/policies";
import { getEmployeeUtilization } from "../src/modules/shared/service";
import { generateInvoicePdf } from "../src/modules/work/billing-service";

describe("Sprint 2 Business Logic & Cross-Module Verification", () => {
  let org: any;
  let owner: any;
  let manager: any;
  let emp: any;
  let leaveType: any;

  before(async () => {
    await rawPrisma.organization.deleteMany({
      where: { slug: "biz-test-org" },
    });

    org = await rawPrisma.organization.create({
      data: {
        name: "Business Logic Test Org",
        slug: "biz-test-org",
        invoiceSequence: { create: { lastNumber: 200 } },
      },
    });

    emp = await rawPrisma.employee.create({
      data: {
        organizationId: org.id,
        firstName: "Charlie",
        lastName: "Brown",
        jobTitle: "Designer",
        startDate: new Date("2025-01-01"),
      },
    });

    owner = await rawPrisma.user.create({
      data: {
        organizationId: org.id,
        email: "owner@biz.com",
        role: Role.OWNER,
        employeeId: emp.id,
      },
    });

    manager = await rawPrisma.user.create({
      data: {
        organizationId: org.id,
        email: "mgr@biz.com",
        role: Role.MANAGER,
      },
    });

    leaveType = await rawPrisma.leaveType.create({
      data: {
        organizationId: org.id,
        name: "Annual Leave",
        daysAllowance: 10,
      },
    });
  });

  after(async () => {
    await rawPrisma.organization.deleteMany({
      where: { slug: "biz-test-org" },
    });
  });

  describe("B5: Year-Boundary Leave Splitting & Available Accounting", () => {
    it("should split leave across calendar years and account for pending requests", async () => {
      // Create a leave request spanning Dec 30 2026 to Jan 2 2027 (Wed Dec 30, Thu Dec 31, Fri Jan 1 [holiday/weekday])
      // Total 3 weekdays: 2 in 2026, 1 in 2027
      await rawPrisma.leaveRequest.create({
        data: {
          employeeId: emp.id,
          leaveTypeId: leaveType.id,
          startDate: new Date("2026-12-30"),
          endDate: new Date("2027-01-02"),
          daysCount: 3,
          status: LeaveStatus.PENDING,
        },
      });

      const balances2026 = await getLeaveBalances(emp.id, org.id, 2026);
      const lt2026 = balances2026.find((b) => b.leaveTypeId === leaveType.id);
      assert.ok(lt2026);
      // Dec 30 (Wed), Dec 31 (Thu) = 2 days in 2026
      assert.equal(lt2026.pendingDays, 2, "2026 should account for exactly 2 pending days");

      const balances2027 = await getLeaveBalances(emp.id, org.id, 2027);
      const lt2027 = balances2027.find((b) => b.leaveTypeId === leaveType.id);
      assert.ok(lt2027);
      // Jan 1 (Fri) = 1 day in 2027
      assert.equal(lt2027.pendingDays, 1, "2027 should account for exactly 1 pending day");
    });
  });

  describe("B9: OKR Policies & Hierarchy Cycle Guard", () => {
    it("canManageObjective: blocks MANAGER from creating COMPANY level OKR", () => {
      const allowed = canManageObjective(
        { userId: "mgr-1", organizationId: org.id, role: Role.MANAGER, email: "m@biz.com", name: "Manager" },
        { level: "COMPANY" }
      );
      assert.equal(allowed, false, "Manager must not be authorized to manage company-level OKRs");
    });

    it("wouldCreateObjectiveCycle: detects circular hierarchy loops", async () => {
      const parentObj = await rawPrisma.objective.create({
        data: {
          organizationId: org.id,
          title: "Scale Cloud Revenue",
          level: "COMPANY",
        },
      });

      const childObj = await rawPrisma.objective.create({
        data: {
          organizationId: org.id,
          title: "Launch Enterprise Tier",
          level: "DEPARTMENT",
          parentId: parentObj.id,
        },
      });

      // Attempting to set parentObj's parent to childObj creates a cycle!
      const cycleDetected = await wouldCreateObjectiveCycle(parentObj.id, childObj.id);
      assert.equal(cycleDetected, true, "Circular loop (Child -> Parent -> Child) must be detected");
    });
  });

  describe("Phase 6: Utilization Calculation", () => {
    it("getEmployeeUtilization: computes exact utilization ratio against net capacity", async () => {
      const sessionUser = {
        userId: owner.id,
        organizationId: org.id,
        role: Role.OWNER,
        employeeId: emp.id,
        email: owner.email,
        name: "Owner",
      };

      const util = await getEmployeeUtilization(
        emp.id,
        "2026-06-01",
        "2026-06-05", // 5 days = 40h capacity
        sessionUser
      );

      assert.equal(util.netAvailableCapacityHours, 40);
      assert.equal(util.billableHours, 0);
      assert.equal(util.utilizationPct, 0);
    });
  });
});
