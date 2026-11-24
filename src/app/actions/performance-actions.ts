"use server";

import { getSessionUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  createReviewCycle,
  launchReviewCycle,
  submitReview,
  createObjective,
  createKeyResult,
  updateKeyResultValue,
  scheduleOneOnOne,
  updateOneOnOneNotes,
  sendFeedback,
} from "@/modules/performance/service";
import {
  CreateReviewCycleSchema,
  SubmitReviewSchema,
  CreateObjectiveSchema,
  CreateKeyResultSchema,
  UpdateKeyResultSchema,
  ScheduleOneOnOneSchema,
  UpdateOneOnOneSchema,
  SendFeedbackSchema,
} from "@/modules/performance/schema";

export async function createReviewCycleAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const raw = {
    name: formData.get("name") as string,
    startDate: formData.get("startDate") as string,
    endDate: formData.get("endDate") as string,
  };

  const parsed = CreateReviewCycleSchema.parse(raw);
  await createReviewCycle(parsed, user);

  revalidatePath("/performance");
  return { success: true };
}

export async function launchReviewCycleAction(cycleId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  await launchReviewCycle(cycleId, user);
  revalidatePath("/performance");
  return { success: true };
}

export async function submitReviewAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const raw = {
    reviewId: formData.get("reviewId") as string,
    rating: parseInt(formData.get("rating") as string, 10),
    strengths: formData.get("strengths") as string,
    growthAreas: formData.get("growthAreas") as string,
    generalNotes: (formData.get("generalNotes") as string) || undefined,
  };

  const parsed = SubmitReviewSchema.parse(raw);
  await submitReview(parsed, user);

  revalidatePath("/performance");
  return { success: true };
}

export async function createObjectiveAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const raw = {
    title: formData.get("title") as string,
    level: formData.get("level") as any,
    ownerId: (formData.get("ownerId") as string) || undefined,
    parentId: (formData.get("parentId") as string) || undefined,
  };

  const parsed = CreateObjectiveSchema.parse(raw);
  await createObjective(parsed, user);

  revalidatePath("/performance");
  return { success: true };
}

export async function createKeyResultAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const raw = {
    objectiveId: formData.get("objectiveId") as string,
    title: formData.get("title") as string,
    startValue: formData.get("startValue") ? parseFloat(formData.get("startValue") as string) : 0,
    targetValue: parseFloat(formData.get("targetValue") as string),
    currentValue: formData.get("currentValue") ? parseFloat(formData.get("currentValue") as string) : 0,
    unit: (formData.get("unit") as string) || "%",
    projectId: (formData.get("projectId") as string) || undefined,
  };

  const parsed = CreateKeyResultSchema.parse(raw);
  await createKeyResult(parsed, user);

  revalidatePath("/performance");
  return { success: true };
}

export async function updateKeyResultValueAction(keyResultId: string, currentValue: number) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const parsed = UpdateKeyResultSchema.parse({ keyResultId, currentValue });
  await updateKeyResultValue(parsed.keyResultId, parsed.currentValue, user);

  revalidatePath("/performance");
  return { success: true };
}

export async function scheduleOneOnOneAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const raw = {
    reportId: formData.get("reportId") as string,
    scheduledAt: formData.get("scheduledAt") as string,
    agenda: (formData.get("agenda") as string) || undefined,
  };

  const parsed = ScheduleOneOnOneSchema.parse(raw);
  await scheduleOneOnOne(parsed, user);

  revalidatePath("/performance");
  return { success: true };
}

export async function updateOneOnOneNotesAction(meetingId: string, notes: string, actionItems: any[]) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  await updateOneOnOneNotes({ meetingId, notes, actionItems }, user);
  revalidatePath("/performance");
  return { success: true };
}

export async function sendFeedbackAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const raw = {
    toId: formData.get("toId") as string,
    type: (formData.get("type") as any) || "PUBLIC_KUDOS",
    message: formData.get("message") as string,
  };

  const parsed = SendFeedbackSchema.parse(raw);
  await sendFeedback(parsed, user);

  revalidatePath("/performance");
  return { success: true };
}
