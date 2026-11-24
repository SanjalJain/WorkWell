import { rawPrisma } from "@/lib/db";
import { withTenant } from "@/lib/tenant";
import { SessionUser } from "@/lib/auth";
import { canManageInvoices, canViewInvoice, canTransitionInvoiceStatus } from "./billing-policies";
import {
  GenerateInvoiceInput,
  InvoiceDTO,
  InvoiceDetailDTO,
  PortalInvoiceDTO,
  PortalProjectDTO,
} from "./billing-schema";
import { storage } from "@/lib/storage";
import { logAudit } from "@/lib/audit";
import { Prisma, InvoiceStatus, Role, TaskStatus } from "@prisma/client";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

/**
 * Atomically generates an invoice from unbilled billable time entries.
 * Enforces sequential numbering via InvoiceSequence and locks time entries against double-billing.
 */
export async function generateInvoiceFromTime(
  input: GenerateInvoiceInput,
  user: SessionUser
): Promise<InvoiceDetailDTO> {
  if (!canManageInvoices(user)) {
    throw new Error("Unauthorized to generate invoices");
  }

  const project = await rawPrisma.project.findFirst({
    where: { id: input.projectId, organizationId: user.organizationId },
    include: { client: true },
  });
  if (!project) throw new Error("Project not found in organization");

  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  const dueDate = new Date(input.dueDate);

  return withTenant(user.organizationId, async (tx) => {
    // 1. Fetch unbilled billable time entries in the specified date range
    const unbilledEntries = await tx.timeEntry.findMany({
      where: {
        projectId: input.projectId,
        organizationId: user.organizationId,
        billable: true,
        invoiceLineItemId: null,
        date: { gte: start, lte: end },
      },
      include: {
        employee: {
          include: {
            compensations: {
              where: {
                effectiveFrom: { lte: end },
                OR: [{ effectiveTo: null }, { effectiveTo: { gte: start } }],
              },
              orderBy: { effectiveFrom: "desc" },
            },
          },
        },
      },
      orderBy: { date: "asc" },
    });

    if (unbilledEntries.length === 0) {
      throw new Error("No unbilled billable time entries found for this project in the selected period");
    }

    // 2. Sequential Invoice Numbering (prevents MAX()+1 race conditions)
    const seq = await tx.invoiceSequence.upsert({
      where: { organizationId: user.organizationId },
      create: { organizationId: user.organizationId, lastNumber: 1001 },
      update: { lastNumber: { increment: 1 } },
    });
    const invoiceNumber = `INV-${seq.lastNumber}`;

    // 3. Compute itemized lines and total amount using Decimal math
    let invoiceTotal = new Prisma.Decimal(0);
    const lineItemData: Array<{
      description: string;
      hours: Prisma.Decimal;
      rate: Prisma.Decimal;
      amount: Prisma.Decimal;
      timeEntryIds: string[];
    }> = [];

    const findRateForEntry = (e: (typeof unbilledEntries)[0]): Prisma.Decimal => {
      const match = e.employee.compensations.find(
        (c) => e.date >= c.effectiveFrom && (!c.effectiveTo || e.date <= c.effectiveTo)
      );
      return match?.billableRate ?? new Prisma.Decimal(input.defaultRate);
    };

    // Group entries by employee and exact effective rate on entry.date
    const grouped = new Map<
      string,
      {
        employee: (typeof unbilledEntries)[0]["employee"];
        rate: Prisma.Decimal;
        entries: typeof unbilledEntries;
      }
    >();

    unbilledEntries.forEach((e) => {
      const rate = findRateForEntry(e);
      const key = `${e.employeeId}-${rate.toString()}`;
      if (!grouped.has(key)) {
        grouped.set(key, { employee: e.employee, rate, entries: [] });
      }
      grouped.get(key)!.entries.push(e);
    });

    for (const { employee, rate, entries } of grouped.values()) {
      const totalHours = entries.reduce(
        (sum, e) => sum.add(e.hours),
        new Prisma.Decimal(0)
      );
      const lineAmount = totalHours.mul(rate);
      invoiceTotal = invoiceTotal.add(lineAmount);

      lineItemData.push({
        description: `Professional Services: ${employee.firstName} ${employee.lastName} (${project.name})`,
        hours: totalHours,
        rate,
        amount: lineAmount,
        timeEntryIds: entries.map((e) => e.id),
      });
    }

    // 4. Create the Invoice record in DRAFT status
    const invoice = await tx.invoice.create({
      data: {
        organizationId: user.organizationId,
        clientId: project.clientId,
        invoiceNumber,
        status: InvoiceStatus.DRAFT,
        issueDate: new Date(),
        dueDate,
        total: invoiceTotal,
      },
    });

    // 5. Create Line Items and ATOMICALLY LOCK Time Entries
    const createdLines: Array<{ id: string; description: string; hours: string; rate: string; amount: string }> = [];

    for (const line of lineItemData) {
      const lineItem = await tx.invoiceLineItem.create({
        data: {
          invoiceId: invoice.id,
          description: line.description,
          hours: line.hours,
          rate: line.rate,
          amount: line.amount,
        },
      });

      // Conditional update to lock time entries (WHERE invoiceLineItemId IS NULL)
      const updateResult = await tx.timeEntry.updateMany({
        where: {
          id: { in: line.timeEntryIds },
          invoiceLineItemId: null,
        },
        data: {
          invoiceLineItemId: lineItem.id,
        },
      });

      if (updateResult.count !== line.timeEntryIds.length) {
        throw new Error("Concurrency collision: One or more time entries were billed concurrently by another process");
      }

      createdLines.push({
        id: lineItem.id,
        description: lineItem.description,
        hours: Number(lineItem.hours).toFixed(2),
        rate: Number(lineItem.rate).toFixed(2),
        amount: Number(lineItem.amount).toFixed(2),
      });
    }

    await logAudit(
      {
        organizationId: user.organizationId,
        userId: user.userId,
        action: "GENERATE_INVOICE",
        entity: "Invoice",
        entityId: invoice.id,
        metadata: {
          invoiceNumber,
          total: Number(invoiceTotal).toFixed(2),
          entriesBilledCount: unbilledEntries.length,
        },
      },
      tx
    );

    return {
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      clientId: invoice.clientId,
      clientName: project.client.name,
      clientEmail: project.client.email,
      status: invoice.status,
      issueDate: invoice.issueDate.toISOString().split("T")[0],
      dueDate: invoice.dueDate.toISOString().split("T")[0],
      total: Number(invoice.total).toFixed(2),
      lineItemsCount: createdLines.length,
      totalHoursBilled: unbilledEntries
        .reduce((sum, e) => sum + Number(e.hours), 0)
        .toFixed(1),
      isOverdue: false,
      createdAt: invoice.createdAt.toISOString().split("T")[0],
      lineItems: createdLines,
    };
  });
}

