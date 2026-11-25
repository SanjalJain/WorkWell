import { rawPrisma } from "@/lib/db";
import { withTenant } from "@/lib/tenant";
import { SessionUser } from "@/lib/auth";
import { canManageReviewCycle, canViewReview, canViewOneOnOne, canManageObjective } from "./policies";
import {
  CreateReviewCycleInput,
  SubmitReviewInput,
  CreateObjectiveInput,
  CreateKeyResultInput,
  UpdateKeyResultInput,
  ScheduleOneOnOneInput,
  UpdateOneOnOneInput,
  SendFeedbackInput,
  ReviewDTO,
  ReviewCycleDTO,
  ObjectiveDTO,
  KeyResultDTO,
  OneOnOneDTO,
  FeedbackDTO,
} from "./schema";
import { logAudit } from "@/lib/audit";
import {
  Prisma,
  Role,
  ReviewType,
  ReviewStatus,
  ReviewCycleStatus,
  ObjectiveLevel,
  FeedbackType,
  EmployeeStatus,
} from "@prisma/client";

// ==========================================
// 1. PERFORMANCE REVIEWS & 360 CYCLES
// ==========================================

export async function createReviewCycle(input: CreateReviewCycleInput, user: SessionUser) {
  if (!canManageReviewCycle(user)) {
    throw new Error("Unauthorized to create review cycles");
  }

  return withTenant(user.organizationId, async (tx) => {
    return tx.reviewCycle.create({
      data: {
        organizationId: user.organizationId,
        name: input.name,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        status: ReviewCycleStatus.DRAFT,
      },
    });
  });
}

/**
 * Launches an active review cycle and snapshots 360 reviews (Self, Manager, and Peers)
 * for all active employees in the organization.
 */
export async function launchReviewCycle(cycleId: string, user: SessionUser) {
  if (!canManageReviewCycle(user)) {
    throw new Error("Unauthorized to launch review cycles");
  }

  const cycle = await rawPrisma.reviewCycle.findFirst({
    where: { id: cycleId, organizationId: user.organizationId },
  });
  if (!cycle) throw new Error("Review cycle not found");

  const employees = await rawPrisma.employee.findMany({
    where: { organizationId: user.organizationId, status: EmployeeStatus.ACTIVE },
    select: { id: true, managerId: true, departmentId: true },
  });

  return withTenant(user.organizationId, async (tx) => {
    // 1. Set cycle status to ACTIVE
    await tx.reviewCycle.update({
      where: { id: cycleId },
      data: { status: ReviewCycleStatus.ACTIVE },
    });

    // 2. Generate review rows
    for (const emp of employees) {
      // (a) Self review
      await tx.review.upsert({
        where: {
          cycleId_subjectId_authorId_type: {
            cycleId,
            subjectId: emp.id,
            authorId: emp.id,
            type: ReviewType.SELF,
          },
        },
        create: {
          cycleId,
          subjectId: emp.id,
          authorId: emp.id,
          type: ReviewType.SELF,
          status: ReviewStatus.DRAFT,
        },
        update: {},
      });

      // (b) Manager review (if employee has a manager)
      if (emp.managerId) {
        await tx.review.upsert({
          where: {
            cycleId_subjectId_authorId_type: {
              cycleId,
              subjectId: emp.id,
              authorId: emp.managerId,
              type: ReviewType.MANAGER,
            },
          },
          create: {
            cycleId,
            subjectId: emp.id,
            authorId: emp.managerId,
            type: ReviewType.MANAGER,
            status: ReviewStatus.DRAFT,
          },
          update: {},
        });
      }

      // (c) Peer review (peers in the same department)
      const peers = employees.filter(
        (p) => p.id !== emp.id && p.departmentId === emp.departmentId
      );
      for (const peer of peers.slice(0, 2)) {
        await tx.review.upsert({
          where: {
            cycleId_subjectId_authorId_type: {
              cycleId,
              subjectId: emp.id,
              authorId: peer.id,
              type: ReviewType.PEER,
            },
          },
          create: {
            cycleId,
            subjectId: emp.id,
            authorId: peer.id,
            type: ReviewType.PEER,
            status: ReviewStatus.DRAFT,
          },
          update: {},
        });
      }
    }

    await logAudit(
      {
        organizationId: user.organizationId,
        userId: user.userId,
        action: "LAUNCH_REVIEW_CYCLE",
        entity: "ReviewCycle",
        entityId: cycleId,
      },
      tx
    );

    return { success: true, cycleId };
  });
}

/**
 * Closes an active review cycle, finalizing all submissions.
 */
