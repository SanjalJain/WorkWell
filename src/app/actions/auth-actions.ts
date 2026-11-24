"use server";

import { Role } from "@prisma/client";
import { rawPrisma } from "@/lib/db";
import { getSessionUser, setSessionUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function switchRoleAction(targetRole: Role) {
  const isDemoAllowed =
    process.env.NODE_ENV !== "production" || process.env.ENABLE_DEMO_AUTH === "true";

  if (!isDemoAllowed) {
    throw new Error("Role switching is only permitted in development or demo environments.");
  }

  const currentSession = await getSessionUser();
  const orgSlug = "brightwave";

  const org = await rawPrisma.organization.findUnique({
    where: { slug: orgSlug },
  });

  if (!org) {
    throw new Error("Organization not found");
  }

  const targetUser = await rawPrisma.user.findFirst({
    where: {
      organizationId: org.id,
      role: targetRole,
    },
    include: {
      employee: true,
      client: true,
    },
  });

  if (!targetUser) {
    throw new Error(`No user with role ${targetRole} found in demo organization`);
  }

  const name = targetUser.employee
    ? `${targetUser.employee.firstName} ${targetUser.employee.lastName}`
    : targetUser.client
    ? `Client (${targetUser.client.name})`
    : targetUser.email;

  await setSessionUser({
    userId: targetUser.id,
    organizationId: org.id,
    role: targetUser.role,
    employeeId: targetUser.employeeId,
    clientId: targetUser.clientId,
    email: targetUser.email,
    name,
  });

  revalidatePath("/", "layout");
  return { success: true, role: targetRole, name };
}
