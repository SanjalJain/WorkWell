"use client";

import { useState, useTransition } from "react";
import { logTimeAction, deleteTimeEntryAction } from "@/app/actions/work-actions";
import { Plus, X, Clock, Trash2, Lock } from "lucide-react";

interface LogTimeModalProps {
  projects: { id: string; name: string; clientName: string }[];
}

export function LogTimeModal({ projects }: LogTimeModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await logTimeAction(formData);
        setIsOpen(false);
      } catch (err: any) {
        setError(err.message || "Failed to log time");
      }
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[#2DB6A8] hover:bg-[#2DB6A8]/90 text-[#04130C] text-xs font-semibold transition-all shadow-[0_0_12px_rgba(45,182,168,0.2)]"
      >
        <Plus className="w-4 h-4" />
        <span>Log Time</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-md p-6 space-y-4 border border-[#2F4239] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#22302A] pb-3">
              <h3 className="text-base font-semibold text-[#F4FAF7]">Log Working Hours</h3>
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
              <div>
                <label className="font-mono-label block mb-1">Project</label>
                <select
                  name="projectId"
                  required
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#2DB6A8]"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.clientName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono-label block mb-1">Date</label>
                  <input
                    type="date"
                    name="date"
                    required
                    defaultValue={todayStr}
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#2DB6A8]"
                  />
                </div>

                <div>
                  <label className="font-mono-label block mb-1">Hours Logged</label>
                  <input
                    type="number"
                    name="hours"
                    required
                    min="0.25"
                    max="24"
                    step="0.25"
                    defaultValue="4"
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#2DB6A8]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="billable"
                  name="billable"
                  value="true"
                  defaultChecked
                  className="rounded border-[#2F4239] bg-[#16201B] text-[#2DB6A8] focus:ring-0"
                />
                <label htmlFor="billable" className="text-[#93A59B]">
                  Billable hours (included on client invoice statement)
                </label>
              </div>

              <div>
                <label className="font-mono-label block mb-1">Work Description</label>
                <textarea
                  name="description"
                  rows={2}
                  placeholder="e.g. Implemented frontend forms and unit test coverage..."
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] placeholder-[#5F6F66] focus:outline-none focus:border-[#2DB6A8]"
                />
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
                  className="px-4 py-1.5 rounded-lg bg-[#2DB6A8] text-[#04130C] font-semibold disabled:opacity-50"
                >
                  {isPending ? "Logging..." : "Log Time"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function DeleteTimeEntryButton({ entryId, isLocked }: { entryId: string; isLocked: boolean }) {
  const [isPending, startTransition] = useTransition();

  if (isLocked) {
    return (
      <span
        title="This time entry has been billed on an invoice statement and is permanently locked."
        className="inline-flex items-center gap-1 text-[11px] font-mono text-[#F2B84B]"
      >
        <Lock className="w-3 h-3" />
        <span>Billed</span>
      </span>
    );
  }

  const handleDelete = () => {
    if (!confirm("Are you sure you want to delete this time entry?")) return;
    startTransition(async () => {
      await deleteTimeEntryAction(entryId);
    });
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="text-[#93A59B] hover:text-[#F0646E] transition-colors disabled:opacity-50"
      title="Delete time entry"
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}
