import { z } from "zod";
import { EmployeeStatus, Role, LeaveStatus, DocumentCategory, ChecklistStatus } from "@prisma/client";

export const CreateEmployeeSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  jobTitle: z.string().min(1, "Job title is required"),
  departmentId: z.string().optional().nullable(),
  managerId: z.string().optional().nullable(),
  role: z.nativeEnum(Role).default(Role.EMPLOYEE),
  hourlyCost: z.number().positive("Hourly cost must be positive").optional(),
  billableRate: z.number().positive("Billable rate must be positive").optional(),
  startDate: z.string().optional(),
});

export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>;

export const UpdateEmployeeSchema = z.object({
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  jobTitle: z.string().min(1).optional(),
  departmentId: z.string().nullable().optional(),
  managerId: z.string().nullable().optional(),
  status: z.nativeEnum(EmployeeStatus).optional(),
});

export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>;

export interface CompensationDTO {
  id: string;
  hourlyCost: string;
  billableRate: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
}

export interface EmployeeProfileDTO {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  jobTitle: string;
  status: EmployeeStatus;
  startDate: string;
  department?: { id: string; name: string } | null;
  manager?: { id: string; name: string; jobTitle: string } | null;
  directReports?: Array<{ id: string; name: string; jobTitle: string }>;
  role: Role;
  compensation?: CompensationDTO | null;
}

// --- Leave Schemas & DTOs ---

export const RequestLeaveSchema = z.object({
  leaveTypeId: z.string().min(1, "Leave type is required"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD"),
  isHalfDay: z.boolean().default(false),
  reason: z.string().optional(),
});

export type RequestLeaveInput = z.infer<typeof RequestLeaveSchema>;

export const DecideLeaveSchema = z.object({
  leaveRequestId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED"]),
});

export type DecideLeaveInput = z.infer<typeof DecideLeaveSchema>;

export interface LeaveBalanceDTO {
  leaveTypeId: string;
  name: string;
  annualAllowance: number;
  approvedDays: number;
  pendingDays: number;
  remainingDays: number;
}

export interface LeaveRequestDTO {
  id: string;
  employeeId: string;
  employeeName: string;
  employeeJobTitle: string;
  leaveTypeId: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  status: LeaveStatus;
  reason?: string | null;
  decidedBy?: string | null;
  decidedAt?: string | null;
  createdAt: string;
  canApprove: boolean;
}

// --- Document Schemas & DTOs ---

export const CreateDocumentSchema = z.object({
  employeeId: z.string().min(1),
  name: z.string().min(1, "Document title is required"),
  category: z.nativeEnum(DocumentCategory).default(DocumentCategory.OTHER),
  fileUrl: z.string().min(1, "File URL is required"),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
});

export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>;

export interface DocumentDTO {
  id: string;
  employeeId: string;
  employeeName: string;
  name: string;
  fileUrl: string;
  category: DocumentCategory;
  fileSize?: number | null;
  mimeType?: string | null;
  uploadedAt: string;
}

// --- Onboarding Schemas & DTOs ---

export const CreateOnboardingTemplateSchema = z.object({
  name: z.string().min(1, "Template name is required"),
  items: z.array(
    z.object({
      title: z.string().min(1, "Item title is required"),
      dayOffset: z.number().int().min(0).default(0),
      createsStarterTask: z.boolean().default(false),
    })
  ),
});

export type CreateOnboardingTemplateInput = z.infer<typeof CreateOnboardingTemplateSchema>;

export const AssignOnboardingSchema = z.object({
  employeeId: z.string().min(1, "Employee is required"),
  templateId: z.string().min(1, "Template is required"),
});

export type AssignOnboardingInput = z.infer<typeof AssignOnboardingSchema>;

export interface OnboardingItemDTO {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
  completedAt?: string | null;
}

export interface OnboardingChecklistDTO {
  id: string;
  employeeId: string;
  employeeName: string;
  templateName: string;
  status: ChecklistStatus;
  progressPct: number;
  totalItems: number;
  completedItems: number;
  items: OnboardingItemDTO[];
}
