"use client";

import { useState, useTransition } from "react";
import { createDocumentAction } from "@/app/actions/hr-actions";
import { DocumentCategory } from "@prisma/client";
import { Plus, X, UploadCloud, Download, FileText, ShieldAlert } from "lucide-react";

interface UploadModalProps {
  employees: { id: string; name: string }[];
  currentEmployeeId?: string | null;
  canUploadAny: boolean;
}

export function UploadDocumentModal({
  employees,
  currentEmployeeId,
  canUploadAny,
}: UploadModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = e.currentTarget;
    const formData = new FormData(form);

    startTransition(async () => {
      try {
        await createDocumentAction(formData);
        setIsOpen(false);
      } catch (err: any) {
        setError(err.message || "Failed to upload document record");
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#34D399] hover:bg-[#34D399]/90 text-[#04130C] text-xs font-semibold transition-all shadow-[0_0_12px_rgba(52,211,153,0.2)]"
      >
        <Plus className="w-4 h-4" />
        <span>Upload Document</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-md p-6 space-y-5 border border-[#2F4239] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#22302A] pb-3">
              <h3 className="text-base font-semibold text-[#F4FAF7]">Upload Employee Document</h3>
              <button onClick={() => setIsOpen(false)} className="text-[#93A59B] hover:text-[#E8F1EC]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[#F0646E]/10 border border-[#F0646E]/30 text-xs text-[#F0646E]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              {canUploadAny ? (
                <div>
                  <label className="font-mono-label block mb-1">Target Employee</label>
                  <select
                    name="employeeId"
                    required
                    defaultValue={currentEmployeeId || ""}
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                  >
                    {employees.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <input type="hidden" name="employeeId" value={currentEmployeeId || ""} />
              )}

              <div>
                <label className="font-mono-label block mb-1">Document Title</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Employment Contract 2026.pdf"
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] placeholder-[#5F6F66] focus:outline-none focus:border-[#34D399]"
                />
              </div>

              <div>
                <label className="font-mono-label block mb-1">Category</label>
                <select
                  name="category"
                  required
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                >
                  <option value={DocumentCategory.CONTRACT}>Contract (Confidential)</option>
                  <option value={DocumentCategory.ID}>Identity / Passport (Confidential)</option>
                  <option value={DocumentCategory.RESUME}>Resume / CV</option>
                  <option value={DocumentCategory.OTHER}>Other / General</option>
                </select>
              </div>

              <div>
                <label className="font-mono-label block mb-1">Storage Path / File Key</label>
                <input
                  type="text"
                  name="fileUrl"
                  required
                  defaultValue={`docs/${Date.now()}-sample.pdf`}
                  placeholder="docs/contracts/..."
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] font-mono text-[11px] focus:outline-none focus:border-[#34D399]"
                />
                <span className="text-[10px] text-[#5F6F66] mt-0.5 block">
                  Encrypted object storage key with automatic HMAC access verification.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#22302A]">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#16201B] text-[#93A59B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 rounded-lg bg-[#34D399] text-[#04130C] font-semibold disabled:opacity-50"
                >
                  {isPending ? "Uploading..." : "Save Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function DownloadDocumentButton({ docId, docName }: { docId: string; docName: string }) {
  const [isPending, setIsPending] = useState(false);

  const handleDownload = async () => {
    setIsPending(true);
    try {
      const res = await fetch(`/api/documents/${docId}/download`);
      if (!res.ok) {
        const err = await res.json();
        alert(err.error || "Unauthorized to download this document");
        return;
      }
      const data = await res.json();
      window.open(data.url, "_blank");
    } catch {
      alert("Failed to initiate download");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isPending}
      className="inline-flex items-center gap-1.5 text-xs text-[#34D399] hover:underline font-mono disabled:opacity-50"
    >
      <Download className="w-3.5 h-3.5" />
      <span>{isPending ? "Signing..." : "Download"}</span>
    </button>
  );
}
