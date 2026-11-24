import { Role, InvoiceStatus } from "@prisma/client";
import { SessionUser } from "@/lib/auth";

/**
 * Authorization policy for managing invoices (creating, sending, voiding, marking paid).
 * - OWNER has full authority.
 * - HR has read/send authority.
 * - Employees and Clients CANNOT generate or edit invoices.
 */
export function canManageInvoices(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.role === Role.OWNER || user.role === Role.HR;
}

/**
 * Authorization policy for viewing invoices.
 * - OWNER and HR can view all organization invoices.
 * - Managers can view invoices for their led projects.
 * - CLIENT can ONLY view invoices commissioned for their specific clientId.
 */
export function canViewInvoice(
  user: SessionUser | null,
  invoice: {
    organizationId: string;
    clientId: string;
    lineItems?: Array<{
      timeEntries?: Array<{
        project?: { leadId?: string | null };
        projectId?: string;
      }>;
    }>;
  },
  managerLedProjectIds?: string[]
): boolean {
  if (!user) return false;
  if (invoice.organizationId !== user.organizationId) return false;

  if (user.role === Role.OWNER || user.role === Role.HR) return true;

  if (user.role === Role.CLIENT) {
    return user.clientId === invoice.clientId;
  }

  if (user.role === Role.MANAGER) {
    if (!user.employeeId) return false;
    if (invoice.lineItems && invoice.lineItems.length > 0) {
      return invoice.lineItems.some((li) =>
        li.timeEntries?.some(
          (te) =>
            te.project?.leadId === user.employeeId ||
            (Boolean(managerLedProjectIds) && Boolean(te.projectId) && managerLedProjectIds!.includes(te.projectId!))
        )
      );
    }
    return false;
  }

  return false;
}

/**
 * Validation for invoice state transitions.
 * - DRAFT -> SENT or VOID
 * - SENT -> PAID, OVERDUE, or VOID
 * - OVERDUE -> PAID or VOID
 * - PAID -> Terminal state (cannot be changed)
 * - VOID -> Terminal state (cannot be changed)
 */
export function canTransitionInvoiceStatus(
  current: InvoiceStatus,
  target: InvoiceStatus
): { allowed: boolean; reason?: string } {
  if (current === target) return { allowed: true };

  if (current === InvoiceStatus.PAID) {
    return { allowed: false, reason: "A paid invoice cannot change status." };
  }

  if (current === InvoiceStatus.VOID) {
    return { allowed: false, reason: "A voided invoice is immutable." };
  }

  if (current === InvoiceStatus.DRAFT) {
    if (target === InvoiceStatus.SENT || target === InvoiceStatus.VOID) {
      return { allowed: true };
    }
    return { allowed: false, reason: "A draft invoice must be sent before being paid." };
  }

  if (current === InvoiceStatus.SENT || current === InvoiceStatus.OVERDUE) {
    if (target === InvoiceStatus.PAID || target === InvoiceStatus.VOID || target === InvoiceStatus.OVERDUE) {
      return { allowed: true };
    }
  }

  return { allowed: false, reason: `Invalid status transition from ${current} to ${target}.` };
}
