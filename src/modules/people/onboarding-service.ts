import { rawPrisma } from "@/lib/db";
import { withTenant } from "@/lib/tenant";
import { SessionUser } from "@/lib/auth";
import { canManageOnboarding } from "./policies";
import { OnboardingChecklistDTO, CreateOnboardingTemplateInput } from "./schema";
import { ChecklistStatus, EmployeeStatus } from "@prisma/client";
import { logAudit } from "@/lib/audit";
import { createOnboardingStarterTasks } from "@/modules/shared/service";

/**
 * Creates a reusable onboarding checklist template.
 */
export async function createOnboardingTemplate(
  data: CreateOnboardingTemplateInput,
  user: SessionUser
) {
  if (!canManageOnboarding(user)) {
    throw new Error("Unauthorized to create onboarding templates");
  }

  return withTenant(user.organizationId, async (tx) => {
    return tx.onboardingTemplate.create({
      data: {
        organizationId: user.organizationId,
        name: data.name,
        items: {
          create: data.items.map((item) => ({
            title: item.title,
            dayOffset: item.dayOffset,
            createsStarterTask: item.createsStarterTask,
          })),
        },
      },
    });
  });
}

/**
 * Initiates an onboarding process for an employee by snapshotting a template.
 * Snapshots items and sets employee status to ONBOARDING.
 */
export async function startOnboarding(
  employeeId: string,
  templateId: string,
  user: SessionUser
) {
  if (!canManageOnboarding(user)) {
    throw new Error("Unauthorized: Only HR or Owner can assign onboarding checklists");
  }

  const [employee, template] = await Promise.all([
    rawPrisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true, startDate: true, organizationId: true },
    }),
    rawPrisma.onboardingTemplate.findUnique({
      where: { id: templateId },
      include: { items: true },
    }),
  ]);

  if (!employee || employee.organizationId !== user.organizationId) {
    throw new Error("Employee not found");
  }
  if (!template || template.organizationId !== user.organizationId) {
    throw new Error("Onboarding template not found");
  }

  const checklist = await withTenant(user.organizationId, async (tx) => {
    // Check if checklist already exists
    const existing = await tx.onboardingChecklist.findUnique({
      where: {
        employeeId_templateId: { employeeId, templateId },
      },
    });

    if (existing) {
      throw new Error("An onboarding checklist with this template already exists for this employee");
    }

    // Set employee status to ONBOARDING
    await tx.employee.update({
      where: { id: employeeId },
      data: { status: EmployeeStatus.ONBOARDING },
    });

    // Create checklist with snapshot of template items
    const createdChecklist = await tx.onboardingChecklist.create({
      data: {
        organizationId: user.organizationId,
        employeeId,
        templateId,
        status: ChecklistStatus.IN_PROGRESS,
        items: {
          create: template.items.map((item) => {
            const dueDate = new Date(employee.startDate);
            dueDate.setUTCDate(dueDate.getUTCDate() + item.dayOffset);

            return {
              title: item.title,
              dueDate,
              completed: false,
            };
          }),
        },
      },
      include: { items: true },
    });

    await logAudit(
      {
        organizationId: user.organizationId,
        userId: user.userId,
        action: "START_ONBOARDING",
        entity: "OnboardingChecklist",
        entityId: createdChecklist.id,
        metadata: { employeeId, templateId },
      },
      tx
    );

    return createdChecklist;
  });

  // Automatically generate starter tasks in internal project
  await createOnboardingStarterTasks(checklist.id, user.organizationId);

  return checklist;
}

/**
 * Toggles an onboarding item's completion.
 * If all items become completed, flips employee status to ACTIVE automatically!
 */
export async function toggleOnboardingItem(
  itemId: string,
  completed: boolean,
  user: SessionUser
) {
  const item = await rawPrisma.onboardingItem.findUnique({
    where: { id: itemId },
    include: {
      checklist: {
        include: {
          employee: true,
          items: true,
        },
      },
    },
  });

  if (!item || item.checklist.organizationId !== user.organizationId) {
    throw new Error("Onboarding item not found");
  }

  const checklist = item.checklist;
  const isHRorOwner = user.role === "OWNER" || user.role === "HR";
  const isSelf = user.employeeId === checklist.employeeId;

  if (!isHRorOwner && !isSelf) {
    throw new Error("Unauthorized to modify this checklist item");
  }

  return withTenant(user.organizationId, async (tx) => {
    // 1. Update the item
    await tx.onboardingItem.update({
      where: { id: itemId },
      data: {
        completed,
        completedAt: completed ? new Date() : null,
      },
    });

    // 2. Check if all items on this checklist are now completed
    const allItems = await tx.onboardingItem.findMany({
      where: { checklistId: checklist.id },
    });

    const allCompleted = allItems.every((i) => (i.id === itemId ? completed : i.completed));

    if (allCompleted) {
      // Mark checklist COMPLETED
      await tx.onboardingChecklist.update({
        where: { id: checklist.id },
        data: { status: ChecklistStatus.COMPLETED },
      });

      // Automatically flip employee status to ACTIVE!
      await tx.employee.update({
        where: { id: checklist.employeeId },
        data: { status: EmployeeStatus.ACTIVE },
      });

      await logAudit(
        {
          organizationId: user.organizationId,
          userId: user.userId,
          action: "COMPLETE_ONBOARDING_CHECKLIST",
          entity: "OnboardingChecklist",
          entityId: checklist.id,
          metadata: { employeeId: checklist.employeeId, newStatus: "ACTIVE" },
        },
        tx
      );
    } else {
      // If uncompleted an item and it was marked completed, revert back to IN_PROGRESS
      if (checklist.status === ChecklistStatus.COMPLETED) {
        await tx.onboardingChecklist.update({
          where: { id: checklist.id },
          data: { status: ChecklistStatus.IN_PROGRESS },
        });
      }
    }

    return { success: true, allCompleted };
  });
}

/**
 * Lists onboarding checklists shaped by user role.
 */
export async function listOnboardingChecklists(
  user: SessionUser
): Promise<OnboardingChecklistDTO[]> {
  const isHRorOwner = user.role === "OWNER" || user.role === "HR";
  const isManager = user.role === "MANAGER";

  let where: any = { organizationId: user.organizationId };

  if (!isHRorOwner) {
    if (isManager && user.employeeId) {
      where = {
        organizationId: user.organizationId,
        OR: [
          { employeeId: user.employeeId },
          { employee: { managerId: user.employeeId } },
        ],
      };
    } else if (user.employeeId) {
      where = { organizationId: user.organizationId, employeeId: user.employeeId };
    } else {
      return [];
    }
  }

  const checklists = await rawPrisma.onboardingChecklist.findMany({
    where,
    include: {
      employee: { select: { firstName: true, lastName: true } },
      template: { select: { name: true } },
      items: { orderBy: { dueDate: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return checklists.map((c) => {
    const totalItems = c.items.length;
    const completedItems = c.items.filter((i) => i.completed).length;
    const progressPct = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

    return {
      id: c.id,
      employeeId: c.employeeId,
      employeeName: `${c.employee.firstName} ${c.employee.lastName}`,
      templateName: c.template.name,
      status: c.status,
      progressPct,
      totalItems,
      completedItems,
      items: c.items.map((i) => ({
        id: i.id,
        title: i.title,
        dueDate: i.dueDate.toISOString().split("T")[0],
        completed: i.completed,
        completedAt: i.completedAt ? i.completedAt.toISOString() : null,
      })),
    };
  });
}
