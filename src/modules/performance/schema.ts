import { z } from "zod";
import { ReviewType, ReviewStatus, ReviewCycleStatus, ObjectiveLevel, FeedbackType } from "@prisma/client";

// ==========================================
// 1. REVIEW SCHEMAS & DTOs
// ==========================================

export const CreateReviewCycleSchema = z.object({
  name: z.string().min(1, "Cycle name is required"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD"),
});

export type CreateReviewCycleInput = z.infer<typeof CreateReviewCycleSchema>;

export const SubmitReviewSchema = z.object({
  reviewId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  strengths: z.string().min(1, "Please provide key strengths"),
  growthAreas: z.string().min(1, "Please provide growth areas"),
  generalNotes: z.string().optional(),
});

export type SubmitReviewInput = z.infer<typeof SubmitReviewSchema>;

export interface ReviewDTO {
  id: string;
  cycleId: string;
  cycleName: string;
  subjectId: string;
  subjectName: string;
  // Anonymized in DTO for PEER reviews!
  authorId?: string | null;
  authorName?: string | null;
  type: ReviewType;
  status: ReviewStatus;
  rating?: number | null;
  content?: Record<string, unknown> | null;
  submittedAt?: string | null;
  isSelf: boolean;
}

export interface ReviewCycleDTO {
  id: string;
  name: string;
  status: ReviewCycleStatus;
  startDate: string;
  endDate: string;
  totalReviews: number;
  completedReviews: number;
  progressPct: number;
}

// ==========================================
// 2. OKR SCHEMAS & DTOs
// ==========================================

export const CreateObjectiveSchema = z.object({
  title: z.string().min(1, "Objective title is required"),
  level: z.nativeEnum(ObjectiveLevel).default(ObjectiveLevel.INDIVIDUAL),
  ownerId: z.string().optional().nullable(),
  parentId: z.string().optional().nullable(),
});

export type CreateObjectiveInput = z.infer<typeof CreateObjectiveSchema>;

export const CreateKeyResultSchema = z.object({
  objectiveId: z.string().min(1),
  title: z.string().min(1, "Key result title is required"),
  startValue: z.number().default(0),
  targetValue: z.number().positive("Target value must be greater than zero"),
  currentValue: z.number().default(0),
  unit: z.string().default("%"),
  projectId: z.string().optional().nullable(),
});

export type CreateKeyResultInput = z.infer<typeof CreateKeyResultSchema>;

export const UpdateKeyResultSchema = z.object({
  keyResultId: z.string().min(1),
  currentValue: z.number(),
});

export type UpdateKeyResultInput = z.infer<typeof UpdateKeyResultSchema>;

export interface KeyResultDTO {
  id: string;
  title: string;
  startValue: number;
  targetValue: number;
  currentValue: number;
  unit: string;
  progressPct: number;
  projectId?: string | null;
  projectName?: string | null;
}

export interface ObjectiveDTO {
  id: string;
  title: string;
  level: ObjectiveLevel;
  progressPct: number;
  ownerId?: string | null;
  ownerName?: string | null;
  parentId?: string | null;
  parentTitle?: string | null;
  status?: "ON_TRACK" | "AT_RISK" | "BEHIND" | "COMPLETED";
  keyResults: KeyResultDTO[];
}

// ==========================================
// 3. 1:1 MEETING SCHEMAS & DTOs
// ==========================================

export const ActionItemSchema = z.object({
  id: z.string(),
  text: z.string().min(1),
  completed: z.boolean(),
});

export const ScheduleOneOnOneSchema = z.object({
  reportId: z.string().min(1, "Direct report is required"),
  scheduledAt: z.string().min(1, "Meeting time is required"),
  agenda: z.string().optional(),
});

export type ScheduleOneOnOneInput = z.infer<typeof ScheduleOneOnOneSchema>;

export const UpdateOneOnOneSchema = z.object({
  meetingId: z.string().min(1),
  agenda: z.string().optional(),
  notes: z.string().optional(),
  actionItems: z.array(ActionItemSchema).optional(),
});

export type UpdateOneOnOneInput = z.infer<typeof UpdateOneOnOneSchema>;

export interface OneOnOneDTO {
  id: string;
  managerId: string;
  managerName: string;
  reportId: string;
  reportName: string;
  scheduledAt: string;
  status: string;
  agenda?: string | null;
  notes?: string | null;
  actionItems: Array<{ id: string; text: string; completed: boolean }>;
}

// ==========================================
// 4. KUDOS & FEEDBACK SCHEMAS & DTOs
// ==========================================

export const SendFeedbackSchema = z.object({
  toId: z.string().min(1, "Recipient is required"),
  type: z.nativeEnum(FeedbackType).default(FeedbackType.PUBLIC_KUDOS),
  message: z.string().min(1, "Message is required").max(1000),
});

export type SendFeedbackInput = z.infer<typeof SendFeedbackSchema>;

export interface FeedbackDTO {
  id: string;
  fromId: string;
  fromName: string;
  toId: string;
  toName: string;
  type: FeedbackType;
  message: string;
  createdAt: string;
}
