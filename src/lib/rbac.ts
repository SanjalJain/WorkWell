import { Role } from "@prisma/client";
import { SessionUser } from "./auth";

export function isOwner(user: SessionUser | null): boolean {
  return user?.role === Role.OWNER;
}

export function isHR(user: SessionUser | null): boolean {
  return user?.role === Role.HR;
}

export function isManager(user: SessionUser | null): boolean {
  return user?.role === Role.MANAGER;
}

export function isEmployee(user: SessionUser | null): boolean {
  return user?.role === Role.EMPLOYEE;
}

export function isClient(user: SessionUser | null): boolean {
  return user?.role === Role.CLIENT;
}

export function hasRole(user: SessionUser | null, allowedRoles: Role[]): boolean {
  if (!user) return false;
  return allowedRoles.includes(user.role);
}

export function assertRole(user: SessionUser | null, allowedRoles: Role[]) {
  if (!user || !allowedRoles.includes(user.role)) {
    throw new Error(`Unauthorized: Requires one of [${allowedRoles.join(", ")}], got ${user?.role ?? "unauthenticated"}`);
  }
}
