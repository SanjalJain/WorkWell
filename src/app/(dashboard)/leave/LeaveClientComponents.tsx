"use client";

import { useState, useTransition } from "react";
import { requestLeaveAction, decideLeaveAction, cancelLeaveAction } from "@/app/actions/hr-actions";
import { LeaveBalanceDTO } from "@/modules/people/schema";
import { Plus, Check, X, Calendar, AlertCircle } from "lucide-react";

interface RequestLeaveFormProps {
  balances: LeaveBalanceDTO[];
}

export function RequestLeaveModal({ balances }: RequestLeaveFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await requestLeaveAction(formData);
        setIsOpen(false);
      } catch (err: any) {
        setError(err.message || "Failed to submit leave request");
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
        <span>Request Time Off</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-md p-6 space-y-5 border border-[#2F4239] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#22302A] pb-3">
              <h3 className="text-base font-semibold text-[#F4FAF7]">Request Time Off</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#93A59B] hover:text-[#E8F1EC]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[#F0646E]/10 border border-[#F0646E]/30 text-xs text-[#F0646E] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-mono-label block mb-1">Leave Type</label>
                <select
                  name="leaveTypeId"
                  required
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                >
                  {balances.map((b) => (
                    <option key={b.leaveTypeId} value={b.leaveTypeId}>
                      {b.name} ({b.remainingDays} days remaining)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono-label block mb-1">Start Date</label>
                  <input
                    type="date"
                    name="startDate"
                    required
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                  />
                </div>
                <div>
                  <label className="font-mono-label block mb-1">End Date</label>
                  <input
                    type="date"
                    name="endDate"
                    required
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="isHalfDay"
                  name="isHalfDay"
                  value="true"
                  className="rounded border-[#2F4239] bg-[#16201B] text-[#34D399] focus:ring-0"
                />
                <label htmlFor="isHalfDay" className="text-[#93A59B]">
                  Half-day leave (Start and End date must be identical)
                </label>
              </div>

              <div>
                <label className="font-mono-label block mb-1">Reason (Optional)</label>
                <textarea
                  name="reason"
                  rows={2}
                  placeholder="e.g. Doctor's appointment, vacation..."
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] placeholder-[#5F6F66] focus:outline-none focus:border-[#34D399]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#22302A]">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-[#16201B] hover:bg-[#1D2A24] text-[#93A59B] border border-[#22302A]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-4 py-1.5 rounded-lg bg-[#34D399] hover:bg-[#34D399]/90 text-[#04130C] font-semibold transition-all disabled:opacity-50"
                >
                  {isPending ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function LeaveDecisionButtons({ requestId }: { requestId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleDecision = (decision: "APPROVED" | "REJECTED") => {
    startTransition(async () => {
      await decideLeaveAction(requestId, decision);
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={() => handleDecision("APPROVED")}
        disabled={isPending}
        className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#34D399]/15 hover:bg-[#34D399]/25 text-[#34D399] border border-[#34D399]/30 font-medium text-xs transition-all disabled:opacity-50"
      >
        <Check className="w-3.5 h-3.5" />
        <span>Approve</span>
      </button>

      <button
        onClick={() => handleDecision("REJECTED")}
        disabled={isPending}
        className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#F0646E]/15 hover:bg-[#F0646E]/25 text-[#F0646E] border border-[#F0646E]/30 font-medium text-xs transition-all disabled:opacity-50"
      >
        <X className="w-3.5 h-3.5" />
        <span>Reject</span>
      </button>
    </div>
  );
}

export function CancelLeaveButton({ requestId }: { requestId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleCancel = () => {
    if (!confirm("Are you sure you want to cancel this leave request?")) return;
    startTransition(async () => {
      await cancelLeaveAction(requestId);
    });
  };

  return (
    <button
      onClick={handleCancel}
      disabled={isPending}
      className="text-[11px] font-mono text-[#F0646E] hover:underline disabled:opacity-50"
    >
      Cancel
    </button>
  );
}
