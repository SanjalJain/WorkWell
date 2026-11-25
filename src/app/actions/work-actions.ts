"use server";

import { getSessionUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  createClient,
  createProject,
  updateProjectStatus,
  addProjectMember,
  createTask,
  moveTask,
  logTime,
  deleteTimeEntry,
} from "@/modules/work/service";
import {
  CreateClientSchema,
  CreateProjectSchema,
  AddProjectMemberSchema,
  CreateTaskSchema,
  MoveTaskSchema,
  LogTimeSchema,
} from "@/modules/work/schema";
import { ProjectStatus } from "@prisma/client";

export async function createClientAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const raw = {
    name: formData.get("name") as string,
    email: (formData.get("email") as string) || undefined,
    billingAddress: (formData.get("billingAddress") as string) || undefined,
  };

  const parsed = CreateClientSchema.parse(raw);
  const client = await createClient(parsed, user);

  revalidatePath("/projects");
  revalidatePath("/billing");
  return { success: true, clientId: client.id };
}

export async function updateProjectStatusAction(projectId: string, status: ProjectStatus) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  await updateProjectStatus(projectId, status, user);

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function createProjectAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const raw = {
    name: formData.get("name") as string,
    clientId: formData.get("clientId") as string,
    leadId: (formData.get("leadId") as string) || undefined,
    type: formData.get("type") as any,
    budget: formData.get("budget") ? parseFloat(formData.get("budget") as string) : 0,
  };

  const parsed = CreateProjectSchema.parse(raw);
  const project = await createProject(parsed, user);

  revalidatePath("/projects");
  return { success: true, projectId: project.id };
}

export async function addProjectMemberAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const raw = {
    projectId: formData.get("projectId") as string,
    employeeId: formData.get("employeeId") as string,
    allocationPct: parseInt(formData.get("allocationPct") as string, 10),
    role: (formData.get("role") as string) || "Member",
  };

  const parsed = AddProjectMemberSchema.parse(raw);
  await addProjectMember(parsed, user);

  revalidatePath(`/projects/${parsed.projectId}`);
  return { success: true };
}

export async function createTaskAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const raw = {
    projectId: formData.get("projectId") as string,
    title: formData.get("title") as string,
    description: (formData.get("description") as string) || undefined,
    assigneeId: (formData.get("assigneeId") as string) || undefined,
    status: (formData.get("status") as any) || "TODO",
    estimateHours: formData.get("estimateHours")
      ? parseFloat(formData.get("estimateHours") as string)
      : 0,
  };

  const parsed = CreateTaskSchema.parse(raw);
  const task = await createTask(parsed, user);

  revalidatePath(`/projects/${parsed.projectId}`);
  return { success: true, taskId: task.id };
}

export async function moveTaskAction(taskId: string, status: any, position: number, projectId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const parsed = MoveTaskSchema.parse({ taskId, status, position });
  await moveTask(parsed, user);

  revalidatePath(`/projects/${projectId}`);
  return { success: true };
}

export async function logTimeAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const raw = {
    projectId: formData.get("projectId") as string,
    date: formData.get("date") as string,
    hours: parseFloat(formData.get("hours") as string),
    billable: formData.get("billable") !== "false",
    description: (formData.get("description") as string) || undefined,
  };

  const parsed = LogTimeSchema.parse(raw);
  await logTime(parsed, user);

  revalidatePath("/timesheets");
  revalidatePath(`/projects/${parsed.projectId}`);
  return { success: true };
}

export async function deleteTimeEntryAction(entryId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  await deleteTimeEntry(entryId, user);
  revalidatePath("/timesheets");
  return { success: true };
}