/**
 * Transitions invoice status according to state machine rules.
 * If voided, automatically unlocks linked time entries so they can be re-billed!
 */
export async function updateInvoiceStatus(
  invoiceId: string,
  targetStatus: InvoiceStatus,
  user: SessionUser
) {
  if (!canManageInvoices(user)) {
    throw new Error("Unauthorized to update invoice status");
  }

  const invoice = await rawPrisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: user.organizationId },
    include: { lineItems: true },
  });
  if (!invoice) throw new Error("Invoice not found");

  const transitionCheck = canTransitionInvoiceStatus(invoice.status, targetStatus);
  if (!transitionCheck.allowed) {
    throw new Error(transitionCheck.reason || "Invalid status transition");
  }

  return withTenant(user.organizationId, async (tx) => {
    // If voiding an invoice, unlock all linked time entries!
    if (targetStatus === InvoiceStatus.VOID) {
      const lineIds = invoice.lineItems.map((l) => l.id);
      await tx.timeEntry.updateMany({
        where: { invoiceLineItemId: { in: lineIds } },
        data: { invoiceLineItemId: null },
      });
    }

    const updated = await tx.invoice.update({
      where: { id: invoiceId },
      data: { status: targetStatus },
    });

    await logAudit(
      {
        organizationId: user.organizationId,
        userId: user.userId,
        action: `INVOICE_STATUS_${targetStatus}`,
        entity: "Invoice",
        entityId: invoiceId,
        metadata: { from: invoice.status, to: targetStatus },
      },
      tx
    );

    return updated;
  });
}

/**
 * Background / Cron job helper to mark past-due SENT invoices as OVERDUE.
 */
export async function checkOverdueInvoices(organizationId: string) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  return withTenant(organizationId, async (tx) => {
    return tx.invoice.updateMany({
      where: {
        organizationId,
        status: InvoiceStatus.SENT,
        dueDate: { lt: today },
      },
      data: {
        status: InvoiceStatus.OVERDUE,
      },
    });
  });
}

/**
 * Lists all invoices in the organization for internal billing management.
 */
