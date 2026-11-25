import { getSessionUser } from "@/lib/auth";
import { getClientPortalOverview } from "@/modules/work/billing-service";
import {
  Building2,
  ShieldCheck,
  FolderKanban,
  Receipt,
  Download,
  Clock,
  CheckCircle2,
  Lock,
} from "lucide-react";
import { InvoiceStatus, Role } from "@prisma/client";
import { PortalInvoiceDownloadButton } from "@/app/(dashboard)/billing/BillingClientComponents";

export default async function ClientPortalPage() {
  const user = await getSessionUser();
  if (!user) {
    return (
      <div className="surface-card p-8 text-center text-[#93A59B] max-w-md mx-auto my-12">
        Please select a persona to view the Client Portal.
      </div>
    );
  }

  const portal = await getClientPortalOverview(user);

  return (
    <div className="space-y-8 max-w-5xl mx-auto py-4">
      {/* Portal Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-[#22302A] pb-6">
        <div>
          <span className="font-mono-label text-[#2DB6A8]">Secure Client Portal</span>
          <h1 className="font-serif-display text-4xl text-[#F4FAF7] mt-1">
            Client <span className="italic text-[#2DB6A8]">workspace</span>
          </h1>
          <p className="text-sm text-[#93A59B] mt-1">
            Real-time project milestone delivery, billable time verification, and official statements.
          </p>
        </div>

        <div className="p-3.5 rounded-xl bg-[#16201B] border border-[#2F4239] flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#2DB6A8]/20 border border-[#2DB6A8]/40 flex items-center justify-center text-[#2DB6A8]">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#E8F1EC]">{portal.clientName}</div>
            <div className="text-[10px] font-mono text-[#93A59B]">Verified Client Organization</div>
          </div>
        </div>
      </div>

      {/* IDOR & Field Protection Banner */}
      <div className="surface-card p-4 flex items-start gap-3 border-l-4 border-l-[#2DB6A8]">
        <ShieldCheck className="w-5 h-5 text-[#2DB6A8] flex-shrink-0 mt-0.5" />
        <div className="text-xs text-[#93A59B]">
          <strong className="text-[#E8F1EC]">Cryptographically Isolated Client Boundary: </strong>
          Your view is strictly restricted to projects and invoices commissioned by{" "}
          <strong className="text-[#2DB6A8]">{portal.clientName}</strong>. Internal employee compensation,
          contractor pay rates, and unassigned staff are completely hidden by database-level security policies.
        </div>
      </div>

      {/* Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="surface-card p-5 spotlight-card">
          <span className="font-mono-label text-[#F2B84B]">Outstanding Balance</span>
          <div className="font-serif-display text-3xl text-[#F2B84B] mt-2">
            ${portal.totalOutstanding}
          </div>
          <div className="text-xs text-[#93A59B] mt-1 flex items-center gap-1.5 font-mono">
            <Clock className="w-3.5 h-3.5 text-[#F2B84B]" />
            <span>Open statements awaiting payment</span>
          </div>
        </div>

        <div className="surface-card p-5">
          <span className="font-mono-label text-[#4ADE80]">Settled In Full</span>
          <div className="font-serif-display text-3xl text-[#4ADE80] mt-2">
            ${portal.totalPaid}
          </div>
          <div className="text-xs text-[#93A59B] mt-1 flex items-center gap-1.5 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#4ADE80]" />
            <span>Lifetime billed and settled</span>
          </div>
        </div>
      </div>

      {/* Commissioned Projects Section */}
      <div className="surface-card p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-[#22302A] pb-3">
          <div className="flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-[#2DB6A8]" />
            <h3 className="text-sm font-semibold text-[#F4FAF7]">
              Commissioned Projects ({portal.projects.length})
            </h3>
          </div>
          <span className="text-xs font-mono text-[#5F6F66]">Delivery milestones & task progress</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {portal.projects.length === 0 ? (
            <div className="col-span-full p-6 text-center text-xs text-[#5F6F66]">
              No active projects commissioned yet.
            </div>
          ) : (
            portal.projects.map((p) => (
              <div key={p.id} className="p-4 rounded-xl bg-[#16201B] border border-[#2F4239] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[#E8F1EC]">{p.name}</h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-[#1D2A24] text-[#2DB6A8] border border-[#2DB6A8]/30">
                    {p.status}
                  </span>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#93A59B]">Milestone Progress:</span>
                    <span className="text-[#34D399] font-bold">{p.progressPct}%</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#0F1613] border border-[#22302A] overflow-hidden">
                    <div
                      className="h-full bg-[#2DB6A8] transition-all"
                      style={{ width: `${p.progressPct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-[#5F6F66] font-mono flex items-center justify-between">
                    <span>Lead: {p.leadName || "Executive Team"}</span>
                    <span>
                      {p.completedTasks} / {p.totalTasks} Tasks Done
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Invoices & Statements Table */}
      <div className="surface-card overflow-hidden">
        <div className="p-4 border-b border-[#22302A] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#34D399]" />
            <span className="font-mono-label">Billing Statements & Invoices</span>
          </div>
          <span className="text-xs font-mono text-[#5F6F66]">
            Showing {portal.invoices.length} statements
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#16201B]/60 border-b border-[#22302A]">
              <tr>
                <th className="px-5 py-3 font-mono-label">Invoice Number</th>
                <th className="px-5 py-3 font-mono-label">Issue Date</th>
                <th className="px-5 py-3 font-mono-label">Due Date</th>
                <th className="px-5 py-3 font-mono-label">Amount ($ USD)</th>
                <th className="px-5 py-3 font-mono-label">Status</th>
                <th className="px-5 py-3 text-right font-mono-label">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#22302A]">
              {portal.invoices.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-5 py-8 text-center text-[#5F6F66]">
                    No statements on file. Any approved project billings will appear here automatically.
                  </td>
                </tr>
              ) : (
                portal.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#16201B]/40 transition-colors">
                    <td className="px-5 py-3.5 font-mono font-semibold text-[#E8F1EC]">
                      {inv.invoiceNumber}
                    </td>

                    <td className="px-5 py-3.5 font-mono text-[#93A59B]">{inv.issueDate}</td>

                    <td className="px-5 py-3.5 font-mono text-[#93A59B]">{inv.dueDate}</td>

                    <td className="px-5 py-3.5 font-mono font-bold text-[#E8F1EC]">
                      ${inv.total}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                          inv.status === InvoiceStatus.PAID
                            ? "bg-[#4ADE80]/15 text-[#4ADE80] border border-[#4ADE80]/30"
                            : inv.status === InvoiceStatus.OVERDUE
                            ? "bg-[#F0646E]/15 text-[#F0646E] border border-[#F0646E]/30"
                            : "bg-[#2DB6A8]/15 text-[#2DB6A8] border border-[#2DB6A8]/30"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right font-mono">
                      <PortalInvoiceDownloadButton invoiceId={inv.id} />
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
