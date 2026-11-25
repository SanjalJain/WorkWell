"use server";

import { getSessionUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { requestLeave, decideLeave, cancelLeave } from "@/modules/people/leave-service";
import { startOnboarding, toggleOnboardingItem } from "@/modules/people/onboarding-service";
import { createDocumentRecord } from "@/modules/people/document-service";
import { createEmployee, updateEmployee } from "@/modules/people/service";
import {
  RequestLeaveSchema,
  DecideLeaveSchema,
  CreateDocumentSchema,
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
} from "@/modules/people/schema";
import { storage } from "@/lib/storage";
import path from "path";

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

export async function getUploadUrlAction(filename: string, contentType: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const sanitized = path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, "_");
  const ext = path.extname(sanitized).toLowerCase();
  const allowed = [
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".csv",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".txt",
  ];
  if (!allowed.includes(ext)) {
    throw new Error(`File extension ${ext || "unknown"} is not permitted.`);
  }

  const key = `documents/${user.organizationId}/${Date.now()}-${sanitized}`;
  const uploadUrl = await storage.getSignedUploadUrl(key, contentType || "application/octet-stream");
  return { success: true, uploadUrl, key };
}

export async function createEmployeeAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const rawData = {
    firstName: formData.get("firstName") as string,
    lastName: formData.get("lastName") as string,
    email: formData.get("email") as string,
    jobTitle: formData.get("jobTitle") as string,
    departmentId: (formData.get("departmentId") as string) || undefined,
    managerId: (formData.get("managerId") as string) || undefined,
    role: (formData.get("role") as any) || undefined,
    hourlyCost: formData.get("hourlyCost") ? parseFloat(formData.get("hourlyCost") as string) : undefined,
    billableRate: formData.get("billableRate") ? parseFloat(formData.get("billableRate") as string) : undefined,
    startDate: (formData.get("startDate") as string) || undefined,
  };

  const parsed = CreateEmployeeSchema.parse(rawData);
  const result = await createEmployee(parsed, user);

  revalidatePath("/directory");
  return { success: true, employeeId: result.employee.id };
}

export async function updateEmployeeAction(id: string, formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const rawData = {
    firstName: (formData.get("firstName") as string) || undefined,
    lastName: (formData.get("lastName") as string) || undefined,
    jobTitle: (formData.get("jobTitle") as string) || undefined,
    departmentId: formData.has("departmentId") ? ((formData.get("departmentId") as string) || null) : undefined,
    managerId: formData.has("managerId") ? ((formData.get("managerId") as string) || null) : undefined,
    status: (formData.get("status") as any) || undefined,
  };

  const parsed = UpdateEmployeeSchema.parse(rawData);
  await updateEmployee(id, parsed, user);

  revalidatePath("/directory");
  revalidatePath(`/directory/${id}`);
  return { success: true };
}
