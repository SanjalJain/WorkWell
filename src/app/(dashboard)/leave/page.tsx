import { getSessionUser } from "@/lib/auth";
import { getLeaveBalances, listLeaveRequests } from "@/modules/people/leave-service";
import { RequestLeaveModal, LeaveDecisionButtons, CancelLeaveButton } from "./LeaveClientComponents";
import { Calendar, Clock, CheckCircle2, AlertCircle, Ban } from "lucide-react";
import { LeaveStatus, Role } from "@prisma/client";
import { redirect } from "next/navigation";

export default async function LeavePage() {
  const user = await getSessionUser();
  if (!user) redirect("/");

  if (user.role === Role.CLIENT) {
    redirect("/portal");
  }

  const [balances, requests] = await Promise.all([
    user.employeeId ? getLeaveBalances(user.employeeId, user.organizationId) : [],
    listLeaveRequests(user),
  ]);

  const pendingApprovals = requests.filter((r) => r.canApprove);
  const myRequests = requests.filter((r) => r.employeeId === user.employeeId);

  return (
    <div className="space-y-8">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-4xl text-[#F4FAF7]">
            Leave & <span className="italic text-[#34D399]">time-off</span>
          </h1>
          <p className="text-sm text-[#93A59B] mt-1">
            Dynamic balance allowances, holiday-adjusted working days, and approval state machines.
          </p>
        </div>

        {user.employeeId && <RequestLeaveModal balances={balances} />}
      </div>

      {/* Dynamic Balances Cards */}
      {balances.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {balances.map((b) => (
            <div key={b.leaveTypeId} className="surface-card p-5 spotlight-card space-y-2">
              <span className="font-mono-label">{b.name}</span>
              <div className="flex items-baseline gap-2">
                <span className="font-serif-display text-3xl text-pearl">{b.remainingDays}</span>
                <span className="text-xs text-[#5F6F66] font-mono">/ {b.annualAllowance} days</span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-[#93A59B] pt-2 border-t border-[#22302A]">
                <span>Approved: {b.approvedDays}d</span>
                {b.pendingDays > 0 && (
                  <span className="text-[#F2B84B]">Pending: {b.pendingDays}d</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Required: Pending Approvals Queue */}
      {pendingApprovals.length > 0 && (
        <div className="surface-card p-6 border-l-4 border-l-[#F2B84B] space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-[#F2B84B]" />
              <h2 className="text-sm font-semibold text-[#F4FAF7]">
                Action Required: Pending Team Requests ({pendingApprovals.length})
              </h2>
            </div>
            <span className="text-xs font-mono text-[#93A59B]">Direct reports & department queue</span>
          </div>

          <div className="divide-y divide-[#22302A]">
            {pendingApprovals.map((req) => (
              <div
                key={req.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-[#E8F1EC]">{req.employeeName}</span>
                    <span className="text-xs text-[#93A59B]">({req.employeeJobTitle})</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1D2A24] text-[#34D399] border border-[#2F4239]">
                      {req.leaveTypeName}
                    </span>
                  </div>
                  <div className="text-xs text-[#93A59B] mt-1 flex items-center gap-2">
                    <span>
                      {req.startDate} to {req.endDate}
                    </span>
                    <span className="font-mono text-[#34D399]">({req.daysCount} working days)</span>
                    {req.reason && <span className="text-[#5F6F66]">“{req.reason}”</span>}
                  </div>
                </div>

                <LeaveDecisionButtons requestId={req.id} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leave Requests Table */}
      <div className="surface-card overflow-hidden space-y-4">
        <div className="p-5 pb-0 flex items-center justify-between">
          <h3 className="font-mono-label">
            {user.role === Role.OWNER || user.role === Role.HR
              ? "All Organization Requests"
              : "My Time-Off Requests"}
          </h3>
          <span className="text-xs font-mono text-[#5F6F66]">Showing latest {requests.length} records</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#16201B]/60 border-b border-[#22302A]">
              <tr>
                <th className="px-5 py-3 font-mono-label">Employee</th>
                <th className="px-5 py-3 font-mono-label">Type</th>
                <th className="px-5 py-3 font-mono-label">Dates</th>
                <th className="px-5 py-3 font-mono-label">Duration</th>
                <th className="px-5 py-3 font-mono-label">Reason</th>
                <th className="px-5 py-3 font-mono-label">Status</th>
                <th className="px-5 py-3 text-right font-mono-label">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#22302A]">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-5 py-8 text-center text-[#5F6F66]">
                    No leave requests on record.
                  </td>
                </tr>
              ) : (
                requests.map((req) => (
                  <tr key={req.id} className="hover:bg-[#16201B]/40 transition-colors">
                    <td className="px-5 py-3.5 font-medium text-[#E8F1EC]">{req.employeeName}</td>
                    <td className="px-5 py-3.5 text-[#93A59B]">{req.leaveTypeName}</td>
                    <td className="px-5 py-3.5 text-[#E8F1EC] font-mono">
                      {req.startDate} → {req.endDate}
                    </td>
                    <td className="px-5 py-3.5 font-mono text-[#34D399]">
                      {req.daysCount} {req.daysCount === 1 ? "day" : "days"}
                    </td>
                    <td className="px-5 py-3.5 text-[#93A59B] max-w-xs truncate">
                      {req.reason || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                          req.status === LeaveStatus.APPROVED
                            ? "bg-[#4ADE80]/10 text-[#4ADE80] border border-[#4ADE80]/20"
                            : req.status === LeaveStatus.PENDING
                            ? "bg-[#F2B84B]/10 text-[#F2B84B] border border-[#F2B84B]/20"
                            : req.status === LeaveStatus.REJECTED
                            ? "bg-[#F0646E]/10 text-[#F0646E] border border-[#F0646E]/20"
                            : "bg-[#5F6F66]/10 text-[#93A59B] border border-[#5F6F66]/20"
                        }`}
                      >
                        {req.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      {req.employeeId === user.employeeId && req.status === LeaveStatus.PENDING ? (
                        <CancelLeaveButton requestId={req.id} />
                      ) : (
                        <span className="text-[#5F6F66]">—</span>
                      )}
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
