import { rawPrisma } from "../src/lib/db";
import { getEmployeeProfile, listEmployees, wouldCreateManagerCycle } from "../src/modules/people/service";
import { canApproveLeave } from "../src/modules/people/policies";
import { Role } from "@prisma/client";
import { SessionUser } from "../src/lib/auth";

async function runTests() {
  console.log("🧪 Running Multi-Role RBAC & Policy Verification Suite...\n");

  const org = await rawPrisma.organization.findUnique({ where: { slug: "brightwave" } });
  if (!org) throw new Error("Demo organization not found. Run seed first.");

  // Fetch users for all 5 roles
  const ownerUser = await rawPrisma.user.findFirst({ where: { role: Role.OWNER, organizationId: org.id }, include: { employee: true } });
  const hrUser = await rawPrisma.user.findFirst({ where: { role: Role.HR, organizationId: org.id }, include: { employee: true } });
  const managerUser = await rawPrisma.user.findFirst({ where: { role: Role.MANAGER, organizationId: org.id }, include: { employee: true } });
  const employeeUser = await rawPrisma.user.findFirst({ where: { role: Role.EMPLOYEE, organizationId: org.id }, include: { employee: true } });
  const clientUser = await rawPrisma.user.findFirst({ where: { role: Role.CLIENT, organizationId: org.id } });

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

  const clientSession: SessionUser = {
    userId: clientUser!.id,
    organizationId: org.id,
    role: Role.CLIENT,
    clientId: clientUser!.clientId,
    email: clientUser!.email,
    name: "Arthur Pendelton",
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

  // --- Test 1: Compensation visibility for Owner ---
  const profileForOwner = await getEmployeeProfile(employeeUser!.employeeId!, ownerSession);
  assert(profileForOwner !== null && profileForOwner.compensation !== null, "OWNER can view employee compensation");

  // --- Test 2: Compensation visibility for HR ---
  const profileForHR = await getEmployeeProfile(employeeUser!.employeeId!, hrSession);
  assert(profileForHR !== null && profileForHR.compensation !== null, "HR can view employee compensation");

  // --- Test 3: Compensation stripped for Manager ---
  const profileForManager = await getEmployeeProfile(employeeUser!.employeeId!, managerSession);
  assert(profileForManager !== null && profileForManager.compensation === null, "MANAGER cannot view compensation (stripped in DTO)");

  // --- Test 4: Compensation stripped for Employee (even on peer view) ---
  const profileForEmp = await getEmployeeProfile(employeeUser!.employeeId!, employeeSession);
  assert(profileForEmp !== null && profileForEmp.compensation === null, "EMPLOYEE cannot view compensation (stripped in DTO)");

  // --- Test 5: Client blocked from Employee directory ---
  let clientBlocked = false;
  try {
    await listEmployees({}, clientSession);
  } catch (err: any) {
    clientBlocked = true;
  }
  assert(clientBlocked, "CLIENT role is strictly blocked from viewing Employee directory");

  // --- Test 6: Anti-Self-Approval in Leave Policy ---
  const selfApprovalAllowed = canApproveLeave(managerSession, {
    id: managerSession.employeeId!,
    managerId: ownerSession.employeeId!,
  });
  assert(!selfApprovalAllowed, "Manager CANNOT approve their own leave request (anti-self-approval rule)");

  // --- Test 7: Manager CAN approve direct report's leave ---
  const directReportApprovalAllowed = canApproveLeave(managerSession, {
    id: employeeUser!.employeeId!,
    managerId: managerSession.employeeId!,
  });
  assert(directReportApprovalAllowed, "Manager CAN approve direct report's leave request");

  // --- Test 8: Manager CANNOT approve non-report's leave ---
  const nonReportApprovalAllowed = canApproveLeave(managerSession, {
    id: hrSession.employeeId!,
    managerId: ownerSession.employeeId!,
  });
  assert(!nonReportApprovalAllowed, "Manager CANNOT approve another team member's leave request");

  // --- Test 9: Manager Cycle Prevention ---
  // Marcus manages Alex. If we try to make Marcus's manager = Alex, it MUST detect cycle!
  const isCycle = await wouldCreateManagerCycle(managerUser!.employeeId!, employeeUser!.employeeId!, org.id);
  assert(isCycle, "wouldCreateManagerCycle correctly detects circular reporting chain (Marcus -> Alex -> Marcus)");

  console.log(`\n🎉 Test Suite Completed: ${passed}/${total} tests passed!\n`);
}

runTests()
  .catch((e) => {
    console.error("Test failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await rawPrisma.$disconnect();
  });