export async function listInvoices(user: SessionUser): Promise<InvoiceDTO[]> {
  const isClient = user.role === Role.CLIENT;

  const where: Prisma.InvoiceWhereInput = {
    organizationId: user.organizationId,
    ...(isClient && user.clientId ? { clientId: user.clientId } : {}),
  };

  const invoices = await rawPrisma.invoice.findMany({
    where,
    include: {
      client: { select: { name: true, email: true } },
      lineItems: {
        include: {
          timeEntries: { select: { hours: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const todayStr = new Date().toISOString().split("T")[0];

  return invoices.map((inv) => {
    const totalHours = inv.lineItems.reduce(
      (sum, line) => sum + Number(line.hours),
      0
    );
    const dueDateStr = inv.dueDate.toISOString().split("T")[0];
    const isOverdue = inv.status === InvoiceStatus.OVERDUE || (inv.status === InvoiceStatus.SENT && dueDateStr < todayStr);

    return {
      id: inv.id,
      invoiceNumber: inv.invoiceNumber,
      clientId: inv.clientId,
      clientName: inv.client.name,
      clientEmail: inv.client.email,
      status: inv.status,
      issueDate: inv.issueDate.toISOString().split("T")[0],
      dueDate: dueDateStr,
      total: Number(inv.total).toFixed(2),
      pdfUrl: inv.pdfUrl,
      lineItemsCount: inv.lineItems.length,
      totalHoursBilled: totalHours.toFixed(1),
      isOverdue,
      createdAt: inv.createdAt.toISOString().split("T")[0],
    };
  });
}

/**
 * Generates an official invoice PDF / statement and stores it in object storage.
 */
export async function generateInvoicePdf(invoiceId: string, user: SessionUser): Promise<string> {
  const invoice = await rawPrisma.invoice.findFirst({
    where: { id: invoiceId, organizationId: user.organizationId },
    include: {
      client: true,
      lineItems: true,
      organization: true,
    },
  });

  if (!invoice) throw new Error("Invoice not found");
  if (!canViewInvoice(user, invoice)) throw new Error("Unauthorized to access this invoice");

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([600, 800]);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const { height } = page.getSize();
  let y = height - 50;

  // Header branding
  page.drawText(invoice.organization.name, { x: 50, y, size: 20, font: fontBold, color: rgb(0.05, 0.5, 0.4) });
  page.drawText("INVOICE STATEMENT", { x: 400, y, size: 14, font: fontBold, color: rgb(0.2, 0.2, 0.2) });
  y -= 30;

  page.drawText(`Invoice No: ${invoice.invoiceNumber}`, { x: 400, y, size: 10, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(`Issue Date: ${invoice.issueDate.toISOString().split("T")[0]}`, { x: 400, y: y - 15, size: 10, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(`Due Date:   ${invoice.dueDate.toISOString().split("T")[0]}`, { x: 400, y: y - 30, size: 10, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
  page.drawText(`Status:     ${invoice.status}`, { x: 400, y: y - 45, size: 10, font: fontBold, color: rgb(0.1, 0.6, 0.3) });

  page.drawText("BILLED TO:", { x: 50, y, size: 10, font: fontBold, color: rgb(0.3, 0.3, 0.3) });
  y -= 15;
  page.drawText(invoice.client.name, { x: 50, y, size: 12, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  y -= 15;
  page.drawText(invoice.client.email ?? "billing@client.com", { x: 50, y, size: 10, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });
  y -= 15;
  page.drawText(invoice.client.billingAddress ?? "Address on file", { x: 50, y, size: 10, font: fontRegular, color: rgb(0.4, 0.4, 0.4) });

  y -= 40;
  // Table Header
  page.drawRectangle({ x: 50, y: y - 5, width: 500, height: 22, color: rgb(0.92, 0.95, 0.93) });
  page.drawText("Description", { x: 60, y, size: 10, font: fontBold, color: rgb(0.1, 0.2, 0.1) });
  page.drawText("Hours", { x: 340, y, size: 10, font: fontBold, color: rgb(0.1, 0.2, 0.1) });
  page.drawText("Rate", { x: 410, y, size: 10, font: fontBold, color: rgb(0.1, 0.2, 0.1) });
  page.drawText("Amount", { x: 480, y, size: 10, font: fontBold, color: rgb(0.1, 0.2, 0.1) });
  y -= 25;

  // Line items
  for (const item of invoice.lineItems) {
    page.drawText(item.description.slice(0, 45), { x: 60, y, size: 9, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(Number(item.hours).toFixed(1), { x: 340, y, size: 9, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(`$${Number(item.rate).toFixed(2)}`, { x: 410, y, size: 9, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
    page.drawText(`$${Number(item.amount).toFixed(2)}`, { x: 480, y, size: 9, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
    y -= 18;
  }

  y -= 15;
  page.drawLine({ start: { x: 50, y }, end: { x: 550, y }, thickness: 1, color: rgb(0.8, 0.8, 0.8) });
  y -= 25;
  page.drawText("Total Due:", { x: 380, y, size: 12, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText(`$${Number(invoice.total).toFixed(2)} USD`, { x: 460, y, size: 14, font: fontBold, color: rgb(0.05, 0.5, 0.4) });

  const pdfBytes = await pdfDoc.save();
  const buffer = Buffer.from(pdfBytes);
  const storageKey = `invoices/${invoice.organizationId}/${invoice.invoiceNumber}.pdf`;

  await storage.saveBuffer(storageKey, buffer, "application/pdf");

  await rawPrisma.invoice.update({
    where: { id: invoice.id },
    data: { pdfUrl: storageKey },
  });

  return storage.getSignedDownloadUrl(storageKey);
}

// ==========================================
// 5. CLIENT PORTAL SERVICES (IDOR Protected)
// ==========================================

/**
 * Returns strictly scoped client portal overview.
 * IDOR Defense: Only queries data where clientId matches user.clientId.
 * DTO Protection: Zero staff salaries, zero cost margins, zero unassigned internal details.
 */
export async function getClientPortalOverview(user: SessionUser): Promise<{
  clientName: string;
  projects: PortalProjectDTO[];
  invoices: PortalInvoiceDTO[];
  totalOutstanding: string;
  totalPaid: string;
}> {
  if (user.role !== Role.CLIENT) {
    if (user.role !== Role.OWNER) {
      throw new Error("Unauthorized to access the client portal");
    }
    // If an Owner is previewing the portal, find the first client in org
    const fallbackClient = await rawPrisma.client.findFirst({
      where: { organizationId: user.organizationId },
    });
    if (!fallbackClient) {
      return { clientName: "Client Portal (Preview)", projects: [], invoices: [], totalOutstanding: "0.00", totalPaid: "0.00" };
    }
    user = { ...user, clientId: fallbackClient.id };
  }

  if (!user.clientId) {
    throw new Error("No client profile associated with this account");
  }

  const client = await rawPrisma.client.findUnique({
    where: { id: user.clientId },
  });
  if (!client || client.organizationId !== user.organizationId) {
    throw new Error("Client account not found");
  }

  const invoiceWhere: Prisma.InvoiceWhereInput = {
    clientId: client.id,
    organizationId: user.organizationId,
  };
  // External clients must never see DRAFT or VOID invoices
  if (user.role === Role.CLIENT) {
    invoiceWhere.status = { in: [InvoiceStatus.SENT, InvoiceStatus.PAID, InvoiceStatus.OVERDUE] };
  }

  const [projects, invoices] = await Promise.all([
    rawPrisma.project.findMany({
      where: { clientId: client.id, organizationId: user.organizationId },
      include: {
        lead: { select: { firstName: true, lastName: true } },
        tasks: { select: { status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    rawPrisma.invoice.findMany({
      where: invoiceWhere,
      include: { lineItems: true },
      orderBy: { issueDate: "desc" },
    }),
  ]);

  const portalProjects: PortalProjectDTO[] = projects.map((p) => {
    const totalTasks = p.tasks.length;
    const completedTasks = p.tasks.filter((t) => t.status === TaskStatus.DONE).length;
    const progressPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    return {
      id: p.id,
      name: p.name,
      type: p.type,
      status: p.status,
      leadName: p.lead ? `${p.lead.firstName} ${p.lead.lastName}` : null,
      totalTasks,
      completedTasks,
      progressPct,
    };
  });

  const portalInvoices: PortalInvoiceDTO[] = invoices.map((inv) => ({
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    issueDate: inv.issueDate.toISOString().split("T")[0],
    dueDate: inv.dueDate.toISOString().split("T")[0],
    total: Number(inv.total).toFixed(2),
    status: inv.status,
    pdfUrl: inv.pdfUrl,
    lineItems: inv.lineItems.map((l) => ({
      description: l.description,
      hours: Number(l.hours).toFixed(2),
      rate: Number(l.rate).toFixed(2),
      amount: Number(l.amount).toFixed(2),
    })),
  }));

  const totalOutstanding = invoices
    .filter((i) => i.status === InvoiceStatus.SENT || i.status === InvoiceStatus.OVERDUE)
    .reduce((sum, i) => sum + Number(i.total), 0)
    .toFixed(2);

  const totalPaid = invoices
    .filter((i) => i.status === InvoiceStatus.PAID)
    .reduce((sum, i) => sum + Number(i.total), 0)
    .toFixed(2);

  return {
    clientName: client.name,
    projects: portalProjects,
    invoices: portalInvoices,
    totalOutstanding,
    totalPaid,
  };
}
