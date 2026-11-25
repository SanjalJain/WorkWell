"use client";

import { useState, useTransition } from "react";
import {
  createReviewCycleAction,
  launchReviewCycleAction,
  closeReviewCycleAction,
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
  Sliders,
  Eye,
  BookOpen,
  Edit3,
  ShieldCheck,
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

// ==========================================
// 4. CYCLE CLOSURE & 360 REVIEWS READER
// ==========================================

export function CloseCycleButton({ cycleId }: { cycleId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleClose = () => {
    if (!confirm("Finalize and close this review cycle? All feedback will be locked.")) return;
    startTransition(async () => {
      await closeReviewCycleAction(cycleId);
    });
  };

  return (
    <button
      onClick={handleClose}
      disabled={isPending}
      className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#16201B] hover:bg-[#1D2A24] text-[#93A59B] hover:text-[#E8F1EC] border border-[#22302A] font-medium text-xs transition-all disabled:opacity-50"
    >
      <CheckCircle2 className="w-3.5 h-3.5 text-[#34D399]" />
      <span>{isPending ? "Closing..." : "Close Cycle"}</span>
    </button>
  );
}

export function ReviewsReaderModal({
  cycleName,
  subjectName,
  reviews,
}: {
  cycleName: string;
  subjectName: string;
  reviews: Array<{
    id: string;
    type: string;
    rating?: number | null;
    authorName?: string | null;
    isAnonymized?: boolean;
    content?: any;
    submittedAt?: string | null;
  }>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("ALL");

  const filteredReviews =
    activeTab === "ALL" ? reviews : reviews.filter((r) => r.type === activeTab);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1 rounded bg-[#16201B] hover:bg-[#1D2A24] text-[#B5E35B] border border-[#2F4239] text-xs font-medium transition-all"
      >
        <BookOpen className="w-3.5 h-3.5" />
        <span>View 360 Feedback ({reviews.length})</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-2xl max-h-[85vh] flex flex-col border border-[#2F4239] animate-in fade-in zoom-in-95">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#22302A] flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono-label text-[#B5E35B]">360 Performance Dossier</span>
                  <span className="text-xs font-mono text-[#5F6F66]">&bull; {cycleName}</span>
                </div>
                <h3 className="text-base font-semibold text-[#F4FAF7] mt-0.5">
                  Evaluation for {subjectName}
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#93A59B] hover:text-[#E8F1EC] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="px-5 pt-3 pb-2 border-b border-[#22302A] flex items-center gap-2 text-xs font-mono">
              {["ALL", "SELF", "MANAGER", "PEER"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    activeTab === tab
                      ? "bg-[#B5E35B]/15 text-[#B5E35B] border border-[#B5E35B]/30 font-semibold"
                      : "text-[#93A59B] hover:text-[#E8F1EC]"
                  }`}
                >
                  {tab === "ALL" ? `All (${reviews.length})` : tab}
                </button>
              ))}
            </div>

            {/* Content List */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {filteredReviews.length === 0 ? (
                <div className="p-8 text-center text-xs text-[#5F6F66]">
                  No submitted reviews found under this filter.
                </div>
              ) : (
                filteredReviews.map((rev) => {
                  const content = rev.content || {};
                  return (
                    <div
                      key={rev.id}
                      className="p-4 rounded-xl bg-[#16201B] border border-[#2F4239] space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-[#B5E35B] bg-[#B5E35B]/15 px-2 py-0.5 rounded border border-[#B5E35B]/30">
                            {rev.type}
                          </span>
                          <span className="text-xs font-semibold text-[#E8F1EC]">
                            {rev.authorName}
                          </span>
                          {rev.isAnonymized && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono text-[#34D399] bg-[#34D399]/10 px-1.5 py-0.5 rounded border border-[#34D399]/30">
                              <ShieldCheck className="w-3 h-3" />
                              <span>Anonymized</span>
                            </span>
                          )}
                        </div>

                        {rev.rating && (
                          <div className="flex items-center gap-1 font-mono text-xs text-[#F2B84B]">
                            <Star className="w-3.5 h-3.5 fill-current" />
                            <span>{rev.rating}/5</span>
                          </div>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="space-y-1 p-3 rounded-lg bg-[#0F1613] border border-[#22302A]">
                          <span className="font-mono-label text-[#34D399] block">
                            Core Strengths
                          </span>
                          <p className="text-[#E8F1EC] leading-relaxed">
                            {content.strengths || "No strengths noted."}
                          </p>
                        </div>

                        <div className="space-y-1 p-3 rounded-lg bg-[#0F1613] border border-[#22302A]">
                          <span className="font-mono-label text-[#F2B84B] block">
                            Growth Opportunities
                          </span>
                          <p className="text-[#E8F1EC] leading-relaxed">
                            {content.growthAreas || "No growth areas noted."}
                          </p>
                        </div>
                      </div>

                      {content.generalNotes && (
                        <div className="text-xs text-[#93A59B] italic pt-1">
                          &ldquo;{content.generalNotes}&rdquo;
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-[#22302A] flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-[#16201B] hover:bg-[#1D2A24] text-xs text-[#93A59B] hover:text-[#E8F1EC] border border-[#22302A]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ==========================================
// 5. KEY RESULT CREATION & PROGRESS UPDATES
// ==========================================

export function AddKeyResultModal({
  objectiveId,
  objectiveTitle,
  projects,
}: {
  objectiveId: string;
  objectiveTitle: string;
  projects: { id: string; name: string }[];
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    formData.append("objectiveId", objectiveId);

    startTransition(async () => {
      await createKeyResultAction(formData);
      setIsOpen(false);
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-1 text-[11px] font-mono text-[#B5E35B] hover:underline"
      >
        <Plus className="w-3 h-3" />
        <span>Add Key Result</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-sm p-5 space-y-4 border border-[#2F4239]">
            <div className="flex items-center justify-between border-b border-[#22302A] pb-2.5">
              <div>
                <span className="font-mono-label text-[#B5E35B]">Add Key Result</span>
                <h3 className="text-sm font-semibold text-[#F4FAF7] truncate max-w-[260px]">
                  {objectiveTitle}
                </h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-[#93A59B] hover:text-[#E8F1EC]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3 text-xs">
              <div>
                <label className="font-mono-label block mb-1">Key Result Title</label>
                <input
                  type="text"
                  name="title"
                  required
                  placeholder="e.g. Complete 100% of migration tasks"
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#B5E35B]"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="font-mono-label block mb-1">Start</label>
                  <input
                    type="number"
                    step="any"
                    name="startValue"
                    defaultValue="0"
                    required
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-2.5 py-1.5 text-[#E8F1EC] focus:outline-none focus:border-[#B5E35B]"
                  />
                </div>
                <div>
                  <label className="font-mono-label block mb-1">Target</label>
                  <input
                    type="number"
                    step="any"
                    name="targetValue"
                    defaultValue="100"
                    required
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-2.5 py-1.5 text-[#E8F1EC] focus:outline-none focus:border-[#B5E35B]"
                  />
                </div>
                <div>
                  <label className="font-mono-label block mb-1">Unit</label>
                  <input
                    type="text"
                    name="unit"
                    defaultValue="%"
                    required
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-2.5 py-1.5 text-[#E8F1EC] focus:outline-none focus:border-[#B5E35B]"
                  />
                </div>
              </div>

              <div>
                <label className="font-mono-label block mb-1">Linked Project (Optional)</label>
                <select
                  name="projectId"
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#B5E35B]"
                >
                  <option value="">None (Manual Metric)</option>
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-[#5F6F66] mt-0.5 block">
                  If linked, progress updates automatically as project tasks move to Done!
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
                  className="px-4 py-1.5 rounded-lg bg-[#B5E35B] text-[#04130C] font-semibold disabled:opacity-50"
                >
                  {isPending ? "Adding..." : "Add Metric"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function UpdateKeyResultModal({
  keyResultId,
  title,
  currentValue,
  targetValue,
  unit,
  progressPct,
}: {
  keyResultId: string;
  title: string;
  currentValue: number;
  targetValue: number;
  unit: string;
  progressPct: number;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [val, setVal] = useState(currentValue);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    startTransition(async () => {
      await updateKeyResultValueAction(keyResultId, val);
      setIsOpen(false);
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-2 py-1 rounded bg-[#1D2A24] hover:bg-[#2DB6A8]/20 text-[#B5E35B] hover:text-[#E8F1EC] border border-[#2F4239] font-bold font-mono transition-all text-xs"
        title="Click to update key result progress"
      >
        {progressPct}%
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-sm p-5 space-y-4 border border-[#2F4239]">
            <div className="flex items-center justify-between border-b border-[#22302A] pb-2.5">
              <div>
                <span className="font-mono-label text-[#B5E35B]">Update Metric</span>
                <h3 className="text-sm font-semibold text-[#F4FAF7] truncate max-w-[260px]">
                  {title}
                </h3>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-[#93A59B] hover:text-[#E8F1EC]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="space-y-2">
                <div className="flex justify-between font-mono text-xs">
                  <span className="text-[#93A59B]">Current: {val} {unit}</span>
                  <span className="text-[#B5E35B] font-semibold">Target: {targetValue} {unit}</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max={Math.max(targetValue, 100)}
                  step="1"
                  value={val}
                  onChange={(e) => setVal(parseFloat(e.target.value))}
                  className="w-full accent-[#B5E35B] cursor-pointer"
                />
                <input
                  type="number"
                  step="any"
                  value={val}
                  onChange={(e) => setVal(parseFloat(e.target.value) || 0)}
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-1.5 text-[#E8F1EC] font-mono text-center focus:outline-none focus:border-[#B5E35B]"
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
                  {isPending ? "Saving..." : "Save Progress"}
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
// 6. 1:1 MEETING NOTES & ACTION ITEMS DRAWER
// ==========================================

export function OneOnOneNotesModal({
  meetingId,
  managerName,
  reportName,
  scheduledAt,
  initialNotes,
  initialActionItems,
}: {
  meetingId: string;
  managerName: string;
  reportName: string;
  scheduledAt: string;
  initialNotes?: string | null;
  initialActionItems: Array<{ id: string; text: string; completed: boolean }>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [notes, setNotes] = useState(initialNotes || "");
  const [actionItems, setActionItems] = useState(initialActionItems || []);
  const [newItemText, setNewItemText] = useState("");

  const handleToggleAction = (index: number) => {
    const updated = [...actionItems];
    updated[index].completed = !updated[index].completed;
    setActionItems(updated);
  };

  const handleAddAction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemText.trim()) return;
    setActionItems([
      ...actionItems,
      { id: Date.now().toString(), text: newItemText.trim(), completed: false },
    ]);
    setNewItemText("");
  };

  const handleSave = () => {
    startTransition(async () => {
      await updateOneOnOneNotesAction(meetingId, notes, actionItems);
      setIsOpen(false);
    });
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-1 text-[11px] text-[#34D399] hover:underline font-mono"
      >
        <Edit3 className="w-3 h-3" />
        <span>Notes & Action Items</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-lg p-6 space-y-4 border border-[#2F4239] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#22302A] pb-3">
              <div>
                <span className="font-mono-label text-[#34D399]">Private 1:1 Session</span>
                <h3 className="text-base font-semibold text-[#F4FAF7]">
                  {managerName} & {reportName}
                </h3>
                <span className="text-[10px] font-mono text-[#93A59B]">
                  {new Date(scheduledAt).toLocaleString()}
                </span>
              </div>
              <button onClick={() => setIsOpen(false)} className="text-[#93A59B] hover:text-[#E8F1EC]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Notes Section */}
            <div className="space-y-1.5">
              <label className="font-mono-label block text-xs">Shared Confidential Notes</label>
              <textarea
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Key takeaways, career coaching notes, feedback discussed..."
                className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg p-3 text-xs text-[#E8F1EC] placeholder-[#5F6F66] focus:outline-none focus:border-[#34D399]"
              />
            </div>

            {/* Action Items */}
            <div className="space-y-2">
              <label className="font-mono-label block text-xs">
                Action Items ({actionItems.filter((a) => a.completed).length}/{actionItems.length} Done)
              </label>

              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {actionItems.map((item, idx) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-2 p-2 rounded bg-[#16201B] border border-[#22302A] text-xs"
                  >
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={() => handleToggleAction(idx)}
                      className="accent-[#34D399] rounded cursor-pointer"
                    />
                    <span
                      className={`flex-1 ${
                        item.completed ? "line-through text-[#5F6F66]" : "text-[#E8F1EC]"
                      }`}
                    >
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>

              {/* Add Action Item Row */}
              <form onSubmit={handleAddAction} className="flex gap-2 pt-1">
                <input
                  type="text"
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  placeholder="New action item..."
                  className="flex-1 bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-1.5 text-xs text-[#E8F1EC] placeholder-[#5F6F66] focus:outline-none focus:border-[#34D399]"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-[#16201B] hover:bg-[#1D2A24] text-xs text-[#34D399] border border-[#2F4239]"
                >
                  Add
                </button>
              </form>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#22302A]">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 rounded-lg bg-[#16201B] text-[#93A59B] text-xs"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isPending}
                className="px-4 py-1.5 rounded-lg bg-[#34D399] text-[#04130C] font-semibold text-xs disabled:opacity-50"
              >
                {isPending ? "Saving..." : "Save Notes & Actions"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
