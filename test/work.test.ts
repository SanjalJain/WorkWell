import { rawPrisma } from "../src/lib/db";
import {
  createClient,
  createProject,
  addProjectMember,
  createTask,
  moveTask,
  logTime,
  deleteTimeEntry,
  getWeeklyTimesheet,
} from "../src/modules/work/service";
import { Role, ProjectStatus, TaskStatus, ProjectType } from "@prisma/client";
import { SessionUser } from "../src/lib/auth";

async function runWorkTests() {
  console.log("🧪 Running Phase 3: Work Core & Agency Operations Test Suite...\n");

  const org = await rawPrisma.organization.findUnique({ where: { slug: "brightwave" } });
  if (!org) throw new Error("Demo organization not found.");

  const ownerUser = await rawPrisma.user.findFirst({ where: { role: Role.OWNER, organizationId: org.id }, include: { employee: true } });
  const managerUser = await rawPrisma.user.findFirst({ where: { role: Role.MANAGER, organizationId: org.id }, include: { employee: true } });
  const employeeUser = await rawPrisma.user.findFirst({ where: { role: Role.EMPLOYEE, email: "employee@brightwave.io" }, include: { employee: true } });
  const unassignedUser = await rawPrisma.user.findFirst({ where: { role: Role.EMPLOYEE, email: "david@brightwave.io" }, include: { employee: true } });
  const clientUser = await rawPrisma.user.findFirst({ where: { role: Role.CLIENT, organizationId: org.id }, include: { client: true } });

  // Clean up any test projects and time entries from prior runs
  await rawPrisma.project.deleteMany({
    where: { organizationId: org.id, name: "Acme Cloud Migration & Platform" },
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

  const unassignedSession: SessionUser = {
    userId: unassignedUser!.id,
    organizationId: org.id,
    role: Role.EMPLOYEE,
    employeeId: unassignedUser!.employeeId,
    email: unassignedUser!.email,
    name: "David Kim",
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

  // --- Test 1: Create Client & Project ---
  const client = await rawPrisma.client.findFirst({ where: { organizationId: org.id } });
  assert(client !== null, "Found seeded client for Brightwave");

  const project = await createProject(
    {
      name: "Acme Cloud Migration & Platform",
      clientId: client!.id,
      leadId: managerSession.employeeId!,
      type: ProjectType.TIME_AND_MATERIALS,
      budget: 75000,
    },
    ownerSession
  );
  assert(project.id !== null && project.name === "Acme Cloud Migration & Platform", "Created project successfully");

  // Lead should automatically be added as project member
  const leadMember = await rawPrisma.projectMember.findFirst({
    where: { projectId: project.id, employeeId: managerSession.employeeId! },
  });
  assert(leadMember !== null, "Project lead automatically assigned as Project Member");

  // --- Test 2: Anti-Tampering Foreign Client Validation ---
  let foreignClientBlocked = false;
  try {
    await createProject(
      {
        name: "Malicious Project",
        clientId: "fake-foreign-client-id",
        type: ProjectType.FIXED,
        budget: 10000,
      },
      ownerSession
    );
  } catch {
    foreignClientBlocked = true;
  }
  assert(foreignClientBlocked, "Anti-tampering: Foreign client ID is rejected");

  // --- Test 3: Add Assigned Member to Project ---
  await addProjectMember(
    {
      projectId: project.id,
      employeeId: employeeSession.employeeId!,
      allocationPct: 80,
      role: "Lead Fullstack Dev",
    },
    managerSession
  );

  const empMember = await rawPrisma.projectMember.findFirst({
    where: { projectId: project.id, employeeId: employeeSession.employeeId! },
  });
  assert(empMember !== null && empMember.allocationPct === 80, "Assigned Alex Chen to project with 80% allocation");

  // --- Test 4: Kanban Task Creation & Fractional Positioning ---
  const task1 = await createTask(
    {
      projectId: project.id,
      title: "Design PostgreSQL schema & RLS policies",
      status: TaskStatus.TODO,
      assigneeId: employeeSession.employeeId!,
      estimateHours: 12,
    },
    managerSession
  );

  const task2 = await createTask(
    {
      projectId: project.id,
      title: "Implement Next.js Server Actions",
      status: TaskStatus.TODO,
      assigneeId: employeeSession.employeeId!,
      estimateHours: 8,
    },
    managerSession
  );

  assert(task2.position > task1.position, "Task 2 placed below Task 1 with higher position float");

  // Move task2 between 0 and task1.position
  const midPosition = task1.position / 2;
  await moveTask({ taskId: task2.id, status: TaskStatus.IN_PROGRESS, position: midPosition }, employeeSession);

  const updatedTask2 = await rawPrisma.task.findUnique({ where: { id: task2.id } });
  assert(
    updatedTask2?.status === TaskStatus.IN_PROGRESS && updatedTask2.position === midPosition,
    "Task fractional movement correctly updated status and position"
  );

  // --- Test 5: Time Logging - Membership Requirement ---
  let unassignedLoggingBlocked = false;
  try {
    await logTime(
      {
        projectId: project.id,
        date: "2026-09-14",
        hours: 4,
        billable: true,
      },
      unassignedSession
    );
  } catch (err: any) {
    unassignedLoggingBlocked = true;
  }
  assert(unassignedLoggingBlocked, "Unassigned employee is blocked from logging time on project");

  // Assigned employee can log time
  const timeLog1 = await logTime(
    {
      projectId: project.id,
      date: "2026-09-14",
      hours: 6.5,
      billable: true,
      description: "Implemented RLS policies & tenant extensions",
    },
    employeeSession
  );
  assert(timeLog1.id !== null, "Assigned employee successfully logged 6.5 hours of billable work");

  // --- Test 6: Time Logging - 24-hour Daily Cap ---
  let dailyCapExceeded = false;
  try {
    await logTime(
      {
        projectId: project.id,
        date: "2026-09-14", // Already has 6.5h
        hours: 20,          // 6.5 + 20 > 24
        billable: true,
      },
      employeeSession
    );
  } catch {
    dailyCapExceeded = true;
  }
  assert(dailyCapExceeded, "Daily hour cap validation blocks total hours exceeding 24 in a single day");

  // --- Test 7: Locked Time Entry Protection (Phase 4 Billing Guard) ---
  // Create an artificial invoice line item and link it to timeLog1
  const invoice = await rawPrisma.invoice.create({
    data: {
      organizationId: org.id,
      clientId: client!.id,
      invoiceNumber: `INV-TEST-${Date.now()}`,
      status: "DRAFT",
      issueDate: new Date(),
      dueDate: new Date(),
      total: 975.0,
      lineItems: {
        create: {
          description: "Engineering services",
          hours: 6.5,
          rate: 150.0,
          amount: 975.0,
        },
      },
    },
    include: { lineItems: true },
  });

  const lineItem = invoice.lineItems[0];
  await rawPrisma.timeEntry.update({
    where: { id: timeLog1.id },
    data: { invoiceLineItemId: lineItem.id },
  });

  let deleteLockedBlocked = false;
  try {
    await deleteTimeEntry(timeLog1.id, employeeSession);
  } catch (err: any) {
    deleteLockedBlocked = true;
  }
  assert(deleteLockedBlocked, "Locked time entry attached to an invoice line CANNOT be deleted or modified!");

  // Clean up invoice link
  await rawPrisma.timeEntry.update({
    where: { id: timeLog1.id },
    data: { invoiceLineItemId: null },
  });
  await rawPrisma.invoice.delete({ where: { id: invoice.id } });

  // Now delete succeeds
  await deleteTimeEntry(timeLog1.id, employeeSession);
  const deletedCheck = await rawPrisma.timeEntry.findUnique({ where: { id: timeLog1.id } });
  assert(deletedCheck === null, "Unbilled time entry can be deleted cleanly by its owner");

  // --- Test 8: Weekly Timesheet Grid Computation ---
  // Log 4 hours on Mon, 6 hours on Tue
  await logTime(
    { projectId: project.id, date: "2026-09-14", hours: 4, billable: true },
    employeeSession
  );
  await logTime(
    { projectId: project.id, date: "2026-09-15", hours: 6, billable: false },
    employeeSession
  );

  const timesheet = await getWeeklyTimesheet(employeeSession.employeeId!, "2026-09-14", employeeSession);
  assert(timesheet.totalWeekHours === 10, "Weekly timesheet total hours calculated as 10 hours");
  assert(timesheet.totalBillableHours === 4, "Weekly timesheet billable hours calculated as 4 hours");
  assert(timesheet.rows.length === 1 && timesheet.rows[0].totalProjectHours === 10, "Timesheet grouped by project with 10 total project hours");

  console.log(`\n🎉 Work Core Test Suite Completed: ${passed}/${total} tests passed!\n`);
}

runWorkTests()
  .catch((e) => {
    console.error("Test failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await rawPrisma.$disconnect();
  });
