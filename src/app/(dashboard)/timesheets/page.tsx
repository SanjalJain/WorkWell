import Link from "next/link";
import { getSessionUser } from "@/lib/auth";
import { getWeeklyTimesheet, listRecentTimeEntries, listProjects } from "@/modules/work/service";
import { LogTimeModal, DeleteTimeEntryButton } from "./TimesheetClientComponents";
import { Clock, ChevronLeft, ChevronRight, Calendar, DollarSign, Lock } from "lucide-react";
import { Role } from "@prisma/client";
import { redirect } from "next/navigation";

interface TimesheetPageProps {
  searchParams: Promise<{ week?: string }>;
}

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getUTCDay();
  const diff = date.getUTCDate() - day + (day === 0 ? -6 : 1);
  date.setUTCDate(diff);
  return date.toISOString().split("T")[0];
}

export default async function TimesheetPage({ searchParams }: TimesheetPageProps) {
  const user = await getSessionUser();
  if (!user) redirect("/");

  if (user.role === Role.CLIENT) {
    redirect("/portal");
  }

  const { week } = await searchParams;
  const currentMonday = week || getMonday(new Date());

  // Calculate previous and next Monday for pagination
  const mondayDate = new Date(currentMonday);
  const prevMondayDate = new Date(mondayDate);
  prevMondayDate.setUTCDate(prevMondayDate.getUTCDate() - 7);
  const prevMonday = prevMondayDate.toISOString().split("T")[0];

  const nextMondayDate = new Date(mondayDate);
  nextMondayDate.setUTCDate(nextMondayDate.getUTCDate() + 7);
  const nextMonday = nextMondayDate.toISOString().split("T")[0];

  const [timesheet, recentEntries, projects] = await Promise.all([
    user.employeeId
      ? getWeeklyTimesheet(user.employeeId, currentMonday, user)
      : null,
    listRecentTimeEntries(user),
    listProjects(user),
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-4xl text-[#F4FAF7]">
            Tracked <span className="italic text-[#2DB6A8]">hours</span>
          </h1>
          <p className="text-sm text-[#93A59B] mt-1">
            Weekly timesheet matrix, project-allocated hours, and billable time ledger.
          </p>
        </div>

        {user.employeeId && (
          <LogTimeModal
            projects={projects.map((p) => ({
              id: p.id,
              name: p.name,
              clientName: p.clientName,
            }))}
          />
        )}
      </div>

      {/* Week Selector Bar & Summary Strip */}
      <div className="surface-card p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={`/timesheets?week=${prevMonday}`}
            className="w-8 h-8 rounded-lg bg-[#16201B] hover:bg-[#1D2A24] text-[#93A59B] hover:text-[#E8F1EC] border border-[#2F4239] flex items-center justify-center transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>

          <div className="font-mono text-xs">
            <span className="text-[#5F6F66]">Week: </span>
            <span className="text-[#E8F1EC] font-medium">
              {timesheet?.weekStartDate} → {timesheet?.weekEndDate}
            </span>
          </div>

          <Link
            href={`/timesheets?week=${nextMonday}`}
            className="w-8 h-8 rounded-lg bg-[#16201B] hover:bg-[#1D2A24] text-[#93A59B] hover:text-[#E8F1EC] border border-[#2F4239] flex items-center justify-center transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {timesheet && (
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <span className="text-[#5F6F66]">Total Logged:</span>
              <span className="text-[#E8F1EC] font-semibold">{timesheet.totalWeekHours}h</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[#5F6F66]">Billable:</span>
              <span className="text-[#2DB6A8] font-semibold">{timesheet.totalBillableHours}h</span>
            </div>
          </div>
        )}
      </div>

      {/* Weekly Timesheet Grid */}
      {timesheet && (
        <div className="surface-card overflow-hidden">
          <div className="p-4 border-b border-[#22302A] flex items-center justify-between">
            <span className="font-mono-label text-[#2DB6A8]">Weekly Timesheet Matrix</span>
            <span className="text-xs font-mono text-[#5F6F66]">
              {user.name} ({timesheet.rows.length} Projects)
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#16201B]/70 border-b border-[#22302A]">
                <tr>
                  <th className="px-5 py-3 font-mono-label min-w-[200px]">Project / Client</th>
                  {timesheet.days.map((d) => (
                    <th key={d.date} className="px-4 py-3 font-mono-label text-center">
                      <div>{d.dayName}</div>
                      <div className="text-[9px] text-[#5F6F66]">{d.date.slice(5)}</div>
                    </th>
                  ))}
                  <th className="px-5 py-3 font-mono-label text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#22302A]">
                {timesheet.rows.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-5 py-8 text-center text-[#5F6F66]">
                      No hours logged for this week. Click &ldquo;Log Time&rdquo; to add hours.
                    </td>
                  </tr>
                ) : (
                  timesheet.rows.map((row) => (
                    <tr key={row.projectId} className="hover:bg-[#16201B]/40 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="font-medium text-[#E8F1EC]">{row.projectName}</div>
                        <div className="text-[10px] text-[#93A59B]">{row.clientName}</div>
                      </td>

                      {timesheet.days.map((d) => {
                        const hours = row.dailyHours[d.date] || 0;
                        return (
                          <td key={d.date} className="px-4 py-3.5 text-center font-mono">
                            {hours > 0 ? (
                              <span className="px-2 py-0.5 rounded bg-[#2DB6A8]/15 text-[#2DB6A8] font-semibold border border-[#2DB6A8]/30">
                                {hours}h
                              </span>
                            ) : (
                              <span className="text-[#5F6F66]">—</span>
                            )}
                          </td>
                        );
                      })}

                      <td className="px-5 py-3.5 text-right font-mono font-bold text-[#E8F1EC]">
                        {row.totalProjectHours}h
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot className="bg-[#16201B]/80 border-t border-[#22302A] font-mono">
                <tr>
                  <td className="px-5 py-3 font-semibold text-[#E8F1EC]">Daily Totals</td>
                  {timesheet.days.map((d) => (
                    <td key={d.date} className="px-4 py-3 text-center text-xs">
                      <div className="font-bold text-[#E8F1EC]">{d.totalHours}h</div>
                      <div className="text-[9px] text-[#2DB6A8]">{d.billableHours}h bill</div>
                    </td>
                  ))}
                  <td className="px-5 py-3 text-right font-bold text-sm text-[#2DB6A8]">
                    {timesheet.totalWeekHours}h
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Recent Time Entries Table */}
      <div className="surface-card overflow-hidden">
        <div className="p-4 border-b border-[#22302A] flex items-center justify-between">
          <span className="font-mono-label">Recent Time Entries Ledger</span>
          <span className="text-xs font-mono text-[#5F6F66]">
            Showing latest {recentEntries.length} entries
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#16201B]/60 border-b border-[#22302A]">
              <tr>
                <th className="px-5 py-3 font-mono-label">Date</th>
                <th className="px-5 py-3 font-mono-label">Employee</th>
                <th className="px-5 py-3 font-mono-label">Project</th>
                <th className="px-5 py-3 font-mono-label">Hours</th>
                <th className="px-5 py-3 font-mono-label">Billable</th>
                <th className="px-5 py-3 font-mono-label">Description</th>
                <th className="px-5 py-3 text-right font-mono-label">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#22302A]">
              {recentEntries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-[#5F6F66]">
                    No recent time entries recorded.
                  </td>
                </tr>
              ) : (
                recentEntries.map((entry) => (
                  <tr key={entry.id} className="hover:bg-[#16201B]/40 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-[#E8F1EC]">{entry.date}</td>
                    <td className="px-5 py-3.5 font-medium text-[#E8F1EC]">{entry.employeeName}</td>
                    <td className="px-5 py-3.5 text-[#93A59B]">{entry.projectName}</td>
                    <td className="px-5 py-3.5 font-mono text-[#2DB6A8] font-semibold">
                      {entry.hours}h
                    </td>
                    <td className="px-5 py-3.5">
                      {entry.billable ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#2DB6A8]/15 text-[#2DB6A8] border border-[#2DB6A8]/30">
                          Billable
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1D2A24] text-[#5F6F66] border border-[#2F4239]">
                          Non-billable
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-[#93A59B] max-w-xs truncate">
                      {entry.description || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <DeleteTimeEntryButton entryId={entry.id} isLocked={entry.isLocked} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
