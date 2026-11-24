"use client";

import { useState, useTransition } from "react";
import { toggleOnboardingItemAction, startOnboardingAction } from "@/app/actions/hr-actions";
import { Check, Plus, X, Sparkles, UserCheck } from "lucide-react";

export function OnboardingItemCheckbox({
  itemId,
  initialCompleted,
}: {
  itemId: string;
  initialCompleted: boolean;
}) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [isPending, startTransition] = useTransition();

  const handleToggle = () => {
    const nextState = !completed;
    setCompleted(nextState);

    startTransition(async () => {
      await toggleOnboardingItemAction(itemId, nextState);
    });
  };

  return (
    <button
      onClick={handleToggle}
      disabled={isPending}
      className={`w-5 h-5 rounded border flex items-center justify-center transition-all ${
        completed
          ? "bg-[#34D399] border-[#34D399] text-[#04130C]"
          : "bg-[#16201B] border-[#2F4239] hover:border-[#34D399]/50"
      } ${isPending ? "opacity-50" : ""}`}
    >
      {completed && <Check className="w-3.5 h-3.5 stroke-[3]" />}
    </button>
  );
}

interface AssignModalProps {
  employees: { id: string; name: string; jobTitle: string }[];
  templates: { id: string; name: string }[];
}

export function AssignOnboardingModal({ employees, templates }: AssignModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const employeeId = formData.get("employeeId") as string;
    const templateId = formData.get("templateId") as string;

    startTransition(async () => {
      try {
        await startOnboardingAction(employeeId, templateId);
        setIsOpen(false);
      } catch (err: any) {
        setError(err.message || "Failed to start onboarding");
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
        <span>Assign Onboarding</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-md p-6 space-y-5 border border-[#2F4239] animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#22302A] pb-3">
              <h3 className="text-base font-semibold text-[#F4FAF7]">Assign Onboarding Checklist</h3>
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
                <label className="font-mono-label block mb-1">Select Employee</label>
                <select
                  name="employeeId"
                  required
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                >
                  {employees.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name} — {e.jobTitle}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-mono-label block mb-1">Onboarding Template</label>
                <select
                  name="templateId"
                  required
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                >
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
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
                  className="px-4 py-1.5 rounded-lg bg-[#34D399] text-[#04130C] font-semibold disabled:opacity-50"
                >
                  {isPending ? "Assigning..." : "Assign Checklist"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
