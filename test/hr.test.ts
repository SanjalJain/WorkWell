import { rawPrisma } from "../src/lib/db";
import { 
  calculateWorkingDays, 
  getLeaveBalances, 
  requestLeave, 
  decideLeave, 
  cancelLeave 
} from "../src/modules/people/leave-service";
import { startOnboarding, toggleOnboardingItem } from "../src/modules/people/onboarding-service";
import { createDocumentRecord, listDocuments, getDocumentDownloadUrl } from "../src/modules/people/document-service";
import { canApproveLeave, canViewDocument } from "../src/modules/people/policies";
import { Role, EmployeeStatus, DocumentCategory, LeaveStatus } from "@prisma/client";
import { SessionUser } from "../src/lib/auth";

async function runHRTests() {
  console.log("🧪 Running Phase 2: HR Operations & Policies Verification Suite...\n");

  const org = await rawPrisma.organization.findUnique({ where: { slug: "brightwave" } });
  if (!org) throw new Error("Demo organization not found.");

  const ownerUser = await rawPrisma.user.findFirst({ where: { role: Role.OWNER, organizationId: org.id }, include: { employee: true } });
  const hrUser = await rawPrisma.user.findFirst({ where: { role: Role.HR, organizationId: org.id }, include: { employee: true } });
  const managerUser = await rawPrisma.user.findFirst({ where: { role: Role.MANAGER, organizationId: org.id }, include: { employee: true } });
  const employeeUser = await rawPrisma.user.findFirst({ where: { role: Role.EMPLOYEE, email: "employee@brightwave.io" }, include: { employee: true } });

  // Clean up any leave requests or test employees from prior runs
  if (employeeUser?.employeeId) {
    await rawPrisma.leaveRequest.deleteMany({
      where: { employeeId: employeeUser.employeeId },
    });
  }
  await rawPrisma.employee.deleteMany({
    where: { firstName: "Taylor", lastName: "Swift" },
  });

  const ownerSession: SessionUser = {
    userId: ownerUser!.id,
    organizationId: org.id,
    role: Role.OWNER,
    employeeId: ownerUser!.employeeId,
    email: ownerUser!.email,
    name: "Sarah Sterling",
  };

  const hrSession: SessionUser = {
    userId: hrUser!.id,
    organizationId: org.id,
    role: Role.HR,
    employeeId: hrUser!.employeeId,
    email: hrUser!.email,
    name: "Elena Ramos",
  };

  const managerSession: SessionUser = {
    userId: managerUser!.id,
    organizationId: org.id,
    role: Role.MANAGER,
    employeeId: managerUser!.employeeId,
    email: managerUser!.email,
    name: "Marcus Vance",
  };

  const employeeSession: SessionUser = {
    userId: employeeUser!.id,
    organizationId: org.id,
    role: Role.EMPLOYEE,
    employeeId: employeeUser!.employeeId,
    email: employeeUser!.email,
    name: "Alex Chen",
  };

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  // --- Test 1: Working Days Calculation (excludes weekends) ---
  // Monday 2026-06-01 to Friday 2026-06-05 is 5 days
  const fiveDays = await calculateWorkingDays("2026-06-01", "2026-06-05", org.id);
  assert(fiveDays === 5, "Working days correctly counts 5 days for Mon-Fri");

  // Friday 2026-06-05 to Monday 2026-06-08 (includes Sat & Sun) is 2 working days
  const weekendExclusion = await calculateWorkingDays("2026-06-05", "2026-06-08", org.id);
  assert(weekendExclusion === 2, "Working days correctly excludes Saturday and Sunday");

  // --- Test 2: Public Holiday Exclusion ---
  // Independence Day 2026-07-04 is a holiday. 
  // Let's create a test public holiday on a weekday: Wednesday 2026-06-03
  await rawPrisma.publicHoliday.upsert({
    where: { organizationId_date: { organizationId: org.id, date: new Date("2026-06-03") } },
    create: { organizationId: org.id, name: "Midsummer Day", date: new Date("2026-06-03") },
    update: {},
  });

  const withHoliday = await calculateWorkingDays("2026-06-01", "2026-06-05", org.id);
  assert(withHoliday === 4, "Working days correctly excludes weekday public holidays (5 days - 1 holiday = 4)");

  // Clean up test holiday
  await rawPrisma.publicHoliday.delete({
    where: { organizationId_date: { organizationId: org.id, date: new Date("2026-06-03") } },
  });

  // --- Test 3: Dynamic Leave Balance Computation ---
  const ptoType = await rawPrisma.leaveType.findFirst({ where: { organizationId: org.id, name: { contains: "PTO" } } });
  assert(ptoType !== null, "Found PTO leave type");

  const balancesBefore = await getLeaveBalances(employeeSession.employeeId!, org.id);
  const ptoBalanceBefore = balancesBefore.find((b) => b.leaveTypeId === ptoType!.id)!;
  assert(ptoBalanceBefore.annualAllowance === 20, "PTO annual allowance is 20 days");
  assert(ptoBalanceBefore.remainingDays === 20, "Fresh employee has all 20 days remaining");

  // --- Test 4: Request Leave & Balance Deduction on Approval ---
  const leaveReq = await requestLeave(
    {
      leaveTypeId: ptoType!.id,
      startDate: "2026-08-10", // Mon
      endDate: "2026-08-12",   // Wed (3 working days)
      isHalfDay: false,
      reason: "Summer vacation",
    },
    employeeSession
  );
  assert(leaveReq.status === LeaveStatus.PENDING, "Leave request created in PENDING status");

  // Balance before approval: pendingDays is 3, remainingDays is 20
  const balancesPending = await getLeaveBalances(employeeSession.employeeId!, org.id);
  const ptoPending = balancesPending.find((b) => b.leaveTypeId === ptoType!.id)!;
  assert(ptoPending.pendingDays === 3 && ptoPending.remainingDays === 20, "Pending leave tracks 3 pending days without prematurely deducting");

  // --- Test 5: Overlapping Request Rejection ---
  let overlapBlocked = false;
  try {
    await requestLeave(
      {
        leaveTypeId: ptoType!.id,
        startDate: "2026-08-11", // Overlaps with 2026-08-10 to 2026-08-12
        endDate: "2026-08-14",
        isHalfDay: false,
      },
      employeeSession
    );
  } catch (err: any) {
    overlapBlocked = true;
  }
  assert(overlapBlocked, "Overlapping leave request is blocked");

  // --- Test 6: Anti-Self-Approval on Leave ---
  let selfApprovalBlocked = false;
  try {
    await decideLeave(leaveReq.id, "APPROVED", employeeSession);
  } catch (err: any) {
    selfApprovalBlocked = true;
  }
  assert(selfApprovalBlocked, "Requester cannot approve their own leave request");

  // --- Test 7: Manager Approval & Atomic Concurrency Update ---
  await decideLeave(leaveReq.id, "APPROVED", managerSession);
  const approvedReq = await rawPrisma.leaveRequest.findUnique({ where: { id: leaveReq.id } });
  assert(approvedReq?.status === LeaveStatus.APPROVED, "Manager successfully approved leave request");

  // Dynamic balance after approval: remainingDays is now 17
  const balancesAfter = await getLeaveBalances(employeeSession.employeeId!, org.id);
  const ptoAfter = balancesAfter.find((b) => b.leaveTypeId === ptoType!.id)!;
  assert(ptoAfter.approvedDays === 3 && ptoAfter.remainingDays === 17, "Approved leave correctly reduces remaining balance to 17 days");

  // Double approval attempt should fail atomically
  let doubleApprovalFailed = false;
  try {
    await decideLeave(leaveReq.id, "APPROVED", hrSession);
  } catch {
    doubleApprovalFailed = true;
  }
  assert(doubleApprovalFailed, "Double approval atomically rejected (WHERE status = 'PENDING')");

  // --- Test 8: Onboarding Checklist & Auto-Activation ---
  // Create a new hire employee in ONBOARDING status
  const template = await rawPrisma.onboardingTemplate.findFirst({ where: { organizationId: org.id } });
  assert(template !== null, "Found onboarding template");

  const newHire = await rawPrisma.employee.create({
    data: {
      organizationId: org.id,
      firstName: "Taylor",
      lastName: "Swift",
      jobTitle: "Software Engineer",
      status: EmployeeStatus.ONBOARDING,
    },
  });

  const checklist = await startOnboarding(newHire.id, template!.id, hrSession);
  assert(checklist.items.length > 0, "Onboarding checklist generated items snapshot from template");

  // Complete each item
  for (const item of checklist.items) {
    await toggleOnboardingItem(item.id, true, hrSession);
  }

  const updatedNewHire = await rawPrisma.employee.findUnique({ where: { id: newHire.id } });
  assert(updatedNewHire?.status === EmployeeStatus.ACTIVE, "Employee automatically flipped from ONBOARDING to ACTIVE upon checklist completion!");

  // --- Test 9: Document Security & Confidentiality ---
  const contractDoc = await createDocumentRecord(
    {
      employeeId: employeeSession.employeeId!,
      name: "Employment Contract 2026.pdf",
      category: DocumentCategory.CONTRACT,
      fileUrl: "docs/contracts/alex-contract.pdf",
    },
    employeeSession
  );

  // Employee can view own contract
  assert(canViewDocument(employeeSession, contractDoc), "Employee can access their own employment contract");
  // HR can view employee's contract
  assert(canViewDocument(hrSession, contractDoc), "HR can access employee contract");
  // Manager CANNOT view employee's confidential contract
  assert(!canViewDocument(managerSession, contractDoc), "Manager is strictly blocked from viewing employee's confidential contract");

  console.log(`\n🎉 HR Operations Test Suite Completed: ${passed}/${total} tests passed!\n`);
}

runHRTests()
  .catch((e) => {
    console.error("Test failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await rawPrisma.$disconnect();
  });
