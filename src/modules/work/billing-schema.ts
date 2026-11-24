import { z } from "zod";
import { InvoiceStatus, ProjectType, ProjectStatus } from "@prisma/client";

export const GenerateInvoiceSchema = z.object({
  projectId: z.string().min(1, "Project is required"),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Start date must be YYYY-MM-DD"),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "End date must be YYYY-MM-DD"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Due date must be YYYY-MM-DD"),
  defaultRate: z.number().positive("Default rate must be positive").default(150),
});

export type GenerateInvoiceInput = z.infer<typeof GenerateInvoiceSchema>;

export const UpdateInvoiceStatusSchema = z.object({
  invoiceId: z.string().min(1),
  status: z.nativeEnum(InvoiceStatus),
});

export type UpdateInvoiceStatusInput = z.infer<typeof UpdateInvoiceStatusSchema>;

export interface InvoiceLineItemDTO {
  id: string;
  description: string;
  hours: string;
  rate: string;
  amount: string;
}

export interface InvoiceDTO {
  id: string;
  invoiceNumber: string;
  clientId: string;
  clientName: string;
  clientEmail?: string | null;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  total: string;
  pdfUrl?: string | null;
  lineItemsCount: number;
  totalHoursBilled: string;
  isOverdue: boolean;
  createdAt: string;
}

export interface InvoiceDetailDTO extends InvoiceDTO {
  lineItems: InvoiceLineItemDTO[];
}

// Client-facing DTOs (strictly stripped of all internal staff costs & profit margins)
export interface PortalInvoiceDTO {
  id: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  total: string;
  status: InvoiceStatus;
  pdfUrl?: string | null;
  lineItems: Array<{
    description: string;
    hours: string;
    rate: string;
    amount: string;
  }>;
}

export interface PortalProjectDTO {
  id: string;
  name: string;
  type: ProjectType;
  status: ProjectStatus;
  leadName?: string | null;
  totalTasks: number;
  completedTasks: number;
  progressPct: number;
}
