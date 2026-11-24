import { rawPrisma } from "./db";
import { Prisma } from "@prisma/client";

export interface LogAuditParams {
  organizationId: string;
  userId?: string | null;
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}

/**
 * Records an audit trail entry in the database.
 */
export async function logAudit(params: LogAuditParams, tx?: Prisma.TransactionClient) {
  const db = tx ?? rawPrisma;
  try {
    await db.auditLog.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId ?? null,
        action: params.action,
        entity: params.entity,
        entityId: params.entityId ?? null,
        metadata: params.metadata ? (params.metadata as Prisma.InputJsonValue) : Prisma.JsonNull,
      },
    });
  } catch (error) {
    // Non-blocking error reporting so audit logging failure does not block the primary transaction
    console.error("Failed to write audit log:", error);
  }
}
