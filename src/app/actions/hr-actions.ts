"use server";

import { getSessionUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { requestLeave, decideLeave, cancelLeave } from "@/modules/people/leave-service";
import { startOnboarding, toggleOnboardingItem } from "@/modules/people/onboarding-service";
import { createDocumentRecord } from "@/modules/people/document-service";
import { RequestLeaveSchema, DecideLeaveSchema, CreateDocumentSchema } from "@/modules/people/schema";

export async function requestLeaveAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const rawData = {
    leaveTypeId: formData.get("leaveTypeId") as string,
    startDate: formData.get("startDate") as string,
    endDate: formData.get("endDate") as string,
    isHalfDay: formData.get("isHalfDay") === "true",
    reason: (formData.get("reason") as string) || undefined,
  };

  const parsed = RequestLeaveSchema.parse(rawData);
  await requestLeave(parsed, user);

  revalidatePath("/leave");
  return { success: true };
}

export async function decideLeaveAction(leaveRequestId: string, decision: "APPROVED" | "REJECTED") {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const parsed = DecideLeaveSchema.parse({ leaveRequestId, decision });
  await decideLeave(parsed.leaveRequestId, parsed.decision, user);

  revalidatePath("/leave");
  return { success: true };
}

export async function cancelLeaveAction(leaveRequestId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  await cancelLeave(leaveRequestId, user);
  revalidatePath("/leave");
  return { success: true };
}

export async function startOnboardingAction(employeeId: string, templateId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  await startOnboarding(employeeId, templateId, user);
  revalidatePath("/onboarding");
  return { success: true };
}

export async function toggleOnboardingItemAction(itemId: string, completed: boolean) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  await toggleOnboardingItem(itemId, completed, user);
  revalidatePath("/onboarding");
  return { success: true };
}

export async function createDocumentAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const rawData = {
    employeeId: formData.get("employeeId") as string,
    name: formData.get("name") as string,
    category: formData.get("category") as any,
    fileUrl: formData.get("fileUrl") as string,
    fileSize: formData.get("fileSize") ? parseInt(formData.get("fileSize") as string, 10) : undefined,
    mimeType: (formData.get("mimeType") as string) || undefined,
  };

  const parsed = CreateDocumentSchema.parse(rawData);
  await createDocumentRecord(parsed, user);

  revalidatePath("/documents");
  return { success: true };
}
