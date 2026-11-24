"use client";

import { useState, useTransition } from "react";
import {
  createReviewCycleAction,
  launchReviewCycleAction,
  submitReviewAction,
  createObjectiveAction,
  createKeyResultAction,
  updateKeyResultValueAction,
  scheduleOneOnOneAction,
  updateOneOnOneNotesAction,
  sendFeedbackAction,
} from "@/app/actions/performance-actions";
import { ObjectiveLevel, FeedbackType } from "@prisma/client";
import {
  Plus,
  X,
  Target,
  Sparkles,
  MessageSquare,
  Users,
  CheckCircle2,
  Rocket,
  Star,
  Check,
  Send,
} from "lucide-react";

// ==========================================
// 1. REVIEW CYCLE MODALS
// ==========================================

export function CreateReviewCycleModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await createReviewCycleAction(formData);
      setIsOpen(false);
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#B5E35B] hover:bg-[#B5E35B]/90 text-[#04130C] text-xs font-semibold transition-all shadow-[0_0_10px_rgba(181,227,91,0.2)]"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>New Cycle</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-sm p-5 space-y-4 border border-[#2F4239]">
            <div className="flex items-center justify-between border-b border-[#22302A] pb-2.5">
              <h3 className="text-sm font-semibold text-[#F4FAF7]">Create 360 Review Cycle</h3>
              <button onClick={() => setIsOpen(false)} className="text-[#93A59B] hover:text-[#E8F1EC]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-mono-label block mb-1">Cycle Name</label>
                <input
                  type="text"
                  name="name"
                  required
                  placeholder="e.g. Q4 2026 Annual 360 Reviews"
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#B5E35B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-mono-label block mb-1">Start Date</label>
                  <input
                    type="date"
                    name="startDate"
                    required
                    defaultValue="2026-11-01"
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#B5E35B]"
                  />
                </div>
                <div>
                  <label className="font-mono-label block mb-1">End Date</label>
                  <input
                    type="date"
                    name="endDate"
                    required
                    defaultValue="2026-11-30"
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#B5E35B]"
                  />
                </div>
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
                  className="px-4 py-1.5 rounded-lg bg-[#B5E35B] text-[#04130C] font-semibold disabled:opacity-50"
                >
                  {isPending ? "Creating..." : "Create Cycle"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function LaunchCycleButton({ cycleId }: { cycleId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleLaunch = () => {
    if (!confirm("Launch this review cycle? This will automatically snapshot Self, Manager, and Peer reviews for all active employees.")) return;
    startTransition(async () => {
      await launchReviewCycleAction(cycleId);
    });
  };

  return (
    <button
      onClick={handleLaunch}
      disabled={isPending}
      className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#B5E35B]/15 hover:bg-[#B5E35B]/25 text-[#B5E35B] border border-[#B5E35B]/30 font-medium text-xs transition-all disabled:opacity-50"
    >
      <Rocket className="w-3.5 h-3.5" />
      <span>{isPending ? "Launching..." : "Launch Cycle"}</span>
    </button>
  );
}

export function SubmitReviewModal({
  reviewId,
  subjectName,
  reviewType,
}: {
  reviewId: string;
  subjectName: string;
  reviewType: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [rating, setRating] = useState(5);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("reviewId", reviewId);
    formData.append("rating", rating.toString());

    startTransition(async () => {
      await submitReviewAction(formData);
      setIsOpen(false);
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-1 rounded bg-[#B5E35B] hover:bg-[#B5E35B]/90 text-[#04130C] font-semibold text-xs transition-all shadow-[0_0_8px_rgba(181,227,91,0.2)]"
      >
        Complete Review
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-md p-6 space-y-4 border border-[#2F4239] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#22302A] pb-3">
              <div>
                <h3 className="text-sm font-semibold text-[#F4FAF7]">
                  Submit {reviewType} Review for {subjectName}
                </h3>
                <span className="text-[10px] font-mono text-[#93A59B]">
                  Peer reviews are strictly anonymized for the recipient.
                </span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-[#93A59B] hover:text-[#E8F1EC]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-mono-label block mb-1.5">Overall Performance Rating</label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setRating(star)}
                      className={`p-1.5 rounded transition-all ${
                        star <= rating ? "text-[#F2B84B]" : "text-[#5F6F66]"
                      }`}
                    >
                      <Star className={`w-5 h-5 ${star <= rating ? "fill-current" : ""}`} />
                    </button>
                  ))}
                  <span className="font-mono text-xs text-[#93A59B] ml-2">{rating} / 5</span>
                </div>
              </div>

              <div>
                <label className="font-mono-label block mb-1">Key Strengths & Achievements</label>
                <textarea
                  name="strengths"
                  rows={2}
                  required
                  placeholder="What did this person excel at during this review period?"
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] placeholder-[#5F6F66] focus:outline-none focus:border-[#B5E35B]"
                />
              </div>

              <div>
                <label className="font-mono-label block mb-1">Growth Opportunities</label>
                <textarea
                  name="growthAreas"
                  rows={2}
                  required
                  placeholder="What areas or skills could be elevated for further impact?"
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] placeholder-[#5F6F66] focus:outline-none focus:border-[#B5E35B]"
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
                  className="px-4 py-1.5 rounded-lg bg-[#B5E35B] text-[#04130C] font-semibold disabled:opacity-50"
                >
                  {isPending ? "Submitting..." : "Submit Review"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ==========================================
// 2. OKR MODALS
// ==========================================

export function CreateObjectiveModal({
  parentObjectives,
  employees,
}: {
  parentObjectives: { id: string; title: string }[];
  employees: { id: string; name: string }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await createObjectiveAction(formData);
      setIsOpen(false);
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#B5E35B] hover:bg-[#B5E35B]/90 text-[#04130C] text-xs font-semibold transition-all shadow-[0_0_10px_rgba(181,227,91,0.2)]"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Add Objective</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-sm p-5 space-y-4 border border-[#2F4239]">
            <div className="flex items-center justify-between border-b border-[#22302A] pb-2.5">
              <h3 className="text-sm font-semibold text-[#F4FAF7]">Create New Objective</h3>
              <button onClick={() => setIsOpen(false)} className="text-[#93A59B] hover:text-[#E8F1EC]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-mono-label block mb-1">Objective Title</label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. Scale studio delivery capacity by 30%"
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#B5E35B]"
                />
              </div>

              <div>
                <label className="font-mono-label block mb-1">Level</label>
                <select
                  name="level"
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#B5E35B]"
                >
                  <option value={ObjectiveLevel.COMPANY}>Company Level</option>
                  <option value={ObjectiveLevel.DEPARTMENT}>Department Level</option>
                  <option value={ObjectiveLevel.INDIVIDUAL}>Individual Level</option>
                </select>
              </div>

              <div>
                <label className="font-mono-label block mb-1">Owner</label>
                <select
                  name="ownerId"
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#B5E35B]"
                >
                  <option value="">None (Company Wide)</option>
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-mono-label block mb-1">Parent Objective (Rollup)</label>
                <select
                  name="parentId"
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#B5E35B]"
                >
                  <option value="">None (Root Objective)</option>
                  {parentObjectives.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title}
                    </option>
                  ))}
                </select>
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
                  className="px-4 py-1.5 rounded-lg bg-[#B5E35B] text-[#04130C] font-semibold disabled:opacity-50"
                >
                  {isPending ? "Creating..." : "Save Objective"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

// ==========================================
// 3. 1:1 MEETING & KUDOS MODALS
// ==========================================

export function ScheduleOneOnOneModal({
  reports,
}: {
  reports: { id: string; name: string; jobTitle: string }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await scheduleOneOnOneAction(formData);
      setIsOpen(false);
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#16201B] hover:bg-[#1D2A24] text-[#E8F1EC] border border-[#2F4239] text-xs font-medium transition-all"
      >
        <Users className="w-3.5 h-3.5 text-[#B5E35B]" />
        <span>Schedule 1:1</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-sm p-5 space-y-4 border border-[#2F4239]">
            <div className="flex items-center justify-between border-b border-[#22302A] pb-2.5">
              <h3 className="text-sm font-semibold text-[#F4FAF7]">Schedule 1:1 Meeting</h3>
              <button onClick={() => setIsOpen(false)} className="text-[#93A59B] hover:text-[#E8F1EC]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-mono-label block mb-1">Direct Report</label>
                <select
                  name="reportId"
                  required
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#B5E35B]"
                >
                  {reports.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.jobTitle})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-mono-label block mb-1">Meeting Time</label>
                <input
                  type="datetime-local"
                  name="scheduledAt"
                  required
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#B5E35B]"
                />
              </div>

              <div>
                <label className="font-mono-label block mb-1">Discussion Agenda</label>
                <textarea
                  name="agenda"
                  rows={2}
                  defaultValue="Bi-weekly goals check-in, blocker review & coaching"
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#B5E35B]"
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
                  className="px-4 py-1.5 rounded-lg bg-[#B5E35B] text-[#04130C] font-semibold disabled:opacity-50"
                >
                  {isPending ? "Scheduling..." : "Schedule Meeting"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function SendKudosModal({
  colleagues,
}: {
  colleagues: { id: string; name: string }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      await sendFeedbackAction(formData);
      setIsOpen(false);
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#B5E35B] hover:bg-[#B5E35B]/90 text-[#04130C] text-xs font-semibold transition-all shadow-[0_0_10px_rgba(181,227,91,0.2)]"
      >
        <Sparkles className="w-3.5 h-3.5" />
        <span>Give Kudos</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-sm p-5 space-y-4 border border-[#2F4239]">
            <div className="flex items-center justify-between border-b border-[#22302A] pb-2.5">
              <h3 className="text-sm font-semibold text-[#F4FAF7]">Give Recognition or Feedback</h3>
              <button onClick={() => setIsOpen(false)} className="text-[#93A59B] hover:text-[#E8F1EC]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-mono-label block mb-1">Colleague</label>
                <select
                  name="toId"
                  required
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#B5E35B]"
                >
                  {colleagues.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-mono-label block mb-1">Feedback Type</label>
                <select
                  name="type"
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#B5E35B]"
                >
                  <option value={FeedbackType.PUBLIC_KUDOS}>Public Kudos (Visible in social feed)</option>
                  <option value={FeedbackType.PRIVATE_FEEDBACK}>Private Feedback (Only to recipient)</option>
                </select>
              </div>

              <div>
                <label className="font-mono-label block mb-1">Message</label>
                <textarea
                  name="message"
                  required
                  rows={3}
                  placeholder="Recognize great work, problem-solving, or collaboration..."
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#B5E35B]"
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
                  className="px-4 py-1.5 rounded-lg bg-[#B5E35B] text-[#04130C] font-semibold disabled:opacity-50"
                >
                  {isPending ? "Sending..." : "Send Recognition"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
