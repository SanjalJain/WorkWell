import { getSessionUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Role } from "@prisma/client";
import { getExecutiveDashboardMetrics } from "@/modules/shared/service";
import { canViewCompensation } from "@/modules/people/policies";
import { ExecutiveCharts } from "@/components/dashboard/ExecutiveCharts";
import Link from "next/link";
import {
  Users,
  FolderKanban,
  Clock,
  TrendingUp,
  Receipt,
  Heart,
  PlusCircle,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Lock,
} from "lucide-react";

export default async function ExecutiveDashboardPage() {
  const user = await getSessionUser();

  if (!user) {
    redirect("/directory");
  }

  if (user.role === Role.CLIENT) {
    redirect("/portal");
  }

  const data = await getExecutiveDashboardMetrics(user.organizationId, user);

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
        <div className="p-5 rounded-2xl bg-[#0F1613] border border-[#22302A] relative overflow-hidden group hover:border-[#34D399]/40 transition-colors">
          <div className="flex items-center justify-between text-[#93A59B] mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Active Studio</span>
            <Users className="w-4 h-4 text-[#34D399]" />
          </div>
          <div className="text-2xl font-serif-display font-medium text-[#F4FAF7]">
            {data.metrics.activeEmployees}{" "}
            <span className="text-sm font-sans text-[#93A59B]">members</span>
          </div>
          <p className="text-[11px] text-[#93A59B] mt-1">Across active departments</p>
        </div>

        {/* Card 2: Active Projects & Tasks */}
        <div className="p-5 rounded-2xl bg-[#0F1613] border border-[#22302A] relative overflow-hidden group hover:border-[#2DB6A8]/40 transition-colors">
          <div className="flex items-center justify-between text-[#93A59B] mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Work Delivery</span>
            <FolderKanban className="w-4 h-4 text-[#2DB6A8]" />
          </div>
          <div className="text-2xl font-serif-display font-medium text-[#F4FAF7]">
            {data.metrics.activeProjects}{" "}
            <span className="text-sm font-sans text-[#93A59B]">projects</span>
          </div>
          <p className="text-[11px] text-[#2DB6A8] mt-1 font-mono">
            {data.metrics.openTasksCount} active tasks in progress
          </p>
        </div>

        {/* Card 3: Tracked Hours */}
        <div className="p-5 rounded-2xl bg-[#0F1613] border border-[#22302A] relative overflow-hidden group hover:border-[#34D399]/40 transition-colors">
          <div className="flex items-center justify-between text-[#93A59B] mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Tracked Hours</span>
            <Clock className="w-4 h-4 text-[#34D399]" />
          </div>
          <div className="text-2xl font-serif-display font-medium text-[#F4FAF7]">
            {data.metrics.billableHours}{" "}
            <span className="text-sm font-sans text-[#93A59B]">/ {data.metrics.totalTrackedHours}h</span>
          </div>
          <p className="text-[11px] text-[#34D399] mt-1">
            {data.metrics.totalTrackedHours > 0
              ? Math.round((data.metrics.billableHours / data.metrics.totalTrackedHours) * 100)
              : 0}
            % billability ratio
          </p>
        </div>

        {/* Card 4: Billed Revenue */}
        <div className="p-5 rounded-2xl bg-[#0F1613] border border-[#22302A] relative overflow-hidden group hover:border-[#34D399]/40 transition-colors">
          <div className="flex items-center justify-between text-[#93A59B] mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Billed Revenue</span>
            <Receipt className="w-4 h-4 text-[#34D399]" />
          </div>
          <div className="text-2xl font-serif-display font-medium text-[#34D399]">
            ${data.metrics.totalBilledRevenue.toLocaleString()}
          </div>
          <p className="text-[11px] text-[#93A59B] mt-1 font-mono">From sent &amp; paid invoices</p>
        </div>

        {/* Card 5: Studio Utilization */}
        <div className="p-5 rounded-2xl bg-[#0F1613] border border-[#22302A] relative overflow-hidden group hover:border-[#B5E35B]/40 transition-colors">
          <div className="flex items-center justify-between text-[#93A59B] mb-2">
            <span className="text-xs font-mono uppercase tracking-wider">Utilization</span>
            <TrendingUp className="w-4 h-4 text-[#B5E35B]" />
          </div>
          <div className="text-2xl font-serif-display font-medium text-[#B5E35B]">
            {data.metrics.averageUtilizationPct}%
          </div>
          <p className="text-[11px] text-[#93A59B] mt-1">Assigned tasks vs net capacity</p>
        </div>
      </div>

      {/* Visual Analytics Charts */}
      <ExecutiveCharts
        monthlyHours={data.monthlyHoursTrend}
        departmentUtilization={data.departmentUtilization}
      />

      {/* Project Profitability & Financial Health Table */}
      <div className="p-6 rounded-2xl bg-[#0F1613] border border-[#22302A] shadow-lg">
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
                    <td className="py-3 text-right font-mono text-[#E8F1EC]">
                      {project.totalBillableHours}h{" "}
                      <span className="text-[#93A59B]">/ {project.totalTrackedHours}h</span>
                    </td>
                    <td className="py-3 text-right font-mono text-[#34D399] font-medium">
                      ${project.totalBilledRevenue.toLocaleString()}
                    </td>
                    <td className="py-3 text-right font-mono text-[#E8F1EC]">
                      {project.canViewFinancials ? (
                        `$${project.totalLaborCost?.toLocaleString()}`
                      ) : (
                        <span className="text-[#93A59B] italic">Restricted</span>
                      )}
                    </td>
                    <td className="py-3 text-right font-mono font-medium">
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
                    <td className="py-3 text-right font-mono">
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
        {/* Team Workload Allocation Heat-Strip (2 columns) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-[#0F1613] border border-[#22302A] shadow-lg">
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
                    <div className="text-[#E8F1EC]">
                      {member.allocatedTaskHours}h{" "}
                      <span className="text-[#93A59B]">/ {member.netAvailableHours}h</span>
                    </div>
                    <div className="text-[10px] text-[#93A59B]">
                      {member.approvedLeaveHours > 0 && (
                        <span className="text-[#F2B84B]">
                          {member.approvedLeaveHours}h leave &bull;{" "}
                        </span>
                      )}
                      <span>{member.utilizationRatePct}% load</span>
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
        <div className="p-6 rounded-2xl bg-[#0F1613] border border-[#22302A] shadow-lg flex flex-col justify-between">
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
