"use client";

import { useState, useTransition } from "react";
import { requestLeaveAction, decideLeaveAction, cancelLeaveAction } from "@/app/actions/hr-actions";
import { LeaveBalanceDTO } from "@/modules/people/schema";
import { Plus, Check, X, Calendar, AlertCircle, ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

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

interface TeamLeaveCalendarProps {
  approvedLeaves: Array<{
    id: string;
    employeeName: string;
    leaveTypeName: string;
    startDate: string;
    endDate: string;
    daysCount: number;
  }>;
  publicHolidays: Array<{
    name: string;
    date: string;
  }>;
}

export function TeamLeaveCalendar({ approvedLeaves, publicHolidays }: TeamLeaveCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const daysInMonth = lastDayOfMonth.getDate();

  // Monday = 0, Sunday = 6
  const startDayOfWeek = (firstDayOfMonth.getDay() + 6) % 7;

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  const calendarDays = [];
  for (let i = 0; i < startDayOfWeek; i++) {
    calendarDays.push(null);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(d);
  }

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="surface-card p-6 space-y-4">
      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#22302A] pb-3">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-[#34D399]" />
          <div>
            <h3 className="text-base font-semibold text-[#F4FAF7]">Team Leave Calendar</h3>
            <span className="text-[11px] font-mono text-[#5F6F66]">
              Real-time studio out-of-office schedule
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold font-mono text-[#E8F1EC] mr-2">
            {monthNames[month]} {year}
          </span>
          <button
            onClick={handlePrevMonth}
            className="p-1.5 rounded-lg bg-[#16201B] hover:bg-[#1D2A24] text-[#93A59B] hover:text-[#E8F1EC] border border-[#22302A] transition-all"
            title="Previous Month"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={handleToday}
            className="px-2.5 py-1 rounded-lg bg-[#16201B] hover:bg-[#1D2A24] text-[11px] font-mono text-[#34D399] border border-[#22302A] transition-all"
          >
            Today
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1.5 rounded-lg bg-[#16201B] hover:bg-[#1D2A24] text-[#93A59B] hover:text-[#E8F1EC] border border-[#22302A] transition-all"
            title="Next Month"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekday Names */}
      <div className="grid grid-cols-7 gap-2 text-center text-xs font-mono font-semibold text-[#5F6F66]">
        <div>MON</div>
        <div>TUE</div>
        <div>WED</div>
        <div>THU</div>
        <div>FRI</div>
        <div>SAT</div>
        <div>SUN</div>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-7 gap-2">
        {calendarDays.map((day, idx) => {
          if (!day) {
            return (
              <div
                key={`empty-${idx}`}
                className="min-h-[85px] rounded-lg bg-[#0F1613]/30 border border-transparent"
              />
            );
          }

          const padMonth = String(month + 1).padStart(2, "0");
          const padDay = String(day).padStart(2, "0");
          const dateStr = `${year}-${padMonth}-${padDay}`;
          const isToday = dateStr === todayStr;

          // Find holidays for this date
          const holiday = publicHolidays.find((h) => h.date.startsWith(dateStr));

          // Find leaves active on this date
          const leavesOnDay = approvedLeaves.filter(
            (l) => l.startDate <= dateStr && dateStr <= l.endDate
          );

          return (
            <div
              key={dateStr}
              className={`min-h-[85px] p-2 rounded-lg border transition-all flex flex-col justify-between ${
                isToday
                  ? "bg-[#16201B] border-[#34D399]/60 shadow-[0_0_8px_rgba(52,211,153,0.15)]"
                  : "bg-[#16201B]/50 hover:bg-[#16201B] border-[#22302A]"
              }`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-mono font-semibold ${
                    isToday ? "text-[#34D399]" : "text-[#93A59B]"
                  }`}
                >
                  {day}
                </span>

                {holiday && (
                  <span
                    className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#F2B84B]/15 text-[#F2B84B] border border-[#F2B84B]/30 truncate max-w-[65px]"
                    title={holiday.name}
                  >
                    {holiday.name}
                  </span>
                )}
              </div>

              {/* Leave Pills */}
              <div className="space-y-1 mt-1 overflow-hidden">
                {leavesOnDay.map((leave) => (
                  <div
                    key={leave.id}
                    className="p-1 rounded bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30 text-[10px] font-mono leading-tight truncate"
                    title={`${leave.employeeName} (${leave.leaveTypeName})`}
                  >
                    <span className="font-semibold">{leave.employeeName}</span>
                    <span className="text-[#93A59B] ml-1">({leave.leaveTypeName.split(" ")[0]})</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
