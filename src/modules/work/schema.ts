import { z } from "zod";
import { ProjectType, ProjectStatus, TaskStatus } from "@prisma/client";

export const CreateClientSchema = z.object({
  name: z.string().min(1, "Client company name is required"),
  email: z.string().email("Valid email is required").optional().nullable(),
  billingAddress: z.string().optional().nullable(),
});

export type CreateClientInput = z.infer<typeof CreateClientSchema>;

export const CreateProjectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  clientId: z.string().min(1, "Client is required"),
  leadId: z.string().optional().nullable(),
  type: z.nativeEnum(ProjectType).default(ProjectType.TIME_AND_MATERIALS),
  budget: z.number().nonnegative("Budget must be non-negative").default(0),
});

export type CreateProjectInput = z.infer<typeof CreateProjectSchema>;

export const AddProjectMemberSchema = z.object({
  projectId: z.string().min(1),
  employeeId: z.string().min(1, "Employee is required"),
  allocationPct: z.number().int().min(1).max(100).default(100),
  role: z.string().default("Member"),
});

export type AddProjectMemberInput = z.infer<typeof AddProjectMemberSchema>;

export const CreateTaskSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  title: z.string().min(1, "Task title is required"),
  description: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  status: z.nativeEnum(TaskStatus).default(TaskStatus.TODO),
  estimateHours: z.number().nonnegative().default(0),
});

export type CreateTaskInput = z.infer<typeof CreateTaskSchema>;

export const MoveTaskSchema = z.object({
  taskId: z.string().min(1),
  status: z.nativeEnum(TaskStatus),
  position: z.number(),
});

export type MoveTaskInput = z.infer<typeof MoveTaskSchema>;

export const LogTimeSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  hours: z.number().positive("Hours must be greater than 0").max(24, "Cannot log more than 24 hours per day"),
  billable: z.boolean().default(true),
  description: z.string().optional().nullable(),
});

export type LogTimeInput = z.infer<typeof LogTimeSchema>;

export interface ProjectDTO {
  id: string;
  name: string;
  clientId: string;
  clientName: string;
  leadId?: string | null;
  leadName?: string | null;
  type: ProjectType;
  status: ProjectStatus;
  budget: string;
  totalLoggedHours: string;
  memberCount: number;
  taskCount: number;
  createdAt: string;
}

export interface TaskDTO {
  id: string;
  projectId: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  estimateHours: string;
  position: number;
  assignee?: { id: string; name: string; jobTitle: string } | null;
  createdAt: string;
}

export interface TimeEntryDTO {
  id: string;
  projectId: string;
  projectName: string;
  employeeId: string;
  employeeName: string;
  date: string;
  hours: string;
  billable: boolean;
  description?: string | null;
  isLocked: boolean; // true if invoiceLineItemId != null
  createdAt: string;
}

export interface WeeklyTimesheetDayDTO {
  date: string;
  dayName: string; // "Mon", "Tue", etc.
  totalHours: number;
  billableHours: number;
}

export interface WeeklyTimesheetRowDTO {
  projectId: string;
  projectName: string;
  clientName: string;
  dailyHours: { [date: string]: number };
  totalProjectHours: number;
}

export interface WeeklyTimesheetDTO {
  employeeId: string;
  weekStartDate: string;
  weekEndDate: string;
  rows: WeeklyTimesheetRowDTO[];
  days: WeeklyTimesheetDayDTO[];
  totalWeekHours: number;
  totalBillableHours: number;
}
