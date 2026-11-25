import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Role, TaskStatus, LeaveStatus } from "@prisma/client";
import { getExecutiveDashboardMetrics } from "@/modules/shared/service";
import { canViewCompensation } from "@/modules/people/policies";
import { getLeaveBalances } from "@/modules/people/leave-service";
import { ExecutiveCharts } from "@/components/dashboard/ExecutiveCharts";
import { rawPrisma } from "@/lib/db";
import Link from "next/link";
import {
  Users,
  FolderKanban,
  Clock,
  TrendingUp,
  Receipt,
  Heart,
  Calendar,
  AlertTriangle,
  Lock,
  CheckCircle2,
  ListTodo,
  FileText,
  Target,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";

export default async function DashboardPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/directory");
  }

  if (user.role === Role.CLIENT) {
    redirect("/portal");
  }

  // -------------------------------------------------------------
  // 1. EMPLOYEE PERSONAL FOCUS DASHBOARD
  // -------------------------------------------------------------
  if (user.role === Role.EMPLOYEE && user.employeeId) {
    const employeeId = user.employeeId;
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - ((weekStart.getDay() + 6) % 7));
    weekStart.setHours(0, 0, 0, 0);

    const [
      employee,
      myTasks,
      leaveBalances,
      pendingLeaves,
      oneOnOnes,
      kudosList,
      weekEntries,
      myObjectives,
    ] = await Promise.all([
      rawPrisma.employee.findUnique({
        where: { id: employeeId },
        include: { department: true, manager: true },
      }),
      rawPrisma.task.findMany({
        where: {
          assigneeId: employeeId,
          organizationId: user.organizationId,
          status: { not: TaskStatus.DONE },
        },
        include: { project: true },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 6,
      }),
      getLeaveBalances(employeeId, user.organizationId),
      rawPrisma.leaveRequest.findMany({
        where: {
          employeeId,
          status: LeaveStatus.PENDING,
        },
        include: { leaveType: true },
        orderBy: { startDate: "asc" },
      }),
      rawPrisma.oneOnOne.findMany({
        where: {
          organizationId: user.organizationId,
          OR: [{ reportId: employeeId }, { managerId: employeeId }],
          scheduledAt: { gte: now },
        },
        include: { manager: true, report: true },
        orderBy: { scheduledAt: "asc" },
        take: 3,
      }),
      rawPrisma.feedback.findMany({
        where: {
          organizationId: user.organizationId,
          OR: [{ toId: employeeId }, { fromId: employeeId }],
        },
        include: {
          sender: { select: { firstName: true, lastName: true } },
          receiver: { select: { firstName: true, lastName: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 4,
      }),
      rawPrisma.timeEntry.findMany({
        where: {
          employeeId,
          date: { gte: weekStart },
        },
      }),
      rawPrisma.objective.findMany({
        where: {
          ownerId: employeeId,
          organizationId: user.organizationId,
        },
        include: { keyResults: true },
        take: 3,
      }),
    ]);

    const totalHoursThisWeek = weekEntries.reduce((sum, e) => sum + Number(e.hours), 0);
    const billableHoursThisWeek = weekEntries
      .filter((e) => e.billable)
      .reduce((sum, e) => sum + Number(e.hours), 0);

    const annualBalance = leaveBalances.find((b) =>
      b.name.toLowerCase().includes("annual")
    ) || leaveBalances[0];

    return (
      <div className="space-y-8 max-w-7xl mx-auto pb-16">
        {/* Welcome Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-serif-display text-3xl sm:text-4xl font-normal text-[#F4FAF7]">
              Welcome back,{" "}
              <span className="italic text-[#34D399]">
                {employee?.firstName || user.name.split(" ")[0]}
              </span>
            </h1>
            <p className="text-sm text-[#93A59B] mt-1">
              Personal mission control — your assigned delivery work, time, leaves, and team syncs.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/timesheets"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#34D399] hover:bg-[#34D399]/90 text-[#04130C] shadow-[0_0_12px_rgba(52,211,153,0.2)] transition-all"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>Log Time</span>
            </Link>
            <Link
              href="/leave"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-[#16201B] hover:bg-[#1D2A24] text-[#E8F1EC] border border-[#2F4239] transition-colors"
            >
              <Calendar className="w-3.5 h-3.5 text-[#34D399]" />
              <span>Request Leave</span>
            </Link>
            <Link
              href="/performance"
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium bg-[#16201B] hover:bg-[#1D2A24] text-[#E8F1EC] border border-[#2F4239] transition-colors"
            >
              <Heart className="w-3.5 h-3.5 text-[#B5E35B]" />
              <span>Give Kudos</span>
            </Link>
          </div>
        </div>

        {/* Top 4 Personal Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="surface-card p-5 spotlight-card">
            <span className="font-mono-label">Active Tasks</span>
            <div className="font-serif-display text-3xl text-pearl mt-2 tabular-nums">
              {myTasks.length}
            </div>
            <div className="text-xs text-[#93A59B] mt-1 flex items-center gap-1.5">
              <ListTodo className="w-3.5 h-3.5 text-[#2DB6A8]" />
              <span>Assigned in sprint</span>
            </div>
          </div>

          <div className="surface-card p-5">
            <span className="font-mono-label">Hours This Week</span>
            <div className="font-serif-display text-3xl text-pearl mt-2 tabular-nums">
              {totalHoursThisWeek.toFixed(1)}
              <span className="text-sm font-sans text-[#93A59B] font-normal ml-1">/ 40h</span>
            </div>
            <div className="text-xs text-[#93A59B] mt-1 flex items-center gap-1.5 font-mono">
              <span className="text-[#34D399] font-medium">{billableHoursThisWeek.toFixed(1)}h billable</span>
              <span>&bull;</span>
              <span>{Math.round((totalHoursThisWeek / 40) * 100)}% capacity</span>
            </div>
          </div>

          <div className="surface-card p-5">
            <span className="font-mono-label">Annual Leave</span>
            <div className="font-serif-display text-3xl text-[#34D399] mt-2 tabular-nums">
              {annualBalance?.remainingDays ?? 0}
              <span className="text-sm font-sans text-[#93A59B] font-normal ml-1">days left</span>
            </div>
            <div className="text-xs text-[#93A59B] mt-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#34D399]" />
              <span>
                {annualBalance ? `${annualBalance.approvedDays} used of ${annualBalance.annualAllowance} allowance` : "Active calendar"}
              </span>
            </div>
          </div>

          <div className="surface-card p-5">
            <span className="font-mono-label">Active Objectives</span>
            <div className="font-serif-display text-3xl text-[#B5E35B] mt-2 tabular-nums">
              {myObjectives.length}
            </div>
            <div className="text-xs text-[#93A59B] mt-1 flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-[#B5E35B]" />
              <span>Personal &amp; team OKRs</span>
            </div>
          </div>
        </div>

        {/* Main Grid: Tasks + Syncs */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* My Assigned Tasks (2 columns) */}
          <div className="lg:col-span-2 surface-card p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#22302A]">
              <div>
                <h2 className="text-base font-semibold text-[#F4FAF7] flex items-center gap-2">
                  <FolderKanban className="w-4 h-4 text-[#2DB6A8]" />
                  <span>My Assigned Tasks</span>
                </h2>
                <p className="text-xs text-[#93A59B]">Tasks currently on your personal delivery board</p>
              </div>
              <Link href="/projects" className="text-xs font-mono text-[#34D399] hover:underline">
                View All Boards &rarr;
              </Link>
            </div>

            {myTasks.length === 0 ? (
              <div className="py-12 text-center text-[#93A59B] space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#34D399] mx-auto opacity-70" />
                <p className="text-sm">You are all caught up! No open tasks assigned.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {myTasks.map((task) => (
                  <div
                    key={task.id}
                    className="p-3.5 rounded-xl bg-[#16201B] border border-[#22302A] hover:border-[#2DB6A8]/40 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#1D2A24] text-[#2DB6A8] border border-[#2DB6A8]/30">
                          {task.project.name}
                        </span>
                        <span
                          className={`text-[10px] font-mono px-2 py-0.5 rounded uppercase ${
                            task.status === TaskStatus.IN_PROGRESS
                              ? "bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30"
                              : "bg-[#93A59B]/10 text-[#93A59B] border border-[#22302A]"
                          }`}
                        >
                          {task.status.replace("_", " ")}
                        </span>
                      </div>
                      <div className="text-xs font-medium text-[#E8F1EC] truncate">{task.title}</div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right font-mono text-xs text-[#93A59B]">
                        <span className="text-[#E8F1EC] font-semibold tabular-nums">{Number(task.estimateHours)}h</span> est.
                      </div>
                      <Link
                        href={`/projects/${task.projectId}`}
                        className="p-1.5 rounded-lg bg-[#0F1613] hover:bg-[#1D2A24] text-[#34D399] border border-[#2F4239] transition-colors"
                        title="Open task in board"
                      >
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: 1:1 Check-ins & Leave Status */}
          <div className="space-y-6">
            {/* 1:1 Meetings */}
            <div className="surface-card p-5 space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#22302A]">
                <h3 className="text-xs font-mono uppercase tracking-wider text-[#93A59B] flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-[#34D399]" />
                  <span>Upcoming 1:1 Syncs</span>
                </h3>
                <Link href="/performance" className="text-[11px] font-mono text-[#34D399] hover:underline">
                  Notes
                </Link>
              </div>

              {oneOnOnes.length === 0 ? (
                <p className="text-xs text-[#93A59B] py-3 text-center">No upcoming 1:1s scheduled</p>
              ) : (
                <div className="space-y-2">
                  {oneOnOnes.map((m) => {
                    const otherPerson = m.reportId === employeeId ? m.manager : m.report;
                    return (
                      <div key={m.id} className="p-3 rounded-lg bg-[#16201B] border border-[#22302A] text-xs">
                        <div className="flex items-center justify-between font-medium text-[#E8F1EC]">
                          <span>With {otherPerson.firstName} {otherPerson.lastName}</span>
                          <span className="font-mono text-[10px] text-[#34D399]">
                            {new Date(m.scheduledAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#93A59B] mt-0.5 truncate">
                          {m.agenda || "Regular cadence sync & growth check"}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Leave Balances Breakdown */}
            <div className="surface-card p-5 space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#22302A]">
                <h3 className="text-xs font-mono uppercase tracking-wider text-[#93A59B] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#34D399]" />
                  <span>Leave Balances</span>
                </h3>
                <Link href="/leave" className="text-[11px] font-mono text-[#34D399] hover:underline">
                  Calendar
                </Link>
              </div>

              <div className="space-y-2">
                {leaveBalances.map((bal) => (
                  <div key={bal.leaveTypeId} className="p-2.5 rounded-lg bg-[#16201B] border border-[#22302A]">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[#E8F1EC] font-medium">{bal.name}</span>
                      <span className="font-mono text-[11px] text-[#34D399] tabular-nums">
                        {bal.remainingDays} days left
                      </span>
                    </div>
                    <div className="w-full bg-[#080D0B] rounded-full h-1.5 overflow-hidden border border-[#22302A]">
                      <div
                        className="bg-[#34D399] h-full rounded-full"
                        style={{
                          width: `${Math.min(100, Math.round((bal.approvedDays / bal.annualAllowance) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}

                {pendingLeaves.length > 0 && (
                  <div className="mt-2 p-2 rounded-lg bg-[#F2B84B]/10 border border-[#F2B84B]/20 text-[11px] text-[#F2B84B] flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                    <span>{pendingLeaves.length} pending leave request(s) awaiting manager decision</span>
                  </div>
                )}
              </div>
            </div>

            {/* Recognition & Kudos Received */}
            <div className="surface-card p-5 space-y-3">
              <div className="flex items-center justify-between pb-2.5 border-b border-[#22302A]">
                <h3 className="text-xs font-mono uppercase tracking-wider text-[#93A59B] flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-[#B5E35B]" />
                  <span>Recent Kudos</span>
                </h3>
                <Link href="/performance" className="text-[11px] font-mono text-[#B5E35B] hover:underline">
                  Give Shoutout
                </Link>
              </div>

              {kudosList.length === 0 ? (
                <p className="text-xs text-[#93A59B] py-3 text-center">No kudos shared yet</p>
              ) : (
                <div className="space-y-2">
                  {kudosList.slice(0, 2).map((k) => (
                    <div key={k.id} className="p-2.5 rounded-lg bg-[#16201B] border border-[#22302A] text-xs">
                      <div className="flex items-center justify-between text-[10px] text-[#93A59B] mb-1">
                        <span className="font-medium text-[#E8F1EC]">
                          {k.sender.firstName} &rarr; <span className="text-[#34D399]">{k.receiver.firstName}</span>
                        </span>
                        <span className="font-mono">{new Date(k.createdAt).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[#E8F1EC] italic font-serif leading-relaxed text-[11px]">
                        &ldquo;{k.message}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // 2. EXECUTIVE & MANAGER DASHBOARD (OWNER, HR, MANAGER)
  // -------------------------------------------------------------
  const [data, openInvoicesCount, activeCyclesCount] = await Promise.all([
    getExecutiveDashboardMetrics(user.organizationId, user),
    rawPrisma.invoice.count({
      where: {
        organizationId: user.organizationId,
        status: { in: ["SENT", "OVERDUE"] },
      },
    }),
    rawPrisma.reviewCycle.count({
      where: {
        organizationId: user.organizationId,
        status: "ACTIVE",
      },
    }),
  ]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Page Title & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-3xl sm:text-4xl font-normal text-[#F4FAF7]">
            Studio <span className="italic text-[#34D399]">Health</span> &amp; Performance
          </h1>
          <p className="text-sm text-[#93A59B] mt-1 font-sans">
            Cross-module capacity allocation, project profitability, and team momentum.
          </p>
        </div>

        {/* Quick Action Launcher */}
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/timesheets"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#16201B] hover:bg-[#22302A] text-[#E8F1EC] border border-[#22302A] transition-colors"
          >
            <Clock className="w-3.5 h-3.5 text-[#2DB6A8]" />
            <span>Log Time</span>
          </Link>
          <Link
            href="/leave"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#16201B] hover:bg-[#22302A] text-[#E8F1EC] border border-[#22302A] transition-colors"
          >
            <Calendar className="w-3.5 h-3.5 text-[#34D399]" />
            <span>Request Leave</span>
          </Link>
          <Link
            href="/projects"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#16201B] hover:bg-[#22302A] text-[#E8F1EC] border border-[#22302A] transition-colors"
          >
            <FolderKanban className="w-3.5 h-3.5 text-[#2DB6A8]" />
            <span>Task Board</span>
          </Link>
          <Link
            href="/performance"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#16201B] hover:bg-[#22302A] text-[#E8F1EC] border border-[#22302A] transition-colors"
          >
            <Heart className="w-3.5 h-3.5 text-[#B5E35B]" />
            <span>Give Kudos</span>
          </Link>
          {(user.role === Role.OWNER || user.role === Role.HR) && (
            <Link
              href="/billing"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#34D399]/15 hover:bg-[#34D399]/25 text-[#34D399] border border-[#34D399]/30 transition-colors"
            >
              <Receipt className="w-3.5 h-3.5 text-[#34D399]" />
              <span>New Invoice</span>
            </Link>
          )}
        </div>
      </div>

      {/* Top 5 Hero KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Active People */}
        <div className="surface-card p-5 relative overflow-hidden group hover:border-[#34D399]/40 transition-colors">
          <div className="flex items-center justify-between text-[#93A59B] mb-2">
            <span className="font-mono-label">Active Studio</span>
            <Users className="w-4 h-4 text-[#34D399]" />
          </div>
          <div className="text-2xl font-serif-display font-medium text-[#F4FAF7] tabular-nums">
            {data.metrics.activeEmployees}{" "}
            <span className="text-sm font-sans text-[#93A59B] font-normal">members</span>
          </div>
          <p className="text-[11px] text-[#93A59B] mt-1">Across active departments</p>
        </div>

        {/* Card 2: Active Projects & Tasks */}
        <div className="surface-card p-5 relative overflow-hidden group hover:border-[#2DB6A8]/40 transition-colors">
          <div className="flex items-center justify-between text-[#93A59B] mb-2">
            <span className="font-mono-label">Work Delivery</span>
            <FolderKanban className="w-4 h-4 text-[#2DB6A8]" />
          </div>
          <div className="text-2xl font-serif-display font-medium text-[#F4FAF7] tabular-nums">
            {data.metrics.activeProjects}{" "}
            <span className="text-sm font-sans text-[#93A59B] font-normal">projects</span>
          </div>
          <p className="text-[11px] text-[#2DB6A8] mt-1 font-mono">
            {data.metrics.openTasksCount} active tasks in progress
          </p>
        </div>

        {/* Card 3: Tracked Hours */}
        <div className="surface-card p-5 relative overflow-hidden group hover:border-[#34D399]/40 transition-colors">
          <div className="flex items-center justify-between text-[#93A59B] mb-2">
            <span className="font-mono-label">Tracked Hours</span>
            <Clock className="w-4 h-4 text-[#34D399]" />
          </div>
          <div className="text-2xl font-serif-display font-medium text-[#F4FAF7] tabular-nums">
            {data.metrics.billableHours}{" "}
            <span className="text-sm font-sans text-[#93A59B] font-normal">/ {data.metrics.totalTrackedHours}h</span>
          </div>
          <p className="text-[11px] text-[#34D399] mt-1 font-mono">
            {data.metrics.totalTrackedHours > 0
              ? Math.round((data.metrics.billableHours / data.metrics.totalTrackedHours) * 100)
              : 0}
            % billability ratio
          </p>
        </div>

        {/* Card 4: Billed Revenue */}
        <div className="surface-card p-5 relative overflow-hidden group hover:border-[#34D399]/40 transition-colors">
          <div className="flex items-center justify-between text-[#93A59B] mb-2">
            <span className="font-mono-label">Billed Revenue</span>
            <Receipt className="w-4 h-4 text-[#34D399]" />
          </div>
          <div className="text-2xl font-serif-display font-medium text-[#34D399] tabular-nums">
            ${data.metrics.totalBilledRevenue.toLocaleString()}
          </div>
          <p className="text-[11px] text-[#93A59B] mt-1 font-mono">
            {openInvoicesCount > 0 ? `${openInvoicesCount} open invoice(s)` : "All invoices cleared"}
          </p>
        </div>

        {/* Card 5: Studio Utilization */}
        <div className="surface-card p-5 relative overflow-hidden group hover:border-[#B5E35B]/40 transition-colors">
          <div className="flex items-center justify-between text-[#93A59B] mb-2">
            <span className="font-mono-label">Utilization</span>
            <TrendingUp className="w-4 h-4 text-[#B5E35B]" />
          </div>
          <div className="text-2xl font-serif-display font-medium text-[#B5E35B] tabular-nums">
            {data.metrics.averageUtilizationPct}%
          </div>
          <p className="text-[11px] text-[#93A59B] mt-1">
            {activeCyclesCount > 0 ? `${activeCyclesCount} active review cycle` : "Assigned vs capacity"}
          </p>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <ExecutiveCharts
        monthlyHours={data.monthlyHoursTrend}
        departmentUtilization={data.departmentUtilization}
      />

      {/* Project Profitability & Financial Health Table */}
      <div className="surface-card p-6 shadow-lg">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
          <div>
            <h2 className="text-lg font-semibold text-[#F4FAF7] flex items-center gap-2">
              <span>Project Profitability &amp; Financials</span>
              {!canViewCompensation(user) && (
                <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-[#16201B] border border-[#22302A] text-[#93A59B]">
                  <Lock className="w-3 h-3 text-[#93A59B]" />
                  <span>Cost metrics restricted</span>
                </span>
              )}
            </h2>
            <p className="text-xs text-[#93A59B]">
              Real-time revenue, labor cost from historical effective wages, and gross profit margins.
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#22302A] text-[#93A59B] font-mono uppercase tracking-wider">
                <th className="pb-3 font-medium">Project</th>
                <th className="pb-3 font-medium">Client</th>
                <th className="pb-3 font-medium text-right">Tracked / Billable</th>
                <th className="pb-3 font-medium text-right">Billed Revenue</th>
                <th className="pb-3 font-medium text-right">Labor Cost</th>
                <th className="pb-3 font-medium text-right">Gross Margin</th>
                <th className="pb-3 font-medium text-right">Margin %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#16201B]">
              {data.projectsProfitability.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[#93A59B]">
                    No active projects found.
                  </td>
                </tr>
              ) : (
                data.projectsProfitability.map((project) => (
                  <tr key={project.projectId} className="hover:bg-[#16201B]/50 transition-colors">
                    <td className="py-3 font-medium text-[#F4FAF7]">
                      <Link href={`/projects/${project.projectId}`} className="hover:text-[#2DB6A8]">
                        {project.projectName}
                      </Link>
                    </td>
                    <td className="py-3 text-[#93A59B] font-mono">{project.clientName}</td>
                    <td className="py-3 text-right font-mono text-[#E8F1EC] tabular-nums">
                      {project.totalBillableHours}h{" "}
                      <span className="text-[#93A59B]">/ {project.totalTrackedHours}h</span>
                    </td>
                    <td className="py-3 text-right font-mono text-[#34D399] font-medium tabular-nums">
                      ${project.totalBilledRevenue.toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-mono text-[#E8F1EC] tabular-nums">
                      {project.canViewFinancials ? (
                        `$${project.totalLaborCost?.toLocaleString()}`
                      ) : (
                        <span className="text-[#93A59B] italic">Restricted</span>
                      )}
                    </td>
                    <td className="py-3 text-right font-mono font-medium tabular-nums">
                      {project.canViewFinancials ? (
                        <span
                          className={
                            (project.grossMarginAmount ?? 0) >= 0
                              ? "text-[#4ADE80]"
                              : "text-[#F0646E]"
                          }
                        >
                          ${project.grossMarginAmount?.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-[#93A59B] italic">Restricted</span>
                      )}
                    </td>
                    <td className="py-3 text-right font-mono tabular-nums">
                      {project.canViewFinancials ? (
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                            (project.grossMarginPct ?? 0) >= 50
                              ? "bg-[#34D399]/15 text-[#34D399] border border-[#34D399]/30"
                              : (project.grossMarginPct ?? 0) >= 20
                              ? "bg-[#F2B84B]/15 text-[#F2B84B] border border-[#F2B84B]/30"
                              : "bg-[#F0646E]/15 text-[#F0646E] border border-[#F0646E]/30"
                          }`}
                        >
                          {project.grossMarginPct}%
                        </span>
                      ) : (
                        <span className="text-[#93A59B] italic">Restricted</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid of Workload Allocation & Social Kudos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Team Workload Allocation (2 columns) */}
        <div className="lg:col-span-2 surface-card p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-[#F4FAF7]">
                Team Workload &amp; Capacity
              </h2>
              <p className="text-xs text-[#93A59B]">
                Net capacity minus approved leaves vs assigned task estimates
              </p>
            </div>
            <Link
              href="/leave"
              className="text-xs text-[#34D399] hover:underline font-mono"
            >
              View Calendar &rarr;
            </Link>
          </div>

          <div className="space-y-3">
            {data.teamWorkload.slice(0, 6).map((member) => (
              <div
                key={member.employeeId}
                className="p-3.5 rounded-xl bg-[#16201B] border border-[#22302A] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#34D399]/15 text-[#34D399] flex items-center justify-center font-bold text-xs border border-[#34D399]/30">
                    {member.employeeName.charAt(0)}
                  </div>
                  <div>
                    <div className="text-xs font-semibold text-[#F4FAF7] flex items-center gap-2">
                      <span>{member.employeeName}</span>
                      {member.isOverallocated && (
                        <span className="flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.2 rounded bg-[#F0646E]/15 text-[#F0646E] border border-[#F0646E]/30">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          <span>Overallocated</span>
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-[#93A59B]">
                      {member.jobTitle} &bull; {member.departmentName || "General"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs font-mono">
                  <div className="text-right">
                    <div className="text-[#E8F1EC] tabular-nums">
                      {member.allocatedTaskHours}h{" "}
                      <span className="text-[#93A59B]">/ {member.netAvailableHours}h</span>
                    </div>
                    <div className="text-[10px] text-[#93A59B]">
                      {member.approvedLeaveHours > 0 && (
                        <span className="text-[#F2B84B]">
                          {member.approvedLeaveHours}h leave &bull;{" "}
                        </span>
                      )}
                      <span className="tabular-nums">{member.utilizationRatePct}% load</span>
                    </div>
                  </div>

                  <div className="w-20 bg-[#080D0B] rounded-full h-2 overflow-hidden border border-[#22302A]">
                    <div
                      className={`h-full rounded-full transition-all ${
                        member.utilizationRatePct > 100
                          ? "bg-[#F0646E]"
                          : member.utilizationRatePct > 75
                          ? "bg-[#34D399]"
                          : "bg-[#2DB6A8]"
                      }`}
                      style={{
                        width: `${Math.min(100, member.utilizationRatePct)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Live Kudos Momentum Feed (1 column) */}
        <div className="surface-card p-6 shadow-lg flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-[#F4FAF7] flex items-center gap-2">
                <Heart className="w-4 h-4 text-[#B5E35B]" />
                <span>Kudos Feed</span>
              </h2>
              <Link
                href="/performance"
                className="text-xs text-[#B5E35B] hover:underline font-mono"
              >
                Send &rarr;
              </Link>
            </div>

            <div className="space-y-3">
              {data.recentKudos.length === 0 ? (
                <p className="text-xs text-[#93A59B] py-6 text-center">
                  No kudos shared yet. Give someone a shoutout!
                </p>
              ) : (
                data.recentKudos.map((kudos) => (
                  <div
                    key={kudos.id}
                    className="p-3 rounded-xl bg-[#16201B] border border-[#22302A] text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px] text-[#93A59B]">
                      <span className="font-semibold text-[#E8F1EC]">
                        {kudos.giverName}{" "}
                        <span className="font-normal text-[#93A59B]">&rarr;</span>{" "}
                        <span className="text-[#34D399]">{kudos.recipientName}</span>
                      </span>
                      <span className="font-mono text-[10px]">
                        {new Date(kudos.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <p className="text-[#E8F1EC] italic font-serif leading-relaxed">
                      &ldquo;{kudos.message}&rdquo;
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-[#22302A]">
            <Link
              href="/performance"
              className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium bg-[#B5E35B]/15 text-[#B5E35B] hover:bg-[#B5E35B]/25 transition-colors border border-[#B5E35B]/30"
            >
              <Heart className="w-3.5 h-3.5" />
              <span>Give Kudos to a Colleague</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
