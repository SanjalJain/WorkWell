import { Role, DocumentCategory } from "@prisma/client";
import { SessionUser } from "@/lib/auth";

/**
 * Authorization policy for viewing employee records.
 * Clients cannot browse internal employees. Internal staff (Owner, HR, Manager, Employee) can browse directory.
 */
export function canViewEmployee(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.role !== Role.CLIENT;
}

/**
 * Authorization policy for viewing compensation records.
 * STRICT: Only OWNER and HR are allowed to view compensation (salaries, hourly rates, margins).
 * Managers, Employees, and Clients are strictly blocked.
 */
export function canViewCompensation(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.role === Role.OWNER || user.role === Role.HR;
}

/**
 * Authorization policy for creating or updating employee directory information.
 * Only OWNER and HR can modify employee organizational metadata (job title, department, manager).
 */
export function canEditEmployee(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.role === Role.OWNER || user.role === Role.HR;
}

/**
 * Authorization policy for managing user roles and system access.
 */
export function canManageRoles(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.role === Role.OWNER;
}

/**
 * Authorization policy for approving a leave request.
 * - OWNER and HR can approve any leave request in the organization.
 * - MANAGER can approve leave requests ONLY for their direct reports.
 * - Requester cannot approve their own leave under any circumstance.
 */
export function canApproveLeave(
  user: SessionUser | null,
  requester: { id: string; managerId: string | null }
): boolean {
  if (!user || !user.employeeId) return false;

  // Anti-self-approval rule
  if (requester.id === user.employeeId) {
    return false;
  }

  if (user.role === Role.OWNER || user.role === Role.HR) {
    return true;
  }

  if (user.role === Role.MANAGER) {
    return requester.managerId === user.employeeId;
  }

  return false;
}

/**
 * Authorization policy for viewing/downloading an employee document.
 * - OWNER and HR can access all documents.
 * - The document's owner (employee) can access their own documents.
 * - Managers cannot access sensitive documents (Contracts, IDs) of others.
 * - Clients have no access.
 */
export function canViewDocument(
  user: SessionUser | null,
  doc: { employeeId: string; category: DocumentCategory }
): boolean {
  if (!user) return false;
  if (user.role === Role.CLIENT) return false;

  if (user.role === Role.OWNER || user.role === Role.HR) {
    return true;
  }

  // Employee viewing their own document
  if (user.employeeId && doc.employeeId === user.employeeId) {
    return true;
  }

  return false;
}

/**
 * Authorization policy for uploading documents.
 * - OWNER and HR can upload for any employee.
 * - Employees can upload documents for themselves.
 */
export function canUploadDocument(user: SessionUser | null, targetEmployeeId: string): boolean {
  if (!user) return false;
  if (user.role === Role.OWNER || user.role === Role.HR) return true;
  return user.employeeId === targetEmployeeId;
}

/**
 * Authorization policy for managing onboarding templates and assigning checklists.
 */
export function canManageOnboarding(user: SessionUser | null): boolean {
  if (!user) return false;
  return user.role === Role.OWNER || user.role === Role.HR;
}