export async function closeReviewCycle(cycleId: string, user: SessionUser) {
  if (!canManageReviewCycle(user)) {
    throw new Error("Unauthorized to close review cycle");
  }

  const cycle = await rawPrisma.reviewCycle.findFirst({
    where: { id: cycleId, organizationId: user.organizationId },
  });
  if (!cycle) throw new Error("Review cycle not found");

  return withTenant(user.organizationId, async (tx) => {
    const updated = await tx.reviewCycle.update({
      where: { id: cycleId },
      data: { status: ReviewCycleStatus.COMPLETED },
    });

    await logAudit(
      {
        organizationId: user.organizationId,
        userId: user.userId,
        action: "CLOSE_REVIEW_CYCLE",
        entity: "ReviewCycle",
        entityId: cycleId,
      },
      tx
    );

    return updated;
  });
}

/**
 * Submits a completed review with ratings and structured feedback.
 * Rejects writes if the cycle is inactive or closed.
 */
export async function submitReview(input: SubmitReviewInput, user: SessionUser) {
  if (!user.employeeId) throw new Error("Only employees can submit reviews");

  const review = await rawPrisma.review.findUnique({
    where: { id: input.reviewId },
    include: { cycle: true },
  });

  if (!review) throw new Error("Review not found");

  // Cycle status enforcement
  if (review.cycle.status !== ReviewCycleStatus.ACTIVE) {
    throw new Error("Cannot submit reviews: This review cycle is not currently active");
  }

  // Author identity verification
  if (review.authorId !== user.employeeId) {
    throw new Error("You are not the designated author of this review");
  }

  // Submissions are locked once completed
  if (review.status === ReviewStatus.SUBMITTED) {
    throw new Error("This review has already been submitted and is locked");
  }

  const contentJson = {
    strengths: input.strengths,
    growthAreas: input.growthAreas,
    generalNotes: input.generalNotes ?? "",
  };

  return withTenant(user.organizationId, async (tx) => {
    return tx.review.update({
      where: { id: input.reviewId },
      data: {
        status: ReviewStatus.SUBMITTED,
        rating: input.rating,
        content: contentJson,
        submittedAt: new Date(),
      },
    });
  });
}

/**
 * Lists reviews for an employee, strictly anonymizing peer review authors in the DTO layer.
 */
export async function listReviewsForSubject(
  subjectId: string,
  user: SessionUser
): Promise<ReviewDTO[]> {
  const subject = await rawPrisma.employee.findUnique({
    where: { id: subjectId },
    select: { managerId: true, organizationId: true },
  });

  if (!subject || subject.organizationId !== user.organizationId) {
    return [];
  }

  const reviews = await rawPrisma.review.findMany({
    where: { subjectId },
    include: {
      cycle: { select: { name: true } },
      subject: { select: { firstName: true, lastName: true } },
      author: { select: { firstName: true, lastName: true } },
    },
    orderBy: [{ type: "asc" }, { createdAt: "desc" }],
  });

  const isPrivileged = user.role === Role.OWNER || user.role === Role.HR;

  return reviews
    .filter((r) => canViewReview(user, r, subject?.managerId))
    .map((r) => {
      const isAuthor = user.employeeId === r.authorId;
      const isPeer = r.type === ReviewType.PEER;

      // CRITICAL SECURITY RULE: Peer reviews must NEVER leak author identity to the subject
      const shouldAnonymize = isPeer && !isPrivileged && !isAuthor;

      return {
        id: r.id,
        cycleId: r.cycleId,
        cycleName: r.cycle.name,
        subjectId: r.subjectId,
        subjectName: `${r.subject.firstName} ${r.subject.lastName}`,
        authorId: shouldAnonymize ? null : r.authorId,
        authorName: shouldAnonymize ? "Anonymous Peer" : `${r.author.firstName} ${r.author.lastName}`,
        type: r.type,
        status: r.status,
        rating: r.rating,
        content: r.content as Record<string, unknown> | null,
        submittedAt: r.submittedAt ? r.submittedAt.toISOString() : null,
        isSelf: r.subjectId === user.employeeId,
      };
    });
}

