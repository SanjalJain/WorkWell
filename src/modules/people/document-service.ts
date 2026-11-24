import { rawPrisma } from "@/lib/db";
import { withTenant } from "@/lib/tenant";
import { SessionUser } from "@/lib/auth";
import { canViewDocument, canUploadDocument } from "./policies";
import { CreateDocumentInput, DocumentDTO } from "./schema";
import { storage } from "@/lib/storage";
import { logAudit } from "@/lib/audit";
import { DocumentCategory, Role } from "@prisma/client";

/**
 * Saves a document record in the database after upload.
 */
export async function createDocumentRecord(
  data: CreateDocumentInput,
  user: SessionUser
) {
  if (!canUploadDocument(user, data.employeeId)) {
    throw new Error("Unauthorized to upload documents for this employee");
  }

  return withTenant(user.organizationId, async (tx) => {
    const doc = await tx.document.create({
      data: {
        organizationId: user.organizationId,
        employeeId: data.employeeId,
        name: data.name,
        category: data.category,
        fileUrl: data.fileUrl,
        fileSize: data.fileSize ?? null,
        mimeType: data.mimeType ?? null,
      },
    });

    await logAudit(
      {
        organizationId: user.organizationId,
        userId: user.userId,
        action: "UPLOAD_DOCUMENT",
        entity: "Document",
        entityId: doc.id,
        metadata: { category: data.category, name: data.name },
      },
      tx
    );

    return doc;
  });
}

/**
 * Lists documents with strict role-conditioned category visibility.
 */
export async function listDocuments(user: SessionUser): Promise<DocumentDTO[]> {
  if (!user || user.role === Role.CLIENT) return [];

  const isHRorOwner = user.role === Role.OWNER || user.role === Role.HR;

  let where: any = { organizationId: user.organizationId };

  if (!isHRorOwner) {
    if (user.employeeId) {
      // Employees only see their own documents
      where = {
        organizationId: user.organizationId,
        employeeId: user.employeeId,
      };
    } else {
      return [];
    }
  }

  const docs = await rawPrisma.document.findMany({
    where,
    include: {
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: { uploadedAt: "desc" },
  });

  return docs.map((d) => ({
    id: d.id,
    employeeId: d.employeeId,
    employeeName: `${d.employee.firstName} ${d.employee.lastName}`,
    name: d.name,
    fileUrl: d.fileUrl,
    category: d.category,
    fileSize: d.fileSize,
    mimeType: d.mimeType,
    uploadedAt: d.uploadedAt.toISOString().split("T")[0],
  }));
}

/**
 * Generates a signed download URL after validating authorization policy.
 * Emits an audit log for viewing sensitive contracts and IDs.
 */
export async function getDocumentDownloadUrl(
  documentId: string,
  user: SessionUser
): Promise<string> {
  const doc = await rawPrisma.document.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      employeeId: true,
      name: true,
      fileUrl: true,
      category: true,
      organizationId: true,
    },
  });

  if (!doc || doc.organizationId !== user.organizationId) {
    throw new Error("Document not found");
  }

  if (!canViewDocument(user, doc)) {
    throw new Error("Unauthorized to access this confidential document");
  }

  // Audit log sensitive downloads
  if (doc.category === DocumentCategory.CONTRACT || doc.category === DocumentCategory.ID) {
    await logAudit({
      organizationId: user.organizationId,
      userId: user.userId,
      action: "DOWNLOAD_CONFIDENTIAL_DOCUMENT",
      entity: "Document",
      entityId: doc.id,
      metadata: { category: doc.category, targetEmployeeId: doc.employeeId },
    });
  }

  return storage.getSignedDownloadUrl(doc.fileUrl);
}
