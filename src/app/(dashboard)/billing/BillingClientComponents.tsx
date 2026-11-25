"use client";

import { useState, useTransition } from "react";
import {
  generateInvoiceAction,
  updateInvoiceStatusAction,
  downloadInvoicePdfAction,
} from "@/app/actions/billing-actions";
import { InvoiceStatus } from "@prisma/client";
import { Plus, X, Send, CheckCircle2, Ban, Download, Receipt } from "lucide-react";

interface GenerateInvoiceModalProps {
  projects: { id: string; name: string; clientName: string }[];
}

export function GenerateInvoiceModal({ projects }: GenerateInvoiceModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const todayStr = new Date().toISOString().split("T")[0];
  const thirtyDaysLater = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await generateInvoiceAction(formData);
        setIsOpen(false);
      } catch (err: any) {
        setError(err.message || "Failed to generate invoice");
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
        <span>Generate Invoice</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-md p-6 space-y-4 border border-[#2F4239] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#22302A] pb-3">
              <h3 className="text-base font-semibold text-[#F4FAF7]">Generate Invoice from Hours</h3>
              <button onClick={() => setIsOpen(false)} className="text-[#93A59B] hover:text-[#E8F1EC]">
                <X className="w-4 h-4" />
              </button>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[#F0646E]/10 border border-[#F0646E]/30 text-xs text-[#F0646E]">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="font-mono-label block mb-1">Project</label>
                <select
                  name="projectId"
                  required
                  className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({p.clientName})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono-label block mb-1">Billing Start Date</label>
                  <input
                    type="date"
                    name="startDate"
                    required
                    defaultValue="2026-01-01"
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                  />
                </div>

                <div>
                  <label className="font-mono-label block mb-1">Billing End Date</label>
                  <input
                    type="date"
                    name="endDate"
                    required
                    defaultValue={todayStr}
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-mono-label block mb-1">Due Date</label>
                  <input
                    type="date"
                    name="dueDate"
                    required
                    defaultValue={thirtyDaysLater}
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                  />
                </div>

                <div>
                  <label className="font-mono-label block mb-1">Default Hourly Rate ($)</label>
                  <input
                    type="number"
                    name="defaultRate"
                    min="10"
                    step="5"
                    defaultValue="150"
                    required
                    className="w-full bg-[#16201B] border border-[#2F4239] rounded-lg px-3 py-2 text-[#E8F1EC] focus:outline-none focus:border-[#34D399]"
                  />
                </div>
              </div>

              <div className="p-2.5 rounded bg-[#16201B] border border-[#22302A] text-[11px] text-[#93A59B]">
                • Locks all included time entries with unique line item references.
                <br />• Generates sequential invoice ID and computes amounts with Decimal precision.
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
                  {isPending ? "Generating..." : "Generate Invoice"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export function InvoiceActionsDropdown({
  invoiceId,
  status,
}: {
  invoiceId: string;
  status: InvoiceStatus;
}) {
  const [isPending, startTransition] = useTransition();

  const handleStatusChange = (newStatus: InvoiceStatus) => {
    startTransition(async () => {
      await updateInvoiceStatusAction(invoiceId, newStatus);
    });
  };

  const handleDownload = async () => {
    startTransition(async () => {
      const res = await downloadInvoicePdfAction(invoiceId);
      if (res.url) {
        window.open(res.url, "_blank");
      }
    });
  };

  return (
    <div className="flex items-center gap-2 justify-end">
      {status === InvoiceStatus.DRAFT && (
        <button
          onClick={() => handleStatusChange(InvoiceStatus.SENT)}
          disabled={isPending}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#2DB6A8]/15 hover:bg-[#2DB6A8]/25 text-[#2DB6A8] border border-[#2DB6A8]/30 font-medium text-[11px] transition-all disabled:opacity-50"
        >
          <Send className="w-3 h-3" />
          <span>Send</span>
        </button>
      )}

      {(status === InvoiceStatus.SENT || status === InvoiceStatus.OVERDUE) && (
        <button
          onClick={() => handleStatusChange(InvoiceStatus.PAID)}
          disabled={isPending}
          className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#4ADE80]/15 hover:bg-[#4ADE80]/25 text-[#4ADE80] border border-[#4ADE80]/30 font-medium text-[11px] transition-all disabled:opacity-50"
        >
          <CheckCircle2 className="w-3 h-3" />
          <span>Mark Paid</span>
        </button>
      )}

      {status !== InvoiceStatus.PAID && status !== InvoiceStatus.VOID && (
        <button
          onClick={() => handleStatusChange(InvoiceStatus.VOID)}
          disabled={isPending}
          className="flex items-center gap-1 px-2 py-1 rounded bg-[#16201B] hover:bg-[#1D2A24] text-[#93A59B] hover:text-[#F0646E] border border-[#22302A] text-[11px] transition-all disabled:opacity-50"
          title="Void invoice and unlock linked hours"
        >
          <Ban className="w-3 h-3" />
          <span>Void</span>
        </button>
      )}

      <button
        onClick={handleDownload}
        disabled={isPending}
        className="flex items-center gap-1 px-2 py-1 rounded bg-[#16201B] hover:bg-[#1D2A24] text-[#93A59B] hover:text-[#E8F1EC] border border-[#22302A] text-[11px] transition-all disabled:opacity-50"
        title="Download official statement"
      >
        <Download className="w-3 h-3" />
        <span>{isPending ? "..." : "PDF"}</span>
      </button>
    </div>
  );
}

export function PortalInvoiceDownloadButton({ invoiceId }: { invoiceId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleDownload = () => {
    startTransition(async () => {
      try {
        const res = await downloadInvoicePdfAction(invoiceId);
        if (res.url) {
          window.open(res.url, "_blank");
        }
      } catch (err: any) {
        console.error("Statement download failed:", err);
      }
    });
  };

  return (
    <button
      onClick={handleDownload}
      disabled={isPending}
      className="inline-flex items-center gap-1 text-xs text-[#2DB6A8] hover:underline disabled:opacity-50"
    >
      <Download className="w-3.5 h-3.5" />
      <span>{isPending ? "Generating..." : "Statement"}</span>
    </button>
  );
}

export function InvoiceLineItemsModal({
  invoiceNumber,
  clientName,
  total,
  lineItems,
}: {
  invoiceNumber: string;
  clientName: string;
  total: string;
  lineItems: Array<{ id: string; description: string; hours: string; rate: string; amount: string }>;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="font-mono font-semibold text-[#E8F1EC] hover:text-[#34D399] transition-colors underline decoration-dotted"
        title="View invoice line items"
      >
        {invoiceNumber}
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="surface-card w-full max-w-lg p-6 space-y-4 border border-[#2F4239] animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-[#22302A] pb-3">
              <div>
                <div className="font-mono-label text-[#34D399]">Invoice Breakdown</div>
                <h3 className="text-base font-semibold text-[#F4FAF7]">
                  {invoiceNumber} &bull; {clientName}
                </h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="text-[#93A59B] hover:text-[#E8F1EC] p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#16201B] border-b border-[#22302A] text-[#93A59B] font-mono">
                  <tr>
                    <th className="p-2.5">Description</th>
                    <th className="p-2.5 text-right">Hours</th>
                    <th className="p-2.5 text-right">Rate</th>
                    <th className="p-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#22302A]">
                  {lineItems.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-[#5F6F66]">
                        No itemized details recorded.
                      </td>
                    </tr>
                  ) : (
                    lineItems.map((li) => (
                      <tr key={li.id}>
                        <td className="p-2.5 text-[#E8F1EC]">{li.description}</td>
                        <td className="p-2.5 text-right font-mono text-[#93A59B]">{li.hours}h</td>
                        <td className="p-2.5 text-right font-mono text-[#93A59B]">${li.rate}</td>
                        <td className="p-2.5 text-right font-mono font-medium text-[#E8F1EC]">${li.amount}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pt-3 border-t border-[#22302A] flex items-center justify-between font-mono">
              <span className="text-xs text-[#93A59B]">Total Amount Due:</span>
              <span className="text-base font-bold text-[#34D399]">${total} USD</span>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-1.5 rounded-lg bg-[#16201B] hover:bg-[#1D2A24] text-xs text-[#93A59B] hover:text-[#E8F1EC] border border-[#22302A]"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