export async function listReviewCycles(user: SessionUser): Promise<ReviewCycleDTO[]> {
  const cycles = await rawPrisma.reviewCycle.findMany({
    where: { organizationId: user.organizationId },
    include: {
      reviews: { select: { status: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return cycles.map((c) => {
    const totalReviews = c.reviews.length;
    const completedReviews = c.reviews.filter((r) => r.status === ReviewStatus.SUBMITTED).length;
    const progressPct = totalReviews > 0 ? Math.round((completedReviews / totalReviews) * 100) : 0;

    return {
      id: c.id,
      name: c.name,
      status: c.status,
      startDate: c.startDate.toISOString().split("T")[0],
      endDate: c.endDate.toISOString().split("T")[0],
      totalReviews,
      completedReviews,
      progressPct,
    };
  });
}

// ==========================================
// 2. HIERARCHICAL OKR ENGINE
// ==========================================

/**
 * Checks if setting newParentId for objectiveId would create a circular OKR loop.
 */
export async function wouldCreateObjectiveCycle(
  objectiveId: string,
  newParentId: string
): Promise<boolean> {
  if (objectiveId === newParentId) return true;

  let currentId: string | null = newParentId;
  const visited = new Set<string>([objectiveId]);

  while (currentId) {
    if (visited.has(currentId)) return true;
    visited.add(currentId);

    const parent: { parentId: string | null } | null = await rawPrisma.objective.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    currentId = parent?.parentId ?? null;
  }

  return false;
}

export async function createObjective(input: CreateObjectiveInput, user: SessionUser) {
  if (!canManageObjective(user, { level: input.level, ownerId: input.ownerId })) {
    throw new Error("Unauthorized to create this objective");
  }

  if (input.parentId) {
    const parent = await rawPrisma.objective.findFirst({
      where: { id: input.parentId, organizationId: user.organizationId },
    });
    if (!parent) throw new Error("Parent objective not found in organization");
  }

  return withTenant(user.organizationId, async (tx) => {
    return tx.objective.create({
      data: {
        organizationId: user.organizationId,
        title: input.title,
        level: input.level,
        ownerId: input.ownerId ?? null,
        parentId: input.parentId ?? null,
        progress: 0,
      },
    });
  });
}

export async function createKeyResult(input: CreateKeyResultInput, user: SessionUser) {
  const objective = await rawPrisma.objective.findFirst({
    where: { id: input.objectiveId, organizationId: user.organizationId },
  });
  if (!objective) throw new Error("Objective not found");

  if (!canManageObjective(user, objective)) {
    throw new Error("Unauthorized to create key results for this objective");
  }

  if (input.targetValue === input.startValue) {
    throw new Error("Target value must be different from start value");
  }

  return withTenant(user.organizationId, async (tx) => {
    const kr = await tx.keyResult.create({
      data: {
        objectiveId: input.objectiveId,
        title: input.title,
        startValue: new Prisma.Decimal(input.startValue),
        targetValue: new Prisma.Decimal(input.targetValue),
        currentValue: new Prisma.Decimal(input.currentValue),
        unit: input.unit,
        projectId: input.projectId ?? null,
      },
    });

    // Recompute objective progress
    await recalculateObjectiveProgress(input.objectiveId, tx);

    return kr;
  });
}

/**
 * Updates a Key Result value with division-by-zero protection and parent objective rollup.
 */
export async function updateKeyResultValue(
  keyResultId: string,
  currentValue: number,
  user: SessionUser
) {
  const kr = await rawPrisma.keyResult.findUnique({
    where: { id: keyResultId },
    include: { objective: true },
  });
  if (!kr || kr.objective.organizationId !== user.organizationId) {
    throw new Error("Key result not found");
  }

  if (!canManageObjective(user, kr.objective)) {
    throw new Error("Unauthorized to update key result for this objective");
  }

  return withTenant(user.organizationId, async (tx) => {
    await tx.keyResult.update({
      where: { id: keyResultId },
      data: { currentValue: new Prisma.Decimal(currentValue) },
    });

    await recalculateObjectiveProgress(kr.objectiveId, tx);
    return { success: true };
  });
}

/**
 * Recalculates an objective's progress from its key results and rolls up to parent objectives.
 */
async function recalculateObjectiveProgress(objectiveId: string, tx: Prisma.TransactionClient) {
  const [keyResults, children] = await Promise.all([
    tx.keyResult.findMany({ where: { objectiveId } }),
    tx.objective.findMany({ where: { parentId: objectiveId } }),
  ]);

  let objectiveProgress = 0;

  if (keyResults.length > 0) {
    const sumProgress = keyResults.reduce((sum, kr) => {
      const start = Number(kr.startValue);
      const target = Number(kr.targetValue);
      const current = Number(kr.currentValue);

      // Division by zero protection!
      if (target === start) {
        return sum + (current >= target ? 1.0 : 0.0);
      }

      // Formula: (current - start) / (target - start), clamped to 0.0 - 1.0
      const krPct = Math.max(0.0, Math.min(1.0, (current - start) / (target - start)));
      return sum + krPct;
    }, 0);

    objectiveProgress = Math.round((sumProgress / keyResults.length) * 100);
  } else if (children.length > 0) {
    // Parent objectives take the average progress of their child objectives
    const sumChildren = children.reduce((sum, c) => sum + c.progress, 0);
    objectiveProgress = Math.round(sumChildren / children.length);
  }

  const updatedObj = await tx.objective.update({
    where: { id: objectiveId },
    data: { progress: objectiveProgress },
    select: { parentId: true },
  });

  // Roll up to grandparent objective if exists
  if (updatedObj.parentId) {
    await recalculateObjectiveProgress(updatedObj.parentId, tx);
  }
}

function computeOkrStatus(
  progress: number,
  createdAt: Date
): "ON_TRACK" | "AT_RISK" | "BEHIND" | "COMPLETED" {
  if (progress >= 100) return "COMPLETED";

  const elapsedDays = Math.max(1, (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  const expectedProgress = Math.min(100, Math.round((elapsedDays / 90) * 100));

  if (progress >= expectedProgress * 0.8) return "ON_TRACK";
  if (progress >= expectedProgress * 0.4) return "AT_RISK";
  return "BEHIND";
}

export async function updateObjectiveParent(
  objectiveId: string,
  newParentId: string | null,
  user: SessionUser
) {
  const objective = await rawPrisma.objective.findFirst({
    where: { id: objectiveId, organizationId: user.organizationId },
  });
  if (!objective) throw new Error("Objective not found");

  if (!canManageObjective(user, objective)) {
    throw new Error("Unauthorized to manage this objective");
  }

  if (newParentId) {
    const parent = await rawPrisma.objective.findFirst({
      where: { id: newParentId, organizationId: user.organizationId },
    });
    if (!parent) throw new Error("Parent objective not found in organization");

    const createsCycle = await wouldCreateObjectiveCycle(objectiveId, newParentId);
    if (createsCycle) {
      throw new Error("Circular objective hierarchy detected: an objective cannot be its own ancestor");
    }
  }

  return withTenant(user.organizationId, async (tx) => {
    const updated = await tx.objective.update({
      where: { id: objectiveId },
      data: { parentId: newParentId },
    });

    if (newParentId) {
      await recalculateObjectiveProgress(newParentId, tx);
    }
    return updated;
  });
}

export async function listObjectives(user: SessionUser): Promise<ObjectiveDTO[]> {
  const objectives = await rawPrisma.objective.findMany({
    where: { organizationId: user.organizationId },
    include: {
      owner: { select: { firstName: true, lastName: true } },
      parent: { select: { title: true } },
      keyResults: {
        include: { project: { select: { name: true } } },
      },
    },
    orderBy: [{ level: "asc" }, { createdAt: "desc" }],
  });

  return objectives.map((obj) => ({
    id: obj.id,
    title: obj.title,
    level: obj.level,
    progressPct: obj.progress,
    status: computeOkrStatus(obj.progress, obj.createdAt),
    ownerId: obj.ownerId,
    ownerName: obj.owner ? `${obj.owner.firstName} ${obj.owner.lastName}` : null,
    parentId: obj.parentId,
    parentTitle: obj.parent?.title ?? null,
    keyResults: obj.keyResults.map((kr) => {
      const start = Number(kr.startValue);
      const target = Number(kr.targetValue);
      const current = Number(kr.currentValue);
      const krPct =
        target === start
          ? current >= target ? 100 : 0
          : Math.round(Math.max(0, Math.min(1, (current - start) / (target - start))) * 100);

      return {
        id: kr.id,
        title: kr.title,
        startValue: start,
        targetValue: target,
        currentValue: current,
        unit: kr.unit,
        progressPct: krPct,
        projectId: kr.projectId,
        projectName: kr.project?.name,
      };
    }),
  }));
}

// ==========================================
// 3. 1:1 MEETINGS & ACTION ITEMS
// ==========================================

export async function scheduleOneOnOne(input: ScheduleOneOnOneInput, user: SessionUser) {
  if (!user.employeeId) throw new Error("Only employees can schedule 1:1 meetings");

  const report = await rawPrisma.employee.findUnique({
    where: { id: input.reportId },
    select: { organizationId: true },
  });
  if (!report || report.organizationId !== user.organizationId) {
    throw new Error("Report not found in organization");
  }

  return withTenant(user.organizationId, async (tx) => {
    return tx.oneOnOne.create({
      data: {
        organizationId: user.organizationId,
        managerId: user.employeeId!,
        reportId: input.reportId,
        scheduledAt: new Date(input.scheduledAt),
        agenda: input.agenda ?? "Bi-weekly check-in & priority alignment",
        actionItems: [],
      },
    });
  });
}

export async function updateOneOnOneNotes(input: UpdateOneOnOneInput, user: SessionUser) {
  const meeting = await rawPrisma.oneOnOne.findUnique({
    where: { id: input.meetingId },
  });
  if (!meeting || meeting.organizationId !== user.organizationId) {
    throw new Error("Meeting not found");
  }

  if (!canViewOneOnOne(user, meeting)) {
    throw new Error("Unauthorized to access or edit this 1:1 meeting");
  }

  return withTenant(user.organizationId, async (tx) => {
    return tx.oneOnOne.update({
      where: { id: input.meetingId },
      data: {
        agenda: input.agenda,
        notes: input.notes,
        actionItems: input.actionItems as Prisma.InputJsonValue,
      },
    });
  });
}

export async function listOneOnOnes(user: SessionUser): Promise<OneOnOneDTO[]> {
  if (!user.employeeId) return [];

  const meetings = await rawPrisma.oneOnOne.findMany({
    where: {
      organizationId: user.organizationId,
      OR: [
        { managerId: user.employeeId },
        { reportId: user.employeeId },
      ],
    },
    include: {
      manager: { select: { firstName: true, lastName: true } },
      report: { select: { firstName: true, lastName: true } },
    },
    orderBy: { scheduledAt: "desc" },
  });

  return meetings.map((m) => ({
    id: m.id,
    managerId: m.managerId,
    managerName: `${m.manager.firstName} ${m.manager.lastName}`,
    reportId: m.reportId,
    reportName: `${m.report.firstName} ${m.report.lastName}`,
    scheduledAt: m.scheduledAt.toISOString(),
    status: m.status,
    agenda: m.agenda,
    notes: m.notes,
    actionItems: (m.actionItems as any) || [],
  }));
}

// ==========================================
// 4. KUDOS FEED & PRIVATE PEER FEEDBACK
// ==========================================

export async function sendFeedback(input: SendFeedbackInput, user: SessionUser) {
  if (!user.employeeId) throw new Error("Only employees can exchange feedback");

  // Anti-self-kudos protection
  if (user.employeeId === input.toId) {
    throw new Error("You cannot send feedback or kudos to yourself");
  }

  const recipient = await rawPrisma.employee.findUnique({
    where: { id: input.toId },
    select: { organizationId: true },
  });
  if (!recipient || recipient.organizationId !== user.organizationId) {
    throw new Error("Recipient not found in organization");
  }

  return withTenant(user.organizationId, async (tx) => {
    return tx.feedback.create({
      data: {
        organizationId: user.organizationId,
        fromId: user.employeeId!,
        toId: input.toId,
        type: input.type,
        message: input.message,
      },
    });
  });
}

/**
 * Lists public kudos visible to the entire organization.
 * Private feedback is strictly excluded from this query!
 */
export async function listPublicKudos(user: SessionUser): Promise<FeedbackDTO[]> {
  const kudos = await rawPrisma.feedback.findMany({
    where: {
      organizationId: user.organizationId,
      type: FeedbackType.PUBLIC_KUDOS,
    },
    include: {
      sender: { select: { firstName: true, lastName: true } },
      receiver: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  return kudos.map((k) => ({
    id: k.id,
    fromId: k.fromId,
    fromName: `${k.sender.firstName} ${k.sender.lastName}`,
    toId: k.toId,
    toName: `${k.receiver.firstName} ${k.receiver.lastName}`,
    type: k.type,
    message: k.message,
    createdAt: k.createdAt.toISOString().split("T")[0],
  }));
}

/**
 * Lists private feedback sent directly to or from the current employee.
 * Strict privacy isolation: Never exposed to organizational peers or public feeds.
 */
export async function listPrivateFeedback(user: SessionUser): Promise<FeedbackDTO[]> {
  if (!user.employeeId) return [];

  const feedback = await rawPrisma.feedback.findMany({
    where: {
      organizationId: user.organizationId,
      type: FeedbackType.PRIVATE_FEEDBACK,
      OR: [{ toId: user.employeeId }, { fromId: user.employeeId }],
    },
    include: {
      sender: { select: { firstName: true, lastName: true } },
      receiver: { select: { firstName: true, lastName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return feedback.map((f) => ({
    id: f.id,
    fromId: f.fromId,
    fromName: `${f.sender.firstName} ${f.sender.lastName}`,
    toId: f.toId,
    toName: `${f.receiver.firstName} ${f.receiver.lastName}`,
    type: f.type,
    message: f.message,
    createdAt: f.createdAt.toISOString().split("T")[0],
  }));
}
