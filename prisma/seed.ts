import {
  PrismaClient,
  Role,
  EmployeeStatus,
  DocumentCategory,
  ProjectType,
  ProjectStatus,
  TaskStatus,
  InvoiceStatus,
  LeaveStatus,
  ObjectiveLevel,
  ReviewCycleStatus,
  ReviewStatus,
  ReviewType,
  FeedbackType,
  Prisma,
} from "@prisma/client";

const prisma = new PrismaClient();

export async function seedDemoData() {
  console.log("🌱 Starting comprehensive database seed for Brightwave Studio...");

  // Clean existing demo data if any
  const existingOrg = await prisma.organization.findUnique({
    where: { slug: "brightwave" },
  });

  if (existingOrg) {
    console.log("Removing existing Brightwave Studio organization and cascading data...");
    await prisma.organization.delete({
      where: { id: existingOrg.id },
    });
  }

  // 1. Create Organization
  const org = await prisma.organization.create({
    data: {
      name: "Brightwave Studio",
      slug: "brightwave",
      timezone: "America/New_York",
      isDemo: true,
      invoiceSequence: {
        create: {
          lastNumber: 1003,
        },
      },
    },
  });

  console.log(`Created Organization: ${org.name} (${org.id})`);

  // 2. Create Departments
  const deptEngineering = await prisma.department.create({
    data: { organizationId: org.id, name: "Engineering" },
  });
  const deptDesign = await prisma.department.create({
    data: { organizationId: org.id, name: "Design" },
  });
  const deptPeople = await prisma.department.create({
    data: { organizationId: org.id, name: "People & Culture" },
  });
  const deptOperations = await prisma.department.create({
    data: { organizationId: org.id, name: "Operations" },
  });

  // 3. Create Clients
  const clientAcme = await prisma.client.create({
    data: {
      organizationId: org.id,
      name: "Acme Global Industries",
      email: "billing@acmeglobal.com",
      billingAddress: "100 Innovation Way, Suite 400, New York, NY",
    },
  });
  const clientNova = await prisma.client.create({
    data: {
      organizationId: org.id,
      name: "Nova Interactive",
      email: "accounts@novainteractive.io",
      billingAddress: "50 Market St, San Francisco, CA",
    },
  });

  // 4. Create Employees & Users (5 Roles)
  // (1) OWNER: Sarah Sterling (CEO)
  const empOwner = await prisma.employee.create({
    data: {
      organizationId: org.id,
      departmentId: deptOperations.id,
      firstName: "Sarah",
      lastName: "Sterling",
      jobTitle: "Chief Executive Officer & Founder",
      status: EmployeeStatus.ACTIVE,
      startDate: new Date("2021-01-15"),
      compensations: {
        create: {
          hourlyCost: new Prisma.Decimal(120.0),
          billableRate: new Prisma.Decimal(250.0),
          effectiveFrom: new Date("2021-01-15"),
        },
      },
    },
  });
  await prisma.user.create({
    data: {
      organizationId: org.id,
      employeeId: empOwner.id,
      email: "owner@brightwave.io",
      role: Role.OWNER,
    },
  });

  // (2) HR: Elena Ramos (Head of People)
  const empHR = await prisma.employee.create({
    data: {
      organizationId: org.id,
      departmentId: deptPeople.id,
      firstName: "Elena",
      lastName: "Ramos",
      jobTitle: "Head of People & Culture",
      status: EmployeeStatus.ACTIVE,
      startDate: new Date("2021-06-01"),
      compensations: {
        create: {
          hourlyCost: new Prisma.Decimal(80.0),
          billableRate: new Prisma.Decimal(175.0),
          effectiveFrom: new Date("2021-06-01"),
        },
      },
    },
  });
  await prisma.user.create({
    data: {
      organizationId: org.id,
      employeeId: empHR.id,
      email: "hr@brightwave.io",
      role: Role.HR,
    },
  });

  // (3) MANAGER: Marcus Vance (Engineering Director)
  const empManager = await prisma.employee.create({
    data: {
      organizationId: org.id,
      departmentId: deptEngineering.id,
      firstName: "Marcus",
      lastName: "Vance",
      jobTitle: "Engineering Director",
      status: EmployeeStatus.ACTIVE,
      startDate: new Date("2022-03-15"),
      compensations: {
        create: {
          hourlyCost: new Prisma.Decimal(95.0),
          billableRate: new Prisma.Decimal(200.0),
          effectiveFrom: new Date("2022-03-15"),
        },
      },
    },
  });
  await prisma.user.create({
    data: {
      organizationId: org.id,
      employeeId: empManager.id,
      email: "manager@brightwave.io",
      role: Role.MANAGER,
    },
  });

  // (4) EMPLOYEE 1: Alex Chen (Senior Fullstack Engineer)
  const empAlex = await prisma.employee.create({
    data: {
      organizationId: org.id,
      departmentId: deptEngineering.id,
      managerId: empManager.id,
      firstName: "Alex",
      lastName: "Chen",
      jobTitle: "Senior Fullstack Engineer",
      status: EmployeeStatus.ACTIVE,
      startDate: new Date("2022-08-01"),
      compensations: {
        create: [
          {
            hourlyCost: new Prisma.Decimal(65.0),
            billableRate: new Prisma.Decimal(150.0),
            effectiveFrom: new Date("2022-08-01"),
          },
        ],
      },
    },
  });
  await prisma.user.create({
    data: {
      organizationId: org.id,
      employeeId: empAlex.id,
      email: "employee@brightwave.io",
      role: Role.EMPLOYEE,
    },
  });

  // (5) EMPLOYEE 2: Chloe Bennett (Product Designer)
  const empChloe = await prisma.employee.create({
    data: {
      organizationId: org.id,
      departmentId: deptDesign.id,
      managerId: empManager.id,
      firstName: "Chloe",
      lastName: "Bennett",
      jobTitle: "Senior Product Designer",
      status: EmployeeStatus.ACTIVE,
      startDate: new Date("2023-04-18"),
      compensations: {
        create: {
          hourlyCost: new Prisma.Decimal(55.0),
          billableRate: new Prisma.Decimal(140.0),
          effectiveFrom: new Date("2023-04-18"),
        },
      },
    },
  });
  await prisma.user.create({
    data: {
      organizationId: org.id,
      employeeId: empChloe.id,
      email: "chloe@brightwave.io",
      role: Role.EMPLOYEE,
    },
  });

  // (6) EMPLOYEE 3: David Kim (QA Engineer)
  const empDavid = await prisma.employee.create({
    data: {
      organizationId: org.id,
      departmentId: deptEngineering.id,
      managerId: empManager.id,
      firstName: "David",
      lastName: "Kim",
      jobTitle: "QA Engineer",
      status: EmployeeStatus.ACTIVE,
      startDate: new Date("2023-09-01"),
      compensations: {
        create: {
          hourlyCost: new Prisma.Decimal(45.0),
          billableRate: new Prisma.Decimal(110.0),
          effectiveFrom: new Date("2023-09-01"),
        },
      },
    },
  });
  await prisma.user.create({
    data: {
      organizationId: org.id,
      employeeId: empDavid.id,
      email: "david@brightwave.io",
      role: Role.EMPLOYEE,
    },
  });

  // (7) CLIENT: Arthur Pendelton (Acme Global)
  await prisma.user.create({
    data: {
      organizationId: org.id,
      clientId: clientAcme.id,
      email: "client@acmeglobal.com",
      role: Role.CLIENT,
    },
  });

  // 5. Leave Types & Public Holidays
  const leavePTO = await prisma.leaveType.create({
    data: { organizationId: org.id, name: "Paid Time Off (PTO)", daysAllowance: 20 },
  });
  const leaveSick = await prisma.leaveType.create({
    data: { organizationId: org.id, name: "Sick Leave", daysAllowance: 10 },
  });
  await prisma.leaveType.createMany({
    data: [
      { organizationId: org.id, name: "Parental Leave", daysAllowance: 60 },
      { organizationId: org.id, name: "Bereavement", daysAllowance: 5 },
    ],
  });

  const now = new Date();
  const curYear = now.getFullYear();
  await prisma.publicHoliday.createMany({
    data: [
      { organizationId: org.id, name: "New Year's Day", date: new Date(`${curYear}-01-01`) },
      { organizationId: org.id, name: "Memorial Day", date: new Date(`${curYear}-05-25`) },
      { organizationId: org.id, name: "Independence Day", date: new Date(`${curYear}-07-04`) },
      { organizationId: org.id, name: "Labor Day", date: new Date(`${curYear}-09-07`) },
      { organizationId: org.id, name: "Thanksgiving", date: new Date(`${curYear}-11-26`) },
      { organizationId: org.id, name: "Christmas Day", date: new Date(`${curYear}-12-25`) },
    ],
  });

  // Approved Leave history
  const currentMonth = now.getMonth();
  const leaveStartDate1 = new Date(curYear, Math.max(0, currentMonth - 1), 10);
  const leaveEndDate1 = new Date(curYear, Math.max(0, currentMonth - 1), 12);
  const leaveDecidedAt1 = new Date(curYear, Math.max(0, currentMonth - 1), 5);

  const leaveStartDate2 = new Date(curYear, currentMonth, 2);
  const leaveEndDate2 = new Date(curYear, currentMonth, 2);
  const leaveDecidedAt2 = new Date(curYear, currentMonth, 2);

  await prisma.leaveRequest.create({
    data: {
      employeeId: empAlex.id,
      leaveTypeId: leavePTO.id,
      startDate: leaveStartDate1,
      endDate: leaveEndDate1,
      daysCount: new Prisma.Decimal(3.0),
      status: LeaveStatus.APPROVED,
      decidedBy: empManager.id,
      decidedAt: leaveDecidedAt1,
      reason: "Spring recharge & family visit",
    },
  });
  await prisma.leaveRequest.create({
    data: {
      employeeId: empChloe.id,
      leaveTypeId: leaveSick.id,
      startDate: leaveStartDate2,
      endDate: leaveEndDate2,
      daysCount: new Prisma.Decimal(1.0),
      status: LeaveStatus.APPROVED,
      decidedBy: empManager.id,
      decidedAt: leaveDecidedAt2,
      reason: "Flu recovery",
    },
  });

  // 6. Projects & Project Members
  const projectAcme = await prisma.project.create({
    data: {
      organizationId: org.id,
      clientId: clientAcme.id,
      leadId: empManager.id,
      name: "Acme Cloud Migration & Platform",
      type: ProjectType.TIME_AND_MATERIALS,
      status: ProjectStatus.ACTIVE,
      budget: new Prisma.Decimal(80000.0),
      members: {
        create: [
          { employeeId: empManager.id, allocationPct: 40 },
          { employeeId: empAlex.id, allocationPct: 80 },
          { employeeId: empChloe.id, allocationPct: 40 },
          { employeeId: empDavid.id, allocationPct: 40 },
        ],
      },
    },
  });

  const projectNova = await prisma.project.create({
    data: {
      organizationId: org.id,
      clientId: clientNova.id,
      leadId: empManager.id,
      name: "Nova Interactive Brand & Web App",
      type: ProjectType.FIXED,
      status: ProjectStatus.ACTIVE,
      budget: new Prisma.Decimal(45000.0),
      members: {
        create: [
          { employeeId: empChloe.id, allocationPct: 50 },
          { employeeId: empAlex.id, allocationPct: 20 },
        ],
      },
    },
  });

  const projectInternal = await prisma.project.create({
    data: {
      organizationId: org.id,
      clientId: clientAcme.id,
      name: "Internal Onboarding & Ops",
      type: ProjectType.FIXED,
      status: ProjectStatus.ACTIVE,
      budget: new Prisma.Decimal(0),
    },
  });

  // 7. Tasks Across 5 Kanban Columns
  const tasksData = [
    {
      projectId: projectAcme.id,
      assigneeId: empAlex.id,
      title: "Design PostgreSQL schema & RLS isolation policies",
      status: TaskStatus.DONE,
      estimateHours: new Prisma.Decimal(16.0),
      position: 1.0,
    },
    {
      projectId: projectAcme.id,
      assigneeId: empAlex.id,
      title: "Implement session authentication & Dev Role Switcher",
      status: TaskStatus.DONE,
      estimateHours: new Prisma.Decimal(12.0),
      position: 2.0,
    },
    {
      projectId: projectAcme.id,
      assigneeId: empAlex.id,
      title: "Kubernetes pod autoscaling & multi-cluster helm charts",
      status: TaskStatus.IN_PROGRESS,
      estimateHours: new Prisma.Decimal(24.0),
      position: 3.0,
    },
    {
      projectId: projectAcme.id,
      assigneeId: empChloe.id,
      title: "Verdant Night design system token integration",
      status: TaskStatus.DONE,
      estimateHours: new Prisma.Decimal(20.0),
      position: 1.0,
    },
    {
      projectId: projectAcme.id,
      assigneeId: empChloe.id,
      title: "Client Portal UX & responsive mobile layout audit",
      status: TaskStatus.IN_REVIEW,
      estimateHours: new Prisma.Decimal(14.0),
      position: 2.0,
    },
    {
      projectId: projectAcme.id,
      assigneeId: empDavid.id,
      title: "E2E playwright test matrix & automated regression suite",
      status: TaskStatus.IN_PROGRESS,
      estimateHours: new Prisma.Decimal(18.0),
      position: 1.0,
    },
    {
      projectId: projectAcme.id,
      assigneeId: empManager.id,
      title: "SOC2 compliance audit prep & data retention policies",
      status: TaskStatus.TODO,
      estimateHours: new Prisma.Decimal(10.0),
      position: 1.0,
    },
    {
      projectId: projectNova.id,
      assigneeId: empChloe.id,
      title: "Nova Brand Guideline & Figma UI Kit",
      status: TaskStatus.DONE,
      estimateHours: new Prisma.Decimal(32.0),
      position: 1.0,
    },
    {
      projectId: projectNova.id,
      assigneeId: empAlex.id,
      title: "Nova interactive WebGL hero animation",
      status: TaskStatus.BACKLOG,
      estimateHours: new Prisma.Decimal(22.0),
      position: 1.0,
    },
  ];

  for (const t of tasksData) {
    await prisma.task.create({
      data: {
        organizationId: org.id,
        ...t,
      },
    });
  }

  // 8. Time Entries across past 4 months
  const pastDates = [
    new Date(now.getFullYear(), now.getMonth() - 3, 12),
    new Date(now.getFullYear(), now.getMonth() - 2, 15),
    new Date(now.getFullYear(), now.getMonth() - 1, 10),
    new Date(now.getFullYear(), now.getMonth() - 1, 18),
    new Date(now.getFullYear(), now.getMonth(), 3),
    new Date(now.getFullYear(), now.getMonth(), 8),
    new Date(now.getFullYear(), now.getMonth(), 14),
  ];

  const timeEntriesToCreate = [
    // Month -3
    { employeeId: empAlex.id, projectId: projectAcme.id, date: pastDates[0], hours: 32.0, billable: true, desc: "Architecture design & schema models" },
    { employeeId: empChloe.id, projectId: projectAcme.id, date: pastDates[0], hours: 24.0, billable: true, desc: "Design tokens and typography specifications" },
    // Month -2
    { employeeId: empAlex.id, projectId: projectAcme.id, date: pastDates[1], hours: 40.0, billable: true, desc: "Core API endpoints and tenant isolation" },
    { employeeId: empChloe.id, projectId: projectNova.id, date: pastDates[1], hours: 30.0, billable: true, desc: "Nova wireframes and interactive mockups" },
    // Month -1
    { employeeId: empAlex.id, projectId: projectAcme.id, date: pastDates[2], hours: 36.0, billable: true, desc: "Billing pipeline and time tracking integration" },
    { employeeId: empDavid.id, projectId: projectAcme.id, date: pastDates[3], hours: 28.0, billable: true, desc: "Integration test coverage & security test runs" },
    // Current month
    { employeeId: empAlex.id, projectId: projectAcme.id, date: pastDates[4], hours: 24.0, billable: true, desc: "Key result sync and executive dashboard metrics" },
    { employeeId: empChloe.id, projectId: projectAcme.id, date: pastDates[5], hours: 18.0, billable: true, desc: "Executive charts and responsive UI refinement" },
    { employeeId: empAlex.id, projectId: projectAcme.id, date: pastDates[6], hours: 8.0, billable: false, desc: "Internal code review & documentation" },
  ];

  const createdTimeEntries = [];
  for (const te of timeEntriesToCreate) {
    const entry = await prisma.timeEntry.create({
      data: {
        organizationId: org.id,
        employeeId: te.employeeId,
        projectId: te.projectId,
        date: te.date,
        hours: new Prisma.Decimal(te.hours),
        billable: te.billable,
        description: te.desc,
      },
    });
    createdTimeEntries.push(entry);
  }

  // 9. Invoices
  // Invoice 1: INV-1001 (Paid)
  const invoice1 = await prisma.invoice.create({
    data: {
      organizationId: org.id,
      clientId: clientAcme.id,
      invoiceNumber: "INV-1001",
      status: InvoiceStatus.PAID,
      issueDate: pastDates[0],
      dueDate: new Date(pastDates[0].getTime() + 14 * 24 * 60 * 60 * 1000),
      total: new Prisma.Decimal(8960.0),
      lineItems: {
        create: [
          {
            description: `Engineering & Architecture - ${projectAcme.name}`,
            hours: new Prisma.Decimal(32.0),
            rate: new Prisma.Decimal(160.0),
            amount: new Prisma.Decimal(5120.0),
            timeEntries: {
              connect: [{ id: createdTimeEntries[0].id }],
            },
          },
          {
            description: `Design Tokens & Spec - ${projectAcme.name}`,
            hours: new Prisma.Decimal(24.0),
            rate: new Prisma.Decimal(160.0),
            amount: new Prisma.Decimal(3840.0),
            timeEntries: {
              connect: [{ id: createdTimeEntries[1].id }],
            },
          },
        ],
      },
    },
  });

  // Invoice 2: INV-1002 (Sent)
  const invoice2 = await prisma.invoice.create({
    data: {
      organizationId: org.id,
      clientId: clientAcme.id,
      invoiceNumber: "INV-1002",
      status: InvoiceStatus.SENT,
      issueDate: pastDates[2],
      dueDate: new Date(now.getTime() + 10 * 24 * 60 * 60 * 1000),
      total: new Prisma.Decimal(9480.0),
      lineItems: {
        create: [
          {
            description: `Backend API & Core Services - ${projectAcme.name}`,
            hours: new Prisma.Decimal(40.0),
            rate: new Prisma.Decimal(160.0),
            amount: new Prisma.Decimal(6400.0),
            timeEntries: {
              connect: [{ id: createdTimeEntries[2].id }],
            },
          },
          {
            description: `QA Test Suite & Validation - ${projectAcme.name}`,
            hours: new Prisma.Decimal(28.0),
            rate: new Prisma.Decimal(110.0),
            amount: new Prisma.Decimal(3080.0),
            timeEntries: {
              connect: [{ id: createdTimeEntries[5].id }],
            },
          },
        ],
      },
    },
  });

  // Invoice 3: INV-1003 (Paid) for Nova Interactive
  await prisma.invoice.create({
    data: {
      organizationId: org.id,
      clientId: clientNova.id,
      invoiceNumber: "INV-1003",
      status: InvoiceStatus.PAID,
      issueDate: pastDates[1],
      dueDate: new Date(pastDates[1].getTime() + 30 * 24 * 60 * 60 * 1000),
      total: new Prisma.Decimal(4200.0),
      lineItems: {
        create: [
          {
            description: `Brand Design Sprint - ${projectNova.name}`,
            hours: new Prisma.Decimal(30.0),
            rate: new Prisma.Decimal(140.0),
            amount: new Prisma.Decimal(4200.0),
            timeEntries: {
              connect: [{ id: createdTimeEntries[3].id }],
            },
          },
        ],
      },
    },
  });

  // 10. OKRs & Key Results
  const companyObj = await prisma.objective.create({
    data: {
      organizationId: org.id,
      title: "Scale Brightwave Platform & Operational Excellence",
      level: ObjectiveLevel.COMPANY,
      progress: 68.0,
      keyResults: {
        create: [
          {
            title: "Ship 100% of Acme Cloud Migration tasks on schedule",
            unit: "%",
            startValue: new Prisma.Decimal(0),
            targetValue: new Prisma.Decimal(100),
            currentValue: new Prisma.Decimal(65),
            projectId: projectAcme.id,
          },
          {
            title: "Achieve studio billable utilization above 80%",
            unit: "%",
            startValue: new Prisma.Decimal(0),
            targetValue: new Prisma.Decimal(100),
            currentValue: new Prisma.Decimal(82),
          },
        ],
      },
    },
  });

  await prisma.objective.create({
    data: {
      organizationId: org.id,
      parentId: companyObj.id,
      title: "Elevate Design Craft & Verdant Night System",
      level: ObjectiveLevel.DEPARTMENT,
      progress: 85.0,
      keyResults: {
        create: [
          {
            title: "Complete 100% of Design System Token components",
            unit: "%",
            startValue: new Prisma.Decimal(0),
            targetValue: new Prisma.Decimal(100),
            currentValue: new Prisma.Decimal(90),
          },
        ],
      },
    },
  });

  // 11. Performance Review Cycle
  const currentQuarter = Math.floor(now.getMonth() / 3) + 1;
  const reviewCycle = await prisma.reviewCycle.create({
    data: {
      organizationId: org.id,
      name: `Q${currentQuarter} ${curYear} Studio Performance Cycle`,
      status: ReviewCycleStatus.ACTIVE,
      startDate: new Date(curYear, (currentQuarter - 1) * 3, 1),
      endDate: new Date(curYear, currentQuarter * 3, 0),
      reviews: {
        create: [
          {
            subjectId: empAlex.id,
            authorId: empAlex.id,
            type: ReviewType.SELF,
            status: ReviewStatus.SUBMITTED,
            rating: 5,
            content: { feedback: "Led the multi-tenant architecture and RLS implementation on schedule with zero security leaks." },
            submittedAt: new Date(),
          },
          {
            subjectId: empAlex.id,
            authorId: empManager.id,
            type: ReviewType.MANAGER,
            status: ReviewStatus.SUBMITTED,
            rating: 5,
            content: { feedback: "Exceptional engineering leadership and defensive coding. Alex consistently sets the bar for technical quality." },
            submittedAt: new Date(),
          },
          {
            subjectId: empAlex.id,
            authorId: empChloe.id,
            type: ReviewType.PEER,
            status: ReviewStatus.SUBMITTED,
            rating: 5,
            content: { feedback: "A joy to partner with. Translates Figma tokens into accessible React code with pixel-perfection." },
            submittedAt: new Date(),
          },
        ],
      },
    },
  });

  // 12. Public Kudos & Social Feedback
  const kudosData = [
    {
      fromId: empManager.id,
      toId: empAlex.id,
      message: "Incredible speed and defensive precision on the multi-tenant RLS isolation engine!",
    },
    {
      fromId: empChloe.id,
      toId: empDavid.id,
      message: "Huge thanks for catching that invoice line-item edge-case in QA testing before release!",
    },
    {
      fromId: empOwner.id,
      toId: empChloe.id,
      message: "The Verdant Night design tokens look world-class. Outstanding aesthetic craft!",
    },
    {
      fromId: empAlex.id,
      toId: empManager.id,
      message: "Great guidance on the fractional kanban index sorting and optimistic updates!",
    },
  ];

  for (const k of kudosData) {
    await prisma.feedback.create({
      data: {
        organizationId: org.id,
        type: FeedbackType.PUBLIC_KUDOS,
        ...k,
      },
    });
  }

  // 13. Onboarding Template & Starter Items
  await prisma.onboardingTemplate.create({
    data: {
      organizationId: org.id,
      name: "Engineering New Hire Checklist",
      items: {
        create: [
          { title: "Set up development environment and clone repos", dayOffset: 1, createsStarterTask: true },
          { title: "Review system architecture & security guidelines", dayOffset: 2, createsStarterTask: false },
          { title: "1:1 Welcome meeting with Engineering Lead", dayOffset: 3, createsStarterTask: false },
          { title: "Submit first pull request to staging", dayOffset: 5, createsStarterTask: true },
        ],
      },
    },
  });

  console.log(`\n✅ Database seed completed with rich cross-module demo data!`);
  console.log(`\nDemo Credentials:`);
  console.log(`- OWNER:    owner@brightwave.io`);
  console.log(`- HR:       hr@brightwave.io`);
  console.log(`- MANAGER:  manager@brightwave.io`);
  console.log(`- EMPLOYEE: employee@brightwave.io`);
  console.log(`- CLIENT:   client@acmeglobal.com\n`);
}

seedDemoData()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
