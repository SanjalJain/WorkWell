"use client";

import { useState, useTransition, useRef } from "react";
import { createDocumentAction, getUploadUrlAction } from "@/app/actions/hr-actions";
import { DocumentCategory } from "@prisma/client";
import { Plus, X, UploadCloud, Download, FileText, CheckCircle2 } from "lucide-react";

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
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docName, setDocName] = useState("");
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      if (!docName) {
        setDocName(file.name);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!selectedFile) {
      setError("Please choose a file to upload.");
      return;
    }

    const targetEmployeeId = canUploadAny
      ? (e.currentTarget.employeeId as HTMLSelectElement)?.value || currentEmployeeId
      : currentEmployeeId;

    if (!targetEmployeeId) {
      setError("Employee ID is required.");
      return;
    }

    const categoryVal = (e.currentTarget.category as HTMLSelectElement)?.value || DocumentCategory.OTHER;

    startTransition(async () => {
      try {
        setUploadProgress("Generating encrypted storage URL...");
        const presigned = await getUploadUrlAction(selectedFile.name, selectedFile.type);
        if (!presigned.uploadUrl) {
          throw new Error("Failed to obtain signed upload URL");
        }

        setUploadProgress("Uploading file to secure object vault...");
        const res = await fetch(presigned.uploadUrl, {
          method: "PUT",
          body: selectedFile,
          headers: {
            "Content-Type": selectedFile.type || "application/octet-stream",
          },
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => ({}));
          throw new Error(errJson.error || "Failed to upload file to storage");
        }

        setUploadProgress("Registering document record in database...");
        const formData = new FormData();
        formData.set("employeeId", targetEmployeeId);
        formData.set("name", docName || selectedFile.name);
        formData.set("category", categoryVal);
        formData.set("fileUrl", presigned.key);
        formData.set("fileSize", selectedFile.size.toString());
        formData.set("mimeType", selectedFile.type || "application/octet-stream");

        await createDocumentAction(formData);

        setIsOpen(false);
        setSelectedFile(null);
        setDocName("");
        setUploadProgress(null);
      } catch (err: any) {
        setError(err.message || "Failed to upload document");
        setUploadProgress(null);
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
          <div className="surface-card w-full max-w-md p-6 space-y-4 border border-[#2F4239] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#22302A] pb-3">
              <h3 className="text-base font-semibold text-[#F4FAF7]">Upload Employee Document</h3>
              <button
                onClick={() => {
                  setIsOpen(false);
                  setSelectedFile(null);
                  setError(null);
                }}
                className="text-[#93A59B] hover:text-[#E8F1EC]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[#F0646E]/10 border border-[#F0646E]/30 text-xs text-[#F0646E]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
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

              {/* Real File Input & Drop Area */}
              <div>
                <label className="font-mono-label block mb-1">File Attachment (Max 15MB)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  required
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.png,.jpg,.jpeg,.webp,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="p-4 border-2 border-dashed border-[#2F4239] hover:border-[#34D399]/60 rounded-xl bg-[#16201B]/50 hover:bg-[#16201B] cursor-pointer transition-all flex flex-col items-center justify-center text-center gap-1.5"
                >
                  <UploadCloud className="w-6 h-6 text-[#34D399]" />
                  {selectedFile ? (
                    <div className="space-y-0.5">
                      <div className="text-xs font-medium text-[#E8F1EC] flex items-center justify-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399]" />
                        <span>{selectedFile.name}</span>
                      </div>
                      <div className="text-[10px] font-mono text-[#93A59B]">
                        {(selectedFile.size / 1024).toFixed(1)} KB &bull; Click to replace
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span className="text-xs font-medium text-[#E8F1EC]">
                        Choose a file or click to browse
                      </span>
                      <span className="text-[10px] text-[#5F6F66] block">
                        PDF, DOCX, CSV, PNG, JPG up to 15MB
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="font-mono-label block mb-1">Document Display Title</label>
                <input
                  type="text"
                  name="name"
                  required
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
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

              {uploadProgress && (
                <div className="p-2.5 rounded bg-[#16201B] border border-[#34D399]/30 text-[11px] text-[#34D399] font-mono flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-[#34D399] animate-pulse" />
                  <span>{uploadProgress}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#22302A]">
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => {
                    setIsOpen(false);
                    setSelectedFile(null);
                    setError(null);
                  }}
                  className="px-3 py-1.5 rounded-lg bg-[#16201B] text-[#93A59B]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending || !selectedFile}
                  className="px-4 py-1.5 rounded-lg bg-[#34D399] text-[#04130C] font-semibold disabled:opacity-50 transition-all"
                >
                  {isPending ? "Uploading..." : "Upload & Save"}
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
