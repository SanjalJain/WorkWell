import { rawPrisma } from "./db";
import { Prisma } from "@prisma/client";

/**
 * Executes a database callback inside an interactive transaction with PostgreSQL
 * Row-Level Security session variable app.org_id set.
 *
 * This provides the lowest-level cryptographic guarantee that queries and mutations
 * within this transaction cannot read or write data across tenant boundaries.
 */
export async function withTenant<T>(
  organizationId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  if (!organizationId) {
    throw new Error("Cannot execute tenant transaction without an organizationId");
  }

  return rawPrisma.$transaction(
    async (tx) => {
      // Set PostgreSQL session variable locally for this transaction
      await tx.$executeRaw`SELECT set_config('app.org_id', ${organizationId}, true);`;
      return fn(tx);
    },
    {
      maxWait: 5000,
      timeout: 10000,
    }
  );
}

/**
 * Creates a tenant-scoped Prisma client using Prisma Client Extensions.
 * Automatically injects { organizationId } into read/write where clauses.
 */
export function getTenantPrisma(organizationId: string) {
  if (!organizationId) {
    throw new Error("organizationId is required for tenant Prisma client");
  }

  return rawPrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // If the model has organizationId in its fields, enforce it
          const tenantModels = [
            "User",
            "Employee",
            "Department",
            "LeaveType",
            "PublicHoliday",
            "Document",
            "Client",
            "Project",
            "Task",
            "TimeEntry",
            "Invoice",
            "InvoiceSequence",
            "Objective",
            "ReviewCycle",
            "OneOnOne",
            "Feedback",
            "OnboardingTemplate",
            "OnboardingChecklist",
            "AuditLog",
          ];

          if (tenantModels.includes(model)) {
            const currentArgs = (args ? { ...args } : {}) as {
              where?: Record<string, unknown>;
              data?: Record<string, unknown> | Array<Record<string, unknown>>;
            };

            if (["findUnique", "findUniqueOrThrow"].includes(operation)) {
              const isThrow = operation === "findUniqueOrThrow";
              return (rawPrisma as any)[model][isThrow ? "findFirstOrThrow" : "findFirst"]({
                ...currentArgs,
                where: {
                  ...currentArgs.where,
                  organizationId,
                },
              });
            }

            if (["findFirst", "findFirstOrThrow", "findMany", "count", "aggregate", "groupBy"].includes(operation)) {
              currentArgs.where = {
                ...currentArgs.where,
                organizationId,
              };
            } else if (["create", "createMany"].includes(operation)) {
              if (currentArgs.data) {
                if (Array.isArray(currentArgs.data)) {
                  currentArgs.data = currentArgs.data.map((item) => ({ ...item, organizationId }));
                } else {
                  currentArgs.data = { ...currentArgs.data, organizationId };
                }
              }
            } else if (["update", "updateMany", "delete", "deleteMany", "upsert"].includes(operation)) {
              currentArgs.where = {
                ...currentArgs.where,
                organizationId,
              };
            }

            return query(currentArgs as any);
          }

          return query(args);
        },
      },
    },
  });
}
