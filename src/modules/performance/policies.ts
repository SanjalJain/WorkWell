import { Role, ReviewType, ReviewCycleStatus } from "@prisma/client";
import { SessionUser } from "@/lib/auth";

/**
 * Authorization policy for launching or closing performance review cycles.
 * - OWNER and HR have administrative cycle management permissions.
 */
export function canManageReviewCycle(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.role === Role.OWNER || user.role === Role.HR;
}

/**
 * Authorization policy for viewing performance reviews.
 * - OWNER and HR can view all submitted reviews.
 * - Managers can view reviews for their direct reports once submitted.
 * - The subject (employee) can view:
 *   - Their own self review
 *   - Submitted peer reviews (anonymized in DTO)
 *   - Manager review (once cycle is completed or manager submitted)
 * - Authors can view their own draft or submitted reviews.
 */
export function canViewReview(
  user: SessionUser | null,
  review: {
    subjectId: string;
    authorId: string;
    type: ReviewType;
    status: string;
  },
  subjectManagerId?: string | null
): boolean {
  if (!user || user.role === Role.CLIENT) return false;
  if (user.role === Role.OWNER || user.role === Role.HR) return true;

  if (user.employeeId) {
    // Author can view what they authored
    if (review.authorId === user.employeeId) return true;

    // Subject can view if submitted
    if (review.subjectId === user.employeeId && review.status === "SUBMITTED") {
      return true;
    }

    // Direct manager can view reports' reviews
    if (user.role === Role.MANAGER && subjectManagerId === user.employeeId) {
      return true;
    }
  }

  return false;
}

/**
 * Authorization policy for viewing 1:1 meeting agendas and private notes.
 * STRICT: 1:1 notes are private strictly between the Manager and the Report.
 * Even HR is blocked to protect psychological safety.
 */
export function canViewOneOnOne(
  user: SessionUser | null,
  meeting: { managerId: string; reportId: string }
): boolean {
  if (!user || !user.employeeId) return false;
  return user.employeeId === meeting.managerId || user.employeeId === meeting.reportId;
}

/**
 * Authorization policy for managing OKRs.
 * - Company OKRs: OWNER and HR
 * - Department OKRs: OWNER, HR, and Department Managers
 * - Individual OKRs: OWNER, HR, Manager, and the Objective owner
 */
export function canManageObjective(
  user: SessionUser | null,
  objective?: { ownerId?: string | null; level: string }
): boolean {
  if (!user || user.role === Role.CLIENT) return false;
  if (user.role === Role.OWNER || user.role === Role.HR) return true;

  if (!objective) return true;

  // Company level OKRs can ONLY be managed by OWNER or HR
  if (objective.level === "COMPANY") {
    return false;
  }

  // Department level OKRs can be managed by managers
  if (objective.level === "DEPARTMENT") {
    return user.role === Role.MANAGER;
  }

  // Individual OKRs: owner or manager
  if (objective.level === "INDIVIDUAL") {
    if (objective.ownerId && objective.ownerId === user.employeeId) return true;
    if (user.role === Role.MANAGER) return true;
  }

  return false;
}
