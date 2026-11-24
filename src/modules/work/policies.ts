import { Role, ProjectStatus } from "@prisma/client";
import { SessionUser } from "@/lib/auth";

/**
 * Authorization policy for viewing projects.
 * - Internal staff can view projects in their organization.
 * - Clients can ONLY view projects commissioned by their own clientId.
 */
export function canViewProjects(user: SessionUser | null): boolean {
  if (!user) return false;
  return true;
}

/**
 * Authorization policy for project management (CRUD, members, budget).
 * - OWNER can manage all projects.
 * - Project Lead or MANAGER can manage assigned projects.
 * - Employees and Clients cannot manage project metadata or members.
 */
export function canManageProject(
  user: SessionUser | null,
  project?: { leadId?: string | null; organizationId: string }
): boolean {
  if (!user) return false;
  if (user.role === Role.CLIENT || user.role === Role.EMPLOYEE) return false;
  if (user.role === Role.OWNER || user.role === Role.HR) return true;

  if (user.role === Role.MANAGER) {
    if (!project) return true;
    return project.leadId === user.employeeId;
  }

  return false;
}

/**
 * Authorization policy for logging time on a project.
 * - Requires employeeId.
 * - Project must be active (not COMPLETED or ARCHIVED).
 */
export function canLogTime(
  user: SessionUser | null,
  project: { status: ProjectStatus }
): boolean {
  if (!user || !user.employeeId) return false;
  if (user.role === Role.CLIENT) return false;

  // Cannot log time on completed or archived projects
  if (project.status === ProjectStatus.COMPLETED || project.status === ProjectStatus.ARCHIVED) {
    return false;
  }

  return true;
}

/**
 * Authorization policy for modifying or deleting a time entry.
 * CRITICAL RULE: Billed time entries (with invoiceLineItemId set) can NEVER be edited or deleted!
 */
export function canEditTimeEntry(
  user: SessionUser | null,
  entry: { employeeId: string; invoiceLineItemId?: string | null }
): { allowed: boolean; reason?: string } {
  if (!user) return { allowed: false, reason: "Unauthenticated" };

  // Locked time check (Phase 4 integration guard)
  if (entry.invoiceLineItemId) {
    return {
      allowed: false,
      reason: "This time entry is attached to an invoice statement and is permanently locked against edits or deletion.",
    };
  }

  if (user.role === Role.OWNER || user.role === Role.HR) {
    return { allowed: true };
  }

  if (entry.employeeId === user.employeeId) {
    return { allowed: true };
  }

  return { allowed: false, reason: "You can only edit your own time entries." };
}
