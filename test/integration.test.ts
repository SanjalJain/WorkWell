import { rawPrisma } from "../src/lib/db";
import {
  getTeamWorkload,
  getProjectProfitability,
  syncProjectKeyResults,
  createOnboardingStarterTasks,
  getExecutiveDashboardMetrics,
} from "../src/modules/shared/service";
import {
  Role,
  LeaveStatus,
  TaskStatus,
  ProjectType,
  InvoiceStatus,
  ObjectiveLevel,
  Prisma,
} from "@prisma/client";
import { SessionUser } from "../src/lib/auth";

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ ASSERTION FAILED: ${message}`);
    throw new Error(message);
  }
  console.log(`  ✓ ${message}`);
}

async function runIntegrationTests() {
  console.log("🧪 Running Phase 6: Cross-Module Integration & Analytics Test Suite...\n");

  const org = await rawPrisma.organization.findUnique({ where: { slug: "brightwave" } });
  if (!org) throw new Error("Demo organization not found.");

  const ownerUser = await rawPrisma.user.findFirst({
    where: { role: Role.OWNER, organizationId: org.id },
    include: { employee: true },
  });
  const managerUser = await rawPrisma.user.findFirst({
    where: { role: Role.MANAGER, organizationId: org.id },
    include: { employee: true },
  });
  const employeeUser = await rawPrisma.user.findFirst({
    where: { role: Role.EMPLOYEE, email: "employee@brightwave.io" },
    include: { employee: true },
  });

  const ownerSession: SessionUser = {
    userId: ownerUser!.id,
    organizationId: org.id,
    role: Role.OWNER,
    employeeId: ownerUser!.employeeId,
    email: ownerUser!.email,
    name: "Sarah Sterling",
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

  // Pre-test cleanup of any test artifacts
  await rawPrisma.task.deleteMany({
    where: { organizationId: org.id, title: { contains: "Integration Test" } },
  });
  await rawPrisma.task.deleteMany({
    where: { organizationId: org.id, title: { contains: "Setup Local Kubernetes Cluster" } },
  });
  await rawPrisma.project.deleteMany({
    where: { organizationId: org.id, name: { contains: "Integration Project" } },
  });
  await rawPrisma.objective.deleteMany({
    where: { organizationId: org.id, title: { contains: "Integration OKR" } },
  });
  const oldInvoices = await rawPrisma.invoice.findMany({
    where: {
      organizationId: org.id,
      lineItems: { some: { description: { contains: "Integration Project" } } },
    },
    include: { lineItems: true },
  });
  for (const inv of oldInvoices) {
    await rawPrisma.timeEntry.updateMany({
      where: { invoiceLineItemId: { in: inv.lineItems.map((l) => l.id) } },
      data: { invoiceLineItemId: null },
    });
    await rawPrisma.invoiceLineItem.deleteMany({ where: { invoiceId: inv.id } });
    await rawPrisma.invoice.delete({ where: { id: inv.id } });
  }

  const oldTemplate = await rawPrisma.onboardingTemplate.findFirst({
    where: { organizationId: org.id, name: "Integration Test Engineering Template" },
    include: { checklists: true },
  });
  if (oldTemplate) {
    for (const c of oldTemplate.checklists) {
      await rawPrisma.onboardingItem.deleteMany({ where: { checklistId: c.id } });
      await rawPrisma.onboardingChecklist.delete({ where: { id: c.id } });
    }
    await rawPrisma.onboardingTemplateItem.deleteMany({ where: { templateId: oldTemplate.id } });
    await rawPrisma.onboardingTemplate.delete({ where: { id: oldTemplate.id } });
  }

  // =========================================================================
  // Test 1: Cross-Module Team Workload & Net Capacity
  // =========================================================================
  console.log("▶ 1. Team Workload & Net Working Capacity Engine");

  // Date range for standard 5 working days (Monday to Friday)
  // 2026-06-01 (Mon) to 2026-06-05 (Fri) -> 5 working days = 40 gross capacity hours
  const startStr = "2026-06-01";
  const endStr = "2026-06-05";

  const workload = await getTeamWorkload(org.id, startStr, endStr, ownerSession);
  assert(Array.isArray(workload), "Workload returns array of employee capacity DTOs");
  assert(workload.length > 0, "Active studio members returned in workload");

  const alexWorkload = workload.find((w) => w.employeeId === employeeSession.employeeId);
  assert(alexWorkload !== undefined, "Found Alex Chen in workload analysis");
  assert(
    alexWorkload!.totalCapacityHours >= 0,
    `Gross capacity computed accurately (${alexWorkload!.totalCapacityHours}h)`
  );
  assert(
    alexWorkload!.netAvailableHours <= alexWorkload!.totalCapacityHours,
    "Net available hours accurately bounded by total gross capacity"
  );

  // =========================================================================
  // Test 2: Project Profitability & Role-Guarded Financial DTO Security
  // =========================================================================
  console.log("\n▶ 2. Project Profitability & Role-Guarded Financial DTO Security");

  const client = await rawPrisma.client.findFirst({ where: { organizationId: org.id } });
  if (!client) throw new Error("No client found in demo org.");

  // Create test project
  const testProject = await rawPrisma.project.create({
    data: {
      organizationId: org.id,
      clientId: client.id,
      name: "Integration Project: Fintech Ledger",
      type: ProjectType.TIME_AND_MATERIALS,
      status: "ACTIVE",
      budget: new Prisma.Decimal(50000),
    },
  });

  // Log 10 hours for Alex Chen at project
  const entryDate = new Date("2026-05-10");
  const timeEntry = await rawPrisma.timeEntry.create({
    data: {
      organizationId: org.id,
      projectId: testProject.id,
      employeeId: employeeSession.employeeId!,
      date: entryDate,
      hours: new Prisma.Decimal(10.0),
      billable: true,
      description: "Integration test billable backend development",
    },
  });

  // Create paid invoice for this project with revenue $1,500 ($150/hr x 10h)
  const invoice = await rawPrisma.invoice.create({
    data: {
      organizationId: org.id,
      clientId: client.id,
      invoiceNumber: `INV-INT-${Date.now().toString().slice(-4)}`,
      status: InvoiceStatus.PAID,
      issueDate: new Date("2026-05-15"),
      dueDate: new Date("2026-05-30"),
      total: new Prisma.Decimal(1500),
      lineItems: {
        create: [
          {
            description: `Professional Services - ${testProject.name}`,
            hours: new Prisma.Decimal(10.0),
            rate: new Prisma.Decimal(150.0),
            amount: new Prisma.Decimal(1500.0),
            timeEntries: {
              connect: [{ id: timeEntry.id }],
            },
          },
        ],
      },
    },
  });

  // Query as OWNER -> Expect full financial visibility (Labor cost, margin $, margin %)
  const ownerProfitability = await getProjectProfitability(testProject.id, ownerSession);
  assert(ownerProfitability !== null, "Project profitability returned for Owner");
  assert(
    ownerProfitability?.canViewFinancials === true,
    "Owner has canViewFinancials = true"
  );
  assert(
    ownerProfitability?.totalBilledRevenue === 1500,
    `Billed revenue matches invoice amount: $${ownerProfitability?.totalBilledRevenue}`
  );
  assert(
    typeof ownerProfitability?.totalLaborCost === "number" && ownerProfitability.totalLaborCost > 0,
    `Owner sees exact labor cost calculated from historical hourly wage: $${ownerProfitability?.totalLaborCost}`
  );
  assert(
    typeof ownerProfitability?.grossMarginAmount === "number",
    `Owner sees gross margin amount: $${ownerProfitability?.grossMarginAmount}`
  );
  assert(
    typeof ownerProfitability?.grossMarginPct === "number",
    `Owner sees gross profit margin %: ${ownerProfitability?.grossMarginPct}%`
  );

  // Query as MANAGER -> Expect STRICT financial DTO stripping (Confidential compensation)
  const managerProfitability = await getProjectProfitability(testProject.id, managerSession);
  assert(managerProfitability !== null, "Project profitability returned for Manager");
  assert(
    managerProfitability?.canViewFinancials === false,
    "DEFENSIVE DTO CHECK: Manager has canViewFinancials = false"
  );
  assert(
    managerProfitability?.totalLaborCost === null,
    "DEFENSIVE DTO CHECK: Labor cost is strictly NULL for Manager"
  );
  assert(
    managerProfitability?.grossMarginAmount === null,
    "DEFENSIVE DTO CHECK: Gross margin amount is strictly NULL for Manager"
  );
  assert(
    managerProfitability?.grossMarginPct === null,
    "DEFENSIVE DTO CHECK: Gross margin % is strictly NULL for Manager"
  );
  assert(
    managerProfitability?.totalBilledRevenue === 1500,
    "Manager can view project operational revenue without seeing confidential employee costs"
  );

  // =========================================================================
  // Test 3: Onboarding Template Starter Task Generation
  // =========================================================================
  console.log("\n▶ 3. Onboarding Event Bus & Starter Task Generation");

  // Create template with starter task item
  const onboardingTemplate = await rawPrisma.onboardingTemplate.create({
    data: {
      organizationId: org.id,
      name: "Integration Test Engineering Template",
      items: {
        create: [
          {
            title: "Setup Local Kubernetes Cluster",
            createsStarterTask: true,
            dayOffset: 0,
          },
        ],
      },
    },
    include: { items: true },
  });

  const checklist = await rawPrisma.onboardingChecklist.create({
    data: {
      organizationId: org.id,
      employeeId: employeeSession.employeeId!,
      templateId: onboardingTemplate.id,
    },
  });

  await createOnboardingStarterTasks(checklist.id, org.id);

  const starterTasks = await rawPrisma.task.findMany({
    where: {
      organizationId: org.id,
      assigneeId: employeeSession.employeeId,
      title: { contains: "[Onboarding] Setup Local Kubernetes Cluster" },
    },
  });

  assert(
    starterTasks.length >= 1,
    `Onboarding starter task automatically created in internal project: ${starterTasks[0]?.title}`
  );
  assert(
    starterTasks[0]?.status === TaskStatus.TODO,
    "Starter task initialized with status TODO"
  );

  // =========================================================================
  // Test 4: OKR Key Result Sync with Project Completion
  // =========================================================================
  console.log("\n▶ 4. OKR & Project Automatic Key Result Sync");

  // Create an objective with a Key Result linked to testProject
  const objective = await rawPrisma.objective.create({
    data: {
      organizationId: org.id,
      title: "Integration OKR: Ship Ledger Engine",
      level: ObjectiveLevel.COMPANY,
      keyResults: {
        create: [
          {
            title: "Deliver 100% of Ledger tasks on time",
            unit: "%",
            startValue: new Prisma.Decimal(0),
            targetValue: new Prisma.Decimal(100),
            currentValue: new Prisma.Decimal(0),
            projectId: testProject.id,
          },
        ],
      },
    },
    include: { keyResults: true },
  });

  const kr = objective.keyResults[0];

  // Create 2 tasks for this project
  const task1 = await rawPrisma.task.create({
    data: {
      organizationId: org.id,
      projectId: testProject.id,
      title: "Integration Test Task 1",
      status: TaskStatus.TODO,
      position: 1.0,
    },
  });
  const task2 = await rawPrisma.task.create({
    data: {
      organizationId: org.id,
      projectId: testProject.id,
      title: "Integration Test Task 2",
      status: TaskStatus.TODO,
      position: 2.0,
    },
  });

  // Mark 1 of 2 tasks DONE (50% progress)
  await rawPrisma.task.update({
    where: { id: task1.id },
    data: { status: TaskStatus.DONE },
  });

  await syncProjectKeyResults(testProject.id, org.id);

  const updatedKR1 = await rawPrisma.keyResult.findUnique({ where: { id: kr.id } });
  assert(
    Number(updatedKR1?.currentValue) === 50,
    `OKR Key Result updated automatically to 50% on partial task completion (${updatedKR1?.currentValue})`
  );

  // Mark 2nd task DONE (100% progress)
  await rawPrisma.task.update({
    where: { id: task2.id },
    data: { status: TaskStatus.DONE },
  });

  await syncProjectKeyResults(testProject.id, org.id);

  const updatedKR2 = await rawPrisma.keyResult.findUnique({ where: { id: kr.id } });
  assert(
    Number(updatedKR2?.currentValue) === 100,
    `OKR Key Result updated automatically to 100% on full project completion (${updatedKR2?.currentValue})`
  );

  // =========================================================================
  // Test 5: Executive Dashboard Full Data Aggregation
  // =========================================================================
  console.log("\n▶ 5. Executive Dashboard Metric Rollup");

  const executiveData = await getExecutiveDashboardMetrics(org.id, ownerSession);
  assert(executiveData.metrics.activeEmployees > 0, "Dashboard returns active employee count");
  assert(executiveData.metrics.activeProjects > 0, "Dashboard returns active project count");
  assert(Array.isArray(executiveData.monthlyHoursTrend), "Dashboard returns monthly hours trend");
  assert(Array.isArray(executiveData.departmentUtilization), "Dashboard returns department utilization");
  assert(Array.isArray(executiveData.projectsProfitability), "Dashboard returns projects profitability");
  assert(Array.isArray(executiveData.teamWorkload), "Dashboard returns team workload");

  // Post-test cleanup
  await rawPrisma.invoiceLineItem.deleteMany({ where: { invoiceId: invoice.id } });
  await rawPrisma.invoice.delete({ where: { id: invoice.id } });
  await rawPrisma.timeEntry.delete({ where: { id: timeEntry.id } });
  await rawPrisma.task.deleteMany({ where: { projectId: testProject.id } });
  await rawPrisma.project.delete({ where: { id: testProject.id } });
  await rawPrisma.keyResult.delete({ where: { id: kr.id } });
  await rawPrisma.objective.delete({ where: { id: objective.id } });
  await rawPrisma.onboardingItem.deleteMany({ where: { checklistId: checklist.id } });
  await rawPrisma.onboardingChecklist.delete({ where: { id: checklist.id } });
  await rawPrisma.onboardingTemplateItem.deleteMany({ where: { templateId: onboardingTemplate.id } });
  await rawPrisma.onboardingTemplate.delete({ where: { id: onboardingTemplate.id } });
  await rawPrisma.task.deleteMany({
    where: { organizationId: org.id, title: { contains: "Setup Local Kubernetes Cluster" } },
  });

  console.log("\n✨ All Phase 6 cross-module integration tests passed successfully!\n");
}

runIntegrationTests()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await rawPrisma.$disconnect();
  });
