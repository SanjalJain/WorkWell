import { getSessionUser } from "@/lib/auth";
import { listInvoices } from "@/modules/work/billing-service";
import { rawPrisma } from "@/lib/db";
import {
  GenerateInvoiceModal,
  InvoiceActionsDropdown,
  InvoiceLineItemsModal,
} from "./BillingClientComponents";
import { Receipt, DollarSign, Clock, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";
import { Role, InvoiceStatus } from "@prisma/client";
import { redirect } from "next/navigation";

export default async function BillingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/");

  if (user.role === Role.CLIENT) {
    redirect("/portal");
  }

  const [invoices, projects] = await Promise.all([
    listInvoices(user),
    rawPrisma.project.findMany({
      where: { organizationId: user.organizationId },
      include: { client: { select: { name: true } } },
      orderBy: { name: "asc" },
    }),
  ]);

  const totalInvoiced = invoices.reduce((sum, i) => sum + Number(i.total), 0);
  const totalOutstanding = invoices
    .filter((i) => i.status === InvoiceStatus.SENT || i.status === InvoiceStatus.OVERDUE)
    .reduce((sum, i) => sum + Number(i.total), 0);
  const totalPaid = invoices
    .filter((i) => i.status === InvoiceStatus.PAID)
    .reduce((sum, i) => sum + Number(i.total), 0);

  const canManage = user.role === Role.OWNER || user.role === Role.HR;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-serif-display text-4xl text-[#F4FAF7]">
            Billing & <span className="italic text-[#34D399]">invoices</span>
          </h1>
          <p className="text-sm text-[#93A59B] mt-1">
            Turn tracked billable time into official client statements with sequential numbering and double-billing protection.
          </p>
        </div>

        {canManage && (
          <GenerateInvoiceModal
            projects={projects.map((p) => ({
              id: p.id,
              name: p.name,
              clientName: p.client.name,
            }))}
          />
        )}
      </div>

      {/* Financial Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="surface-card p-5 spotlight-card">
          <span className="font-mono-label">Total Invoiced</span>
          <div className="font-serif-display text-3xl text-pearl mt-2">
            ${totalInvoiced.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-[#93A59B] mt-1 flex items-center gap-1.5 font-mono">
            <Receipt className="w-3.5 h-3.5 text-[#34D399]" />
            <span>{invoices.length} Statements issued</span>
          </div>
        </div>

        <div className="surface-card p-5">
          <span className="font-mono-label text-[#F2B84B]">Outstanding Due</span>
          <div className="font-serif-display text-3xl text-[#F2B84B] mt-2">
            ${totalOutstanding.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-[#93A59B] mt-1 flex items-center gap-1.5 font-mono">
            <Clock className="w-3.5 h-3.5 text-[#F2B84B]" />
            <span>Sent & Overdue balances</span>
          </div>
        </div>

        <div className="surface-card p-5">
          <span className="font-mono-label text-[#4ADE80]">Collected Revenue</span>
          <div className="font-serif-display text-3xl text-[#4ADE80] mt-2">
            ${totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-[#93A59B] mt-1 flex items-center gap-1.5 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#4ADE80]" />
            <span>Settled in full</span>
          </div>
        </div>
      </div>

      {/* Invoices Table */}
      <div className="surface-card overflow-hidden">
        <div className="p-4 border-b border-[#22302A] flex items-center justify-between">
          <span className="font-mono-label">Organization Invoice Ledger</span>
          <span className="text-xs font-mono text-[#5F6F66]">
            Showing {invoices.length} invoices
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#16201B]/60 border-b border-[#22302A]">
              <tr>
                <th className="px-5 py-3 font-mono-label">Invoice No</th>
                <th className="px-5 py-3 font-mono-label">Client</th>
                <th className="px-5 py-3 font-mono-label">Issue Date</th>
                <th className="px-5 py-3 font-mono-label">Due Date</th>
                <th className="px-5 py-3 font-mono-label">Billed Hours</th>
                <th className="px-5 py-3 font-mono-label">Total Amount</th>
                <th className="px-5 py-3 font-mono-label">Status</th>
                <th className="px-5 py-3 text-right font-mono-label">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#22302A]">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-5 py-8 text-center text-[#5F6F66]">
                    No invoices on record. Click &ldquo;Generate Invoice&rdquo; to bill unbilled project hours.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#16201B]/40 transition-colors">
                    <td className="px-5 py-3.5 font-mono">
                      <InvoiceLineItemsModal
                        invoiceNumber={inv.invoiceNumber}
                        clientName={inv.clientName}
                        total={inv.total}
                        lineItems={inv.lineItems || []}
                      />
                    </td>

                    <td className="px-5 py-3.5 font-medium text-[#E8F1EC]">{inv.clientName}</td>

                    <td className="px-5 py-3.5 font-mono text-[#93A59B]">{inv.issueDate}</td>

                    <td className="px-5 py-3.5 font-mono">
                      <span className={inv.isOverdue ? "text-[#F0646E] font-semibold" : "text-[#93A59B]"}>
                        {inv.dueDate}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 font-mono text-[#2DB6A8]">
                      {inv.totalHoursBilled}h
                    </td>

                    <td className="px-5 py-3.5 font-mono font-bold text-[#E8F1EC]">
                      ${Number(inv.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    <td className="px-5 py-3.5">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-mono uppercase tracking-wider ${
                          inv.status === InvoiceStatus.PAID
                            ? "bg-[#4ADE80]/15 text-[#4ADE80] border border-[#4ADE80]/30"
                            : inv.status === InvoiceStatus.SENT
                            ? "bg-[#2DB6A8]/15 text-[#2DB6A8] border border-[#2DB6A8]/30"
                            : inv.status === InvoiceStatus.OVERDUE
                            ? "bg-[#F0646E]/15 text-[#F0646E] border border-[#F0646E]/30"
                            : inv.status === InvoiceStatus.DRAFT
                            ? "bg-[#F2B84B]/15 text-[#F2B84B] border border-[#F2B84B]/30"
                            : "bg-[#1D2A24] text-[#5F6F66] border border-[#2F4239]"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>

                    <td className="px-5 py-3.5 text-right">
                      <InvoiceActionsDropdown invoiceId={inv.id} status={inv.status} />
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
