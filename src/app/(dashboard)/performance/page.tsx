import { getSessionUser } from "@/lib/auth";
import {
  listReviewCycles,
  listReviewsForSubject,
  listObjectives,
  listOneOnOnes,
  listPublicKudos,
  listPrivateFeedback,
} from "@/modules/performance/service";
import { rawPrisma } from "@/lib/db";
import {
  CreateReviewCycleModal,
  LaunchCycleButton,
  CloseCycleButton,
  SubmitReviewModal,
  ReviewsReaderModal,
  CreateObjectiveModal,
  AddKeyResultModal,
  UpdateKeyResultModal,
  ScheduleOneOnOneModal,
  OneOnOneNotesModal,
  SendKudosModal,
} from "./PerformanceClientComponents";
import {
  Target,
  Users,
  Sparkles,
  Calendar,
  CheckCircle2,
  Clock,
  Star,
  MessageSquare,
  ArrowRight,
  TrendingUp,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { Role, ReviewStatus, ReviewCycleStatus, ReviewType } from "@prisma/client";
import { redirect } from "next/navigation";

export default async function PerformancePage() {
  const user = await getSessionUser();
  if (!user) redirect("/");

  if (user.role === Role.CLIENT) {
    redirect("/portal");
  }

  const [
    cycles,
    objectives,
    oneOnOnes,
    kudos,
    privateFeedback,
    myReviews,
    pendingReviews,
    allEmployees,
    projects,
  ] = await Promise.all([
    listReviewCycles(user),
    listObjectives(user),
    listOneOnOnes(user),
    listPublicKudos(user),
    listPrivateFeedback(user),
    user.employeeId ? listReviewsForSubject(user.employeeId, user) : Promise.resolve([]),
    user.employeeId
      ? rawPrisma.review.findMany({
          where: {
            authorId: user.employeeId,
            status: ReviewStatus.DRAFT,
            cycle: { status: ReviewCycleStatus.ACTIVE },
          },
          include: {
            subject: { select: { firstName: true, lastName: true } },
          },
        })
      : [],
    rawPrisma.employee.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, firstName: true, lastName: true, jobTitle: true, managerId: true },
      orderBy: { lastName: "asc" },
    }),
    rawPrisma.project.findMany({
      where: { organizationId: user.organizationId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const canManage = user.role === Role.OWNER || user.role === Role.HR;
  const directReports = allEmployees.filter((e) => e.managerId === user.employeeId);

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-4xl text-[#F4FAF7]">
            Talent & <span className="italic text-[#B5E35B]">performance</span>
          </h1>
          <p className="text-sm text-[#93A59B] mt-1">
            360 performance reviews with peer anonymity, hierarchical OKR rollups, private 1:1 agendas, and peer kudos.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {canManage && <CreateReviewCycleModal />}
          <SendKudosModal
            colleagues={allEmployees
              .filter((e) => e.id !== user.employeeId)
              .map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))}
          />
        </div>
      </div>

      {/* Action Required: Pending Reviews to Write */}
      {pendingReviews.length > 0 && (
        <div className="surface-card p-5 border-l-4 border-l-[#B5E35B] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#B5E35B]" />
              <h3 className="text-sm font-semibold text-[#F4FAF7]">
                Action Required: Pending 360 Reviews ({pendingReviews.length})
              </h3>
            </div>
            <span className="text-[11px] font-mono text-[#93A59B]">Active Cycle</span>
          </div>

          <div className="divide-y divide-[#22302A]">
            {pendingReviews.map((rev) => (
              <div key={rev.id} className="py-2.5 flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-medium text-[#E8F1EC]">
                    {rev.type === ReviewType.SELF
                      ? "Self Evaluation"
                      : `${rev.type} Review for ${rev.subject.firstName} ${rev.subject.lastName}`}
                  </span>
                  <span className="ml-2 font-mono text-[10px] uppercase text-[#B5E35B] bg-[#B5E35B]/15 px-2 py-0.5 rounded border border-[#B5E35B]/30">
                    {rev.type}
                  </span>
                </div>

                <SubmitReviewModal
                  reviewId={rev.id}
                  subjectName={`${rev.subject.firstName} ${rev.subject.lastName}`}
                  reviewType={rev.type}
                />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 1: OKR HIERARCHY */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-[#22302A] pb-3">
          <div className="flex items-center gap-2">
            <Target className="w-5 h-5 text-[#B5E35B]" />
            <h2 className="text-base font-semibold text-[#F4FAF7]">Quarterly Objectives & Key Results (OKRs)</h2>
          </div>

          <CreateObjectiveModal
            parentObjectives={objectives.map((o) => ({ id: o.id, title: o.title }))}
            employees={allEmployees.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}` }))}
          />
        </div>

        <div className="space-y-4">
          {objectives.length === 0 ? (
            <div className="surface-card p-8 text-center text-xs text-[#5F6F66]">
              No objectives recorded. Click &ldquo;Add Objective&rdquo; to start setting strategic company goals.
            </div>
          ) : (
            objectives.map((obj) => (
              <div key={obj.id} className="surface-card p-5 space-y-4 spotlight-card">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-[#B5E35B] bg-[#B5E35B]/15 px-2 py-0.5 rounded border border-[#B5E35B]/30">
                        {obj.level}
                      </span>
                      <h3 className="text-sm font-semibold text-[#E8F1EC]">{obj.title}</h3>
                    </div>
                    {obj.parentTitle && (
                      <div className="text-[11px] font-mono text-[#5F6F66] flex items-center gap-1">
                        <span>Rolls into:</span>
                        <span className="text-[#93A59B]">{obj.parentTitle}</span>
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="w-full sm:w-56 space-y-1">
                    <div className="flex items-center justify-between font-mono text-xs">
                      <span className="text-[#93A59B]">Progress</span>
                      <span className="text-[#B5E35B] font-bold">{obj.progressPct}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-[#16201B] border border-[#2F4239] overflow-hidden">
                      <div
                        className="h-full bg-[#B5E35B] transition-all"
                        style={{ width: `${obj.progressPct}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Key Results Header & Add Button */}
                <div className="flex items-center justify-between pt-2 border-t border-[#22302A]">
                  <span className="font-mono-label text-[10px] text-[#93A59B]">
                    Key Results ({obj.keyResults.length})
                  </span>
                  <AddKeyResultModal
                    objectiveId={obj.id}
                    objectiveTitle={obj.title}
                    projects={projects}
                  />
                </div>

                {/* Key Results Grid */}
                {obj.keyResults.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {obj.keyResults.map((kr) => (
                      <div
                        key={kr.id}
                        className="p-3 rounded-lg bg-[#16201B] border border-[#2F4239] flex items-center justify-between text-xs font-mono"
                      >
                        <div className="space-y-0.5 max-w-[200px]">
                          <div className="text-[#E8F1EC] truncate">{kr.title}</div>
                          <div className="text-[10px] text-[#5F6F66]">
                            Target: {kr.targetValue} {kr.unit} (Current: {kr.currentValue})
                          </div>
                        </div>
                        <UpdateKeyResultModal
                          keyResultId={kr.id}
                          title={kr.title}
                          currentValue={kr.currentValue}
                          targetValue={kr.targetValue}
                          unit={kr.unit}
                          progressPct={kr.progressPct}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* SECTION 2: 360 REVIEW CYCLES & 1:1s */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* 360 Cycles */}
        <div className="surface-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#22302A] pb-3">
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-[#B5E35B]" />
              <h3 className="text-sm font-semibold text-[#F4FAF7]">360 Review Cycles</h3>
            </div>
            <span className="text-[11px] font-mono text-[#5F6F66]">{cycles.length} Cycles</span>
          </div>

          <div className="space-y-3">
            {cycles.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#5F6F66]">
                No review cycles configured.
              </div>
            ) : (
              cycles.map((c) => (
                <div key={c.id} className="p-3.5 rounded-lg bg-[#16201B] border border-[#2F4239] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-[#E8F1EC]">{c.name}</span>
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                        c.status === ReviewCycleStatus.ACTIVE
                          ? "bg-[#B5E35B]/15 text-[#B5E35B] border border-[#B5E35B]/30"
                          : "bg-[#1D2A24] text-[#93A59B] border border-[#2F4239]"
                      }`}
                    >
                      {c.status}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-[11px] font-mono text-[#93A59B]">
                    <span>
                      {c.startDate} → {c.endDate}
                    </span>
                    <span>
                      {c.completedReviews} / {c.totalReviews} Submitted ({c.progressPct}%)
                    </span>
                  </div>

                  <div className="pt-2 border-t border-[#22302A] flex items-center justify-between gap-2">
                    {myReviews.length > 0 ? (
                      <ReviewsReaderModal
                        cycleName={c.name}
                        subjectName="Yourself"
                        reviews={myReviews}
                      />
                    ) : (
                      <div />
                    )}

                    <div className="flex items-center gap-2">
                      {c.status === ReviewCycleStatus.DRAFT && canManage && (
                        <LaunchCycleButton cycleId={c.id} />
                      )}
                      {c.status === ReviewCycleStatus.ACTIVE && canManage && (
                        <CloseCycleButton cycleId={c.id} />
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 1:1 Check-ins */}
        <div className="surface-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#22302A] pb-3">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#34D399]" />
              <h3 className="text-sm font-semibold text-[#F4FAF7]">Private 1:1 Check-ins</h3>
            </div>
            {directReports.length > 0 && (
              <ScheduleOneOnOneModal
                reports={directReports.map((r) => ({
                  id: r.id,
                  name: `${r.firstName} ${r.lastName}`,
                  jobTitle: r.jobTitle,
                }))}
              />
            )}
          </div>

          <div className="space-y-3">
            {oneOnOnes.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#5F6F66]">
                No scheduled 1:1 meetings. Notes are strictly confidential between manager and report.
              </div>
            ) : (
              oneOnOnes.map((m) => (
                <div key={m.id} className="p-3.5 rounded-lg bg-[#16201B] border border-[#2F4239] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#E8F1EC]">
                      {m.managerName} & {m.reportName}
                    </span>
                    <span className="font-mono text-[10px] text-[#93A59B]">
                      {new Date(m.scheduledAt).toLocaleDateString()}
                    </span>
                  </div>

                  {m.agenda && (
                    <p className="text-[11px] text-[#93A59B] italic line-clamp-1">
                      Agenda: “{m.agenda}”
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-[#22302A]/60">
                    <span className="text-[10px] font-mono text-[#34D399]">
                      {m.actionItems.filter((a) => a.completed).length} of {m.actionItems.length} Action Items Done
                    </span>
                    <OneOnOneNotesModal
                      meetingId={m.id}
                      managerName={m.managerName}
                      reportName={m.reportName}
                      scheduledAt={m.scheduledAt}
                      initialNotes={m.notes}
                      initialActionItems={m.actionItems}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* SECTION 3: SOCIAL KUDOS & PRIVATE FEEDBACK */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Public Kudos Feed */}
        <div className="surface-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#22302A] pb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#B5E35B]" />
              <h3 className="text-sm font-semibold text-[#F4FAF7]">Community Kudos Feed</h3>
            </div>
            <span className="text-xs font-mono text-[#5F6F66]">Visible Studio-Wide</span>
          </div>

          <div className="space-y-3">
            {kudos.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#5F6F66]">
                No kudos posted yet. Click &ldquo;Give Kudos&rdquo; to recognize a peer!
              </div>
            ) : (
              kudos.map((k) => (
                <div key={k.id} className="p-3.5 rounded-xl bg-[#16201B] border border-[#2F4239] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#E8F1EC]">{k.fromName}</span>
                    <span className="text-[#B5E35B] font-mono text-[10px]">→ {k.toName}</span>
                  </div>
                  <p className="text-xs text-[#93A59B] leading-relaxed">“{k.message}”</p>
                  <div className="text-[10px] font-mono text-[#5F6F66] text-right">{k.createdAt}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Confidential Private Feedback Inbox */}
        <div className="surface-card p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-[#22302A] pb-3">
            <div className="flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#34D399]" />
              <h3 className="text-sm font-semibold text-[#F4FAF7]">Confidential Feedback Inbox</h3>
            </div>
            <span className="text-xs font-mono text-[#34D399]">Only You & Sender</span>
          </div>

          <div className="space-y-3">
            {privateFeedback.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#5F6F66]">
                No private feedback in your inbox. Constructive feedback received directly will appear here.
              </div>
            ) : (
              privateFeedback.map((f) => (
                <div key={f.id} className="p-3.5 rounded-xl bg-[#16201B] border border-[#2F4239] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <Lock className="w-3 h-3 text-[#34D399]" />
                      <span className="font-medium text-[#E8F1EC]">
                        {f.fromId === user.employeeId ? `Sent to ${f.toName}` : `From ${f.fromName}`}
                      </span>
                    </div>
                    <span className="text-[10px] font-mono text-[#5F6F66]">{f.createdAt}</span>
                  </div>
                  <p className="text-xs text-[#E8F1EC] leading-relaxed italic bg-[#0F1613] p-2.5 rounded-lg border border-[#22302A]">
                    “{f.message}”
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
