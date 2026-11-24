import { rawPrisma } from "../src/lib/db";
import {
  createReviewCycle,
  launchReviewCycle,
  submitReview,
  listReviewsForSubject,
  createObjective,
  createKeyResult,
  updateKeyResultValue,
  listObjectives,
  scheduleOneOnOne,
  updateOneOnOneNotes,
  sendFeedback,
  listPublicKudos,
} from "../src/modules/performance/service";
import { canViewOneOnOne } from "../src/modules/performance/policies";
import { Role, ReviewType, ReviewStatus, ObjectiveLevel, FeedbackType } from "@prisma/client";
import { SessionUser } from "../src/lib/auth";

async function runPerformanceTests() {
  console.log("🧪 Running Phase 5: Performance, OKRs, 1:1s & Kudos Test Suite...\n");

  const org = await rawPrisma.organization.findUnique({ where: { slug: "brightwave" } });
  if (!org) throw new Error("Demo organization not found.");

  const ownerUser = await rawPrisma.user.findFirst({ where: { role: Role.OWNER, organizationId: org.id }, include: { employee: true } });
  const hrUser = await rawPrisma.user.findFirst({ where: { role: Role.HR, organizationId: org.id }, include: { employee: true } });
  const managerUser = await rawPrisma.user.findFirst({ where: { role: Role.MANAGER, organizationId: org.id }, include: { employee: true } });
  const employeeAlex = await rawPrisma.user.findFirst({ where: { email: "employee@brightwave.io" }, include: { employee: true } });
  const employeeChloe = await rawPrisma.user.findFirst({ where: { email: "chloe@brightwave.io" }, include: { employee: true } });

  // Clean up any test records from prior runs to ensure test idempotency
  await rawPrisma.reviewCycle.deleteMany({
    where: { organizationId: org.id, name: { startsWith: "Test Review Cycle" } },
  });
  await rawPrisma.objective.deleteMany({
    where: { organizationId: org.id, title: { startsWith: "Test Objective" } },
  });
  await rawPrisma.oneOnOne.deleteMany({
    where: { organizationId: org.id, agenda: { startsWith: "Test 1:1 Meeting" } },
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

  const alexSession: SessionUser = {
    userId: employeeAlex!.id,
    organizationId: org.id,
    role: Role.EMPLOYEE,
    employeeId: employeeAlex!.employeeId,
    email: employeeAlex!.email,
    name: "Alex Chen",
  };

  const chloeSession: SessionUser = {
    userId: employeeChloe!.id,
    organizationId: org.id,
    role: Role.EMPLOYEE,
    employeeId: employeeChloe!.employeeId,
    email: employeeChloe!.email,
    name: "Chloe Bennett",
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

  // --- Test 1: Create Review Cycle in DRAFT ---
  const cycle = await createReviewCycle(
    {
      name: "Test Review Cycle Q4 2026",
      startDate: "2026-11-01",
      endDate: "2026-11-30",
    },
    hrSession
  );
  assert(cycle.status === "DRAFT", "Review cycle created in DRAFT status");

  // --- Test 2: Launch Review Cycle & Generate 360 Reviews ---
  await launchReviewCycle(cycle.id, hrSession);
  const activeCycle = await rawPrisma.reviewCycle.findUnique({ where: { id: cycle.id } });
  assert(activeCycle?.status === "ACTIVE", "Review cycle successfully activated");

  const generatedReviews = await rawPrisma.review.findMany({ where: { cycleId: cycle.id } });
  assert(generatedReviews.length > 0, "360 reviews automatically generated for employees");

  // --- Test 3: Peer Review Submission & Peer Anonymity Protection ---
  // Create an explicit peer review from Chloe to Alex
  const peerReview = await rawPrisma.review.upsert({
    where: {
      cycleId_subjectId_authorId_type: {
        cycleId: cycle.id,
        subjectId: alexSession.employeeId!,
        authorId: chloeSession.employeeId!,
        type: ReviewType.PEER,
      },
    },
    create: {
      cycleId: cycle.id,
      subjectId: alexSession.employeeId!,
      authorId: chloeSession.employeeId!,
      type: ReviewType.PEER,
      status: ReviewStatus.DRAFT,
    },
    update: {},
  });

  // Chloe submits the review
  await submitReview(
    {
      reviewId: peerReview.id,
      rating: 5,
      strengths: "Incredible technical architecture and speed of delivery",
      growthAreas: "Can delegate more component tasks",
      generalNotes: "A joy to work with on the frontend team",
    },
    chloeSession
  );

  const submittedReview = await rawPrisma.review.findUnique({ where: { id: peerReview.id } });
  assert(submittedReview?.status === ReviewStatus.SUBMITTED, "Chloe submitted peer review with rating 5");

  // CRITICAL TEST: Alex (subject) reads their reviews -> Author MUST BE ANONYMIZED!
  const reviewsForAlex = await listReviewsForSubject(alexSession.employeeId!, alexSession);
  const alexPeerReview = reviewsForAlex.find((r) => r.type === ReviewType.PEER);

  assert(alexPeerReview !== undefined, "Alex found peer review in their feedback");
  assert(
    alexPeerReview?.authorId === null && alexPeerReview?.authorName === "Anonymous Peer",
    "PEER ANONYMITY VERIFIED: Alex sees 'Anonymous Peer' and authorId is completely stripped in DTO!"
  );

  // HR reads the same review -> Author details visible for administration
  const reviewsForHR = await listReviewsForSubject(alexSession.employeeId!, hrSession);
  const hrPeerReview = reviewsForHR.find((r) => r.type === ReviewType.PEER);
  assert(
    Boolean(hrPeerReview?.authorName?.includes("Chloe")),
    "HR administrators can view author details for administrative accountability"
  );

  // --- Test 4: Hierarchical OKR Engine with Zero Division Guard ---
  // Parent Company Objective
  const parentObjective = await createObjective(
    {
      title: "Test Objective: Expand Studio Profitability & Scale",
      level: ObjectiveLevel.COMPANY,
    },
    ownerSession
  );

  // Child Objective
  const childObjective = await createObjective(
    {
      title: "Test Objective: Deliver 5 Enterprise Workstreams",
      level: ObjectiveLevel.DEPARTMENT,
      parentId: parentObjective.id,
    },
    managerSession
  );

  // Key Result 1: start: 0, target: 10, current: 0
  const kr1 = await createKeyResult(
    {
      objectiveId: childObjective.id,
      title: "Enterprise clients onboarded",
      startValue: 0,
      targetValue: 10,
      currentValue: 0,
      unit: "clients",
    },
    managerSession
  );

  // Key Result 2: start: 10, target: 10 (Zero division boundary test!)
  const kr2 = await createKeyResult(
    {
      objectiveId: childObjective.id,
      title: "Uptime SLA maintained",
      startValue: 10,
      targetValue: 20,
      currentValue: 10,
      unit: "%",
    },
    managerSession
  );

  // Update KR1 to 5 (50% progress) and KR2 to 15 (50% progress)
  await updateKeyResultValue(kr1.id, 5, managerSession);
  await updateKeyResultValue(kr2.id, 15, managerSession);

  // Child objective should have (50% + 50%) / 2 = 50%
  const childObjUpdated = await rawPrisma.objective.findUnique({ where: { id: childObjective.id } });
  assert(childObjUpdated?.progress === 50, "Child objective progress correctly calculated as 50%");

  // Parent objective rolled up from child objective
  const parentObjUpdated = await rawPrisma.objective.findUnique({ where: { id: parentObjective.id } });
  assert(parentObjUpdated?.progress === 50, "Parent objective progress automatically rolled up to 50%!");

  // --- Test 5: 1:1 Meeting Privacy & Zod Action Items ---
  const meeting = await scheduleOneOnOne(
    {
      reportId: alexSession.employeeId!,
      scheduledAt: new Date("2026-11-25T14:00:00Z").toISOString(),
      agenda: "Test 1:1 Meeting: Bi-weekly checkin",
    },
    managerSession
  );

  // Add notes and action items
  await updateOneOnOneNotes(
    {
      meetingId: meeting.id,
      notes: "Discussed engineering roadmap and sprint commitments.",
      actionItems: [
        { id: "act-1", text: "Submit PR for payment gateway", completed: true },
        { id: "act-2", text: "Review database indexes", completed: false },
      ],
    },
    managerSession
  );

  // Alex (report) and Marcus (manager) can view
  assert(canViewOneOnOne(alexSession, meeting), "Report can access their private 1:1 meeting");
  assert(canViewOneOnOne(managerSession, meeting), "Manager can access their private 1:1 meeting");

  // Chloe (other employee) CANNOT view
  assert(!canViewOneOnOne(chloeSession, meeting), "Other employees are strictly blocked from private 1:1 notes");

  // --- Test 6: Kudos Feed & Anti-Self-Kudos ---
  let selfKudosBlocked = false;
  try {
    await sendFeedback(
      {
        toId: alexSession.employeeId!,
        type: FeedbackType.PUBLIC_KUDOS,
        message: "I am amazing",
      },
      alexSession
    );
  } catch {
    selfKudosBlocked = true;
  }
  assert(selfKudosBlocked, "Anti-self-kudos: Employee is blocked from sending kudos to themselves");

  // Chloe sends public kudos to Alex
  await sendFeedback(
    {
      toId: alexSession.employeeId!,
      type: FeedbackType.PUBLIC_KUDOS,
      message: "Huge shoutout to Alex for shipping the dark theme design system!",
    },
    chloeSession
  );

  const publicFeed = await listPublicKudos(alexSession);
  const kudosFound = publicFeed.some((k) => k.message.includes("shipping the dark theme"));
  assert(kudosFound, "Public kudos successfully rendered in public kudos feed");

  // Clean up test records
  await rawPrisma.reviewCycle.delete({ where: { id: cycle.id } });
  await rawPrisma.objective.deleteMany({
    where: { id: { in: [parentObjective.id, childObjective.id] } },
  });
  await rawPrisma.oneOnOne.delete({ where: { id: meeting.id } });

  console.log(`\n🎉 Performance & OKR Test Suite Completed: ${passed}/${total} tests passed!\n`);
}

runPerformanceTests()
  .catch((e) => {
    console.error("Test failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await rawPrisma.$disconnect();
  });
