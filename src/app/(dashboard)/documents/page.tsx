import { getSessionUser } from "@/lib/auth";
import { listDocuments } from "@/modules/people/document-service";
import { rawPrisma } from "@/lib/db";
import { UploadDocumentModal, DownloadDocumentButton } from "./DocumentsClientComponents";
import { FileText, ShieldAlert, Lock, Folder, Check } from "lucide-react";
import { Role, DocumentCategory } from "@prisma/client";
import { redirect } from "next/navigation";

interface DocumentsPageProps {
  searchParams: Promise<{ category?: string }>;
}

export default async function DocumentsPage({ searchParams }: DocumentsPageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/");

  if (user.role === Role.CLIENT) {
    redirect("/portal");
  }

  const { category } = await searchParams;

  const [allDocs, employees] = await Promise.all([
    listDocuments(user),
    rawPrisma.employee.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { lastName: "asc" },
    }),
  ]);

  const docs = category
    ? allDocs.filter((d) => d.category === category)
    : allDocs;

  const canUploadAny = user.role === Role.OWNER || user.role === Role.HR;

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-4xl text-[#F4FAF7]">
            Secure <span className="italic text-[#34D399]">documents</span>
          </h1>
          <p className="text-sm text-[#93A59B] mt-1">
            Category-segregated repository for employee contracts, IDs, and compliance documents.
          </p>
        </div>

        <UploadDocumentModal
          canUploadAny={canUploadAny}
          currentEmployeeId={user.employeeId}
          employees={employees.map((e) => ({
            id: e.id,
            name: `${e.firstName} ${e.lastName}`,
          }))}
        />
      </div>

      {/* Security Banner */}
      <div className="surface-card p-4 flex items-center gap-3 border-l-4 border-l-[#34D399]">
        <ShieldAlert className="w-5 h-5 text-[#34D399] flex-shrink-0" />
        <div className="text-xs text-[#93A59B]">
          <strong className="text-[#E8F1EC]">Confidentiality Policy: </strong>
          Contracts and IDs are encrypted and accessible only by <span className="text-[#34D399] font-mono">OWNER</span>,{" "}
          <span className="text-[#34D399] font-mono">HR</span>, or the owning employee. Managers cannot inspect peer or report contracts.
        </div>
      </div>

      {/* Category Filter Pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <a
          href="/documents"
          className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
            !category
              ? "bg-[#34D399] text-[#04130C] font-semibold"
              : "bg-[#16201B] text-[#93A59B] border border-[#22302A] hover:bg-[#1D2A24]"
          }`}
        >
          All Categories ({allDocs.length})
        </a>
        {[
          { key: DocumentCategory.CONTRACT, label: "Contracts" },
          { key: DocumentCategory.ID, label: "Identity & Passports" },
          { key: DocumentCategory.RESUME, label: "Resumes & CVs" },
          { key: DocumentCategory.OTHER, label: "General Documents" },
        ].map((cat) => {
          const count = allDocs.filter((d) => d.category === cat.key).length;
          const isActive = category === cat.key;
          return (
            <a
              key={cat.key}
              href={`/documents?category=${cat.key}`}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                isActive
                  ? "bg-[#34D399] text-[#04130C] font-semibold"
                  : "bg-[#16201B] text-[#93A59B] border border-[#22302A] hover:bg-[#1D2A24]"
              }`}
            >
              {cat.label} ({count})
            </a>
          );
        })}
      </div>

      {/* Documents Table */}
      <div className="surface-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#16201B]/60 border-b border-[#22302A]">
              <tr>
                <th className="px-5 py-3 font-mono-label">Document Name</th>
                <th className="px-5 py-3 font-mono-label">Category</th>
                <th className="px-5 py-3 font-mono-label">Employee Owner</th>
                <th className="px-5 py-3 font-mono-label">Uploaded</th>
                <th className="px-5 py-3 text-right font-mono-label">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#22302A]">
              {docs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-8 text-center text-[#5F6F66]">
                    No documents found in this category.
                  </td>
                </tr>
              ) : (
                docs.map((doc) => (
                  <tr key={doc.id} className="hover:bg-[#16201B]/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5 font-medium text-[#E8F1EC]">
                        <FileText className="w-4 h-4 text-[#34D399]" />
                        <span>{doc.name}</span>
                      </div>
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider ${
                          doc.category === DocumentCategory.CONTRACT
                            ? "bg-[#F2B84B]/10 text-[#F2B84B] border border-[#F2B84B]/20"
                            : doc.category === DocumentCategory.ID
                            ? "bg-[#6AA8F0]/10 text-[#6AA8F0] border border-[#6AA8F0]/20"
                            : "bg-[#1D2A24] text-[#93A59B] border border-[#2F4239]"
                        }`}
                      >
                        {doc.category}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-[#93A59B]">{doc.employeeName}</td>

                    <td className="px-5 py-3.5 font-mono text-[#5F6F66]">{doc.uploadedAt}</td>

                    <td className="px-5 py-3.5 text-right">
                      <DownloadDocumentButton docId={doc.id} docName={doc.name} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
