import { getSessionUser } from "@/lib/auth";
import { listOnboardingChecklists } from "@/modules/people/onboarding-service";
import { rawPrisma } from "@/lib/db";
import { OnboardingItemCheckbox, AssignOnboardingModal } from "./OnboardingClientComponents";
import { Sparkles, CheckCircle2, Clock, Calendar, ShieldCheck, UserPlus } from "lucide-react";
import { Role, ChecklistStatus } from "@prisma/client";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/");

  if (user.role === Role.CLIENT) {
    redirect("/portal");
  }

  const [checklists, templates, employees] = await Promise.all([
    listOnboardingChecklists(user),
    rawPrisma.onboardingTemplate.findMany({
      where: { organizationId: user.organizationId },
      include: { items: true },
    }),
    rawPrisma.employee.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, firstName: true, lastName: true, jobTitle: true },
      orderBy: { lastName: "asc" },
    }),
  ]);

  const canManage = user.role === Role.OWNER || user.role === Role.HR;

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-4xl text-[#F4FAF7]">
            New hire <span className="italic text-[#34D399]">onboarding</span>
          </h1>
          <p className="text-sm text-[#93A59B] mt-1">
            Snapshot templates, track setup progress, and automatically activate employees upon completion.
          </p>
        </div>

        {canManage && (
          <AssignOnboardingModal
            templates={templates.map((t) => ({ id: t.id, name: t.name }))}
            employees={employees.map((e) => ({
              id: e.id,
              name: `${e.firstName} ${e.lastName}`,
              jobTitle: e.jobTitle,
            }))}
          />
        )}
      </div>

      {/* Checklist Cards */}
      <div className="space-y-6">
        {checklists.length === 0 ? (
          <div className="surface-card p-12 text-center space-y-3">
            <Sparkles className="w-8 h-8 text-[#34D399] mx-auto opacity-60" />
            <h3 className="font-serif-display text-2xl text-pearl">
              No active <span className="italic text-[#34D399]">checklists</span>
            </h3>
            <p className="text-xs text-[#93A59B] max-w-sm mx-auto">
              All team members have completed their onboarding workflows, or no checklist has been assigned yet.
            </p>
          </div>
        ) : (
          checklists.map((checklist) => (
            <div key={checklist.id} className="surface-card p-6 space-y-5 spotlight-card">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-[#22302A] pb-4">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h2 className="text-base font-semibold text-[#E8F1EC]">{checklist.employeeName}</h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                        checklist.status === ChecklistStatus.COMPLETED
                          ? "bg-[#4ADE80]/15 text-[#4ADE80] border border-[#4ADE80]/30"
                          : "bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30"
                      }`}
                    >
                      {checklist.status}
                    </span>
                  </div>
                  <div className="text-xs text-[#93A59B] mt-0.5 font-mono">{checklist.templateName}</div>
                </div>

                {/* Progress bar */}
                <div className="w-full sm:w-64 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#93A59B]">Progress:</span>
                    <span className="text-[#34D399] font-semibold">{checklist.progressPct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#16201B] border border-[#2F4239] overflow-hidden">
                    <div
                      className="h-full bg-[#34D399] transition-all duration-300"
                      style={{ width: `${checklist.progressPct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-[#5F6F66] font-mono text-right">
                    {checklist.completedItems} of {checklist.totalItems} tasks completed
                  </div>
                </div>
              </div>

              {/* Tasks List */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {checklist.items.map((item) => (
                  <div
                    key={item.id}
                    className={`p-3.5 rounded-lg border transition-all flex items-start gap-3 ${
                      item.completed
                        ? "bg-[#16201B]/40 border-[#22302A] text-[#93A59B]"
                        : "bg-[#16201B] border-[#2F4239] text-[#E8F1EC]"
                    }`}
                  >
                    <div className="mt-0.5">
                      <OnboardingItemCheckbox itemId={item.id} initialCompleted={item.completed} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className={`text-xs ${item.completed ? "line-through text-[#5F6F66]" : "font-medium"}`}>
                        {item.title}
                      </div>
                      <div className="text-[10px] font-mono text-[#5F6F66] mt-1 flex items-center gap-1.5">
                        <Calendar className="w-3 h-3 text-[#2DB6A8]" />
                        <span>Due: {item.dueDate}</span>
                        {item.completedAt && (
                          <span className="text-[#34D399]">
                            • Done on {item.completedAt.split("T")[0]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {checklist.status === ChecklistStatus.COMPLETED && (
                <div className="p-3 rounded-lg bg-[#4ADE80]/10 border border-[#4ADE80]/30 text-xs text-[#4ADE80] flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                  <span>
                    All onboarding tasks are complete! Employee status has been automatically activated.
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Templates Reference Section */}
      <div className="surface-card p-6 space-y-4">
        <h3 className="font-mono-label">Available Onboarding Templates</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <div key={tpl.id} className="p-4 rounded-lg bg-[#16201B] border border-[#2F4239] space-y-2">
              <div className="text-sm font-semibold text-[#E8F1EC]">{tpl.name}</div>
              <div className="text-xs text-[#93A59B]">{tpl.items.length} standardized checklist tasks</div>
              <div className="text-[10px] font-mono text-[#5F6F66]">
                Offsets: Day 1 through Day {Math.max(...tpl.items.map((i) => i.dayOffset), 1)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
