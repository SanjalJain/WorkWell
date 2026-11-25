"use server";

import { Role } from "@prisma/client";
import { rawPrisma } from "@/lib/db";
import { getSessionUser, setSessionUser } from "@/lib/auth";
import { seedDemoData } from "../../../prisma/seed";
import { revalidatePath } from "next/cache";

export async function resetDemoDataAction() {
  const isDemoAllowed =
    process.env.NODE_ENV !== "production" || process.env.ENABLE_DEMO_AUTH === "true";

  if (!isDemoAllowed) {
    throw new Error("Demo reset is only permitted in development or demo environments.");
  }

  const session = await getSessionUser();
  if (!session || session.role !== Role.OWNER) {
    throw new Error("Only an organization OWNER may reset demo data.");
  }

  const org = await rawPrisma.organization.findUnique({
    where: { id: session.organizationId },
  });

  if (!org || !org.isDemo) {
    throw new Error("Demo reset is only available for demo organizations (isDemo = true).");
  }

  // Execute database seed to restore pristine baseline
  await seedDemoData();

  // Find the pristine owner user to re-establish session
  const refreshedOrg = await rawPrisma.organization.findUnique({
    where: { slug: "brightwave" },
  });

  if (refreshedOrg) {
    const ownerUser = await rawPrisma.user.findFirst({
      where: {
        organizationId: refreshedOrg.id,
        role: Role.OWNER,
      },
      include: {
        employee: true,
      },
    });

    if (ownerUser) {
      await setSessionUser({
        userId: ownerUser.id,
        organizationId: refreshedOrg.id,
        role: Role.OWNER,
        employeeId: ownerUser.employeeId,
        clientId: null,
        email: ownerUser.email,
        name: ownerUser.employee
          ? `${ownerUser.employee.firstName} ${ownerUser.employee.lastName}`
          : "Owner",
      });
    }
  }

  revalidatePath("/", "layout");
  return { success: true, message: "Demo database reset to pristine state." };
}
