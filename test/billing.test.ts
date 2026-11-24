import { rawPrisma } from "../src/lib/db";
import {
  generateInvoiceFromTime,
  updateInvoiceStatus,
  checkOverdueInvoices,
  generateInvoicePdf,
  getClientPortalOverview,
} from "../src/modules/work/billing-service";
import { canViewInvoice } from "../src/modules/work/billing-policies";
import { Role, InvoiceStatus, ProjectType } from "@prisma/client";
import { SessionUser } from "../src/lib/auth";

async function runBillingTests() {
  console.log("🧪 Running Phase 4: Billing & Client Portal Verification Suite...\n");

  const org = await rawPrisma.organization.findUnique({ where: { slug: "brightwave" } });
  if (!org) throw new Error("Demo organization not found.");

  const ownerUser = await rawPrisma.user.findFirst({ where: { role: Role.OWNER, organizationId: org.id }, include: { employee: true } });
  const employeeUser = await rawPrisma.user.findFirst({ where: { role: Role.EMPLOYEE, email: "employee@brightwave.io" }, include: { employee: true } });
  const clientAcmeUser = await rawPrisma.user.findFirst({ where: { role: Role.CLIENT, email: "client@acmeglobal.com" }, include: { client: true } });

  const clientAcme = await rawPrisma.client.findFirst({ where: { organizationId: org.id, name: { contains: "Acme" } } });
  const clientNova = await rawPrisma.client.findFirst({ where: { organizationId: org.id, name: { contains: "Nova" } } });

  // Clean up any test invoices from previous runs to ensure test idempotency
  await rawPrisma.invoice.deleteMany({
    where: { organizationId: org.id, invoiceNumber: { startsWith: "INV-BILLING-TEST" } },
  });

  const ownerSession: SessionUser = {
    userId: ownerUser!.id,
    organizationId: org.id,
    role: Role.OWNER,
    employeeId: ownerUser!.employeeId,
    email: ownerUser!.email,
    name: "Sarah Sterling",
  };

  const clientAcmeSession: SessionUser = {
    userId: clientAcmeUser!.id,
    organizationId: org.id,
    role: Role.CLIENT,
    clientId: clientAcme!.id,
    email: clientAcmeUser!.email,
    name: "Arthur Pendelton",
  };

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, testName: string) {
    total++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
      throw new Error(`Assertion failed: ${testName}`);
    }
  }

  // --- Setup: Create test project with billable time entries ---
  const project = await rawPrisma.project.create({
    data: {
      organizationId: org.id,
      clientId: clientAcme!.id,
      name: "Billing Test Project Alpha",
      type: ProjectType.TIME_AND_MATERIALS,
      budget: 50000,
    },
  });

  // Log 10 hours of billable work by Alex Chen
  const entry1 = await rawPrisma.timeEntry.create({
    data: {
      organizationId: org.id,
      projectId: project.id,
      employeeId: employeeUser!.employeeId!,
      date: new Date("2026-10-01"),
      hours: 6.0,
      billable: true,
      description: "Frontend layout and dark theme implementation",
    },
  });

  const entry2 = await rawPrisma.timeEntry.create({
    data: {
      organizationId: org.id,
      projectId: project.id,
      employeeId: employeeUser!.employeeId!,
      date: new Date("2026-10-02"),
      hours: 4.0,
      billable: true,
      description: "State machines and atomic validation tests",
    },
  });

  // --- Test 1: Generate Invoice from Unbilled Time ---
  const invoice = await generateInvoiceFromTime(
    {
      projectId: project.id,
      startDate: "2026-10-01",
      endDate: "2026-10-05",
      dueDate: "2026-10-31",
      defaultRate: 150,
    },
    ownerSession
  );

  assert(invoice.invoiceNumber.startsWith("INV-"), "Generated invoice has sequential number format");
  assert(invoice.status === InvoiceStatus.DRAFT, "Generated invoice starts in DRAFT status");
  assert(Number(invoice.total) === 1500, "Calculated total is exact: 10 hours @ $150/hr = $1,500.00");

  // --- Test 2: Atomic Locking of Billed Time Entries ---
  const updatedEntry1 = await rawPrisma.timeEntry.findUnique({ where: { id: entry1.id } });
  const updatedEntry2 = await rawPrisma.timeEntry.findUnique({ where: { id: entry2.id } });

  assert(updatedEntry1?.invoiceLineItemId !== null, "Time entry 1 is locked with invoiceLineItemId");
  assert(updatedEntry2?.invoiceLineItemId !== null, "Time entry 2 is locked with invoiceLineItemId");

  // --- Test 3: Double-Billing Prevention ---
  let doubleBillingBlocked = false;
  try {
    await generateInvoiceFromTime(
      {
        projectId: project.id,
        startDate: "2026-10-01",
        endDate: "2026-10-05",
        dueDate: "2026-10-31",
        defaultRate: 150,
      },
      ownerSession
    );
  } catch {
    doubleBillingBlocked = true;
  }
  assert(doubleBillingBlocked, "Double-billing prevented: already billed entries cannot be billed again");

  // --- Test 4: Invoice State Transitions (DRAFT -> SENT -> PAID) ---
  await updateInvoiceStatus(invoice.id, InvoiceStatus.SENT, ownerSession);
  const sentInv = await rawPrisma.invoice.findUnique({ where: { id: invoice.id } });
  assert(sentInv?.status === InvoiceStatus.SENT, "Invoice transitioned from DRAFT to SENT");

  await updateInvoiceStatus(invoice.id, InvoiceStatus.PAID, ownerSession);
  const paidInv = await rawPrisma.invoice.findUnique({ where: { id: invoice.id } });
  assert(paidInv?.status === InvoiceStatus.PAID, "Invoice transitioned from SENT to PAID");

  // Paid invoice cannot be modified back to Draft
  let revertPaidBlocked = false;
  try {
    await updateInvoiceStatus(invoice.id, InvoiceStatus.DRAFT, ownerSession);
  } catch {
    revertPaidBlocked = true;
  }
  assert(revertPaidBlocked, "Terminal state enforced: Paid invoice cannot be changed back to Draft");

  // --- Test 5: Voiding an Invoice Unlocks Time Entries ---
  // Generate a second invoice to test VOID behavior
  const entry3 = await rawPrisma.timeEntry.create({
    data: {
      organizationId: org.id,
      projectId: project.id,
      employeeId: employeeUser!.employeeId!,
      date: new Date("2026-10-10"),
      hours: 5.0,
      billable: true,
      description: "Testing void release",
    },
  });

  const invoice2 = await generateInvoiceFromTime(
    {
      projectId: project.id,
      startDate: "2026-10-09",
      endDate: "2026-10-12",
      dueDate: "2026-10-25",
      defaultRate: 150,
    },
    ownerSession
  );

  // Void invoice2
  await updateInvoiceStatus(invoice2.id, InvoiceStatus.VOID, ownerSession);
  const voidedInv = await rawPrisma.invoice.findUnique({ where: { id: invoice2.id } });
  assert(voidedInv?.status === InvoiceStatus.VOID, "Invoice marked as VOID");

  const releasedEntry3 = await rawPrisma.timeEntry.findUnique({ where: { id: entry3.id } });
  assert(releasedEntry3?.invoiceLineItemId === null, "Voiding an invoice successfully released its time entries for re-billing!");

  // --- Test 6: Overdue Invoice Flipping ---
  // Create an invoice with due date in the past
  const pastDate = new Date();
  pastDate.setUTCDate(pastDate.getUTCDate() - 5);

  const overdueTestInv = await rawPrisma.invoice.create({
    data: {
      organizationId: org.id,
      clientId: clientAcme!.id,
      invoiceNumber: `INV-OVERDUE-TEST-${Date.now()}`,
      status: InvoiceStatus.SENT,
      issueDate: new Date("2026-09-01"),
      dueDate: pastDate,
      total: 500,
    },
  });

  await checkOverdueInvoices(org.id);
  const checkedOverdue = await rawPrisma.invoice.findUnique({ where: { id: overdueTestInv.id } });
  assert(checkedOverdue?.status === InvoiceStatus.OVERDUE, "checkOverdueInvoices() correctly flipped past-due SENT invoice to OVERDUE");

  // --- Test 7: Client Portal IDOR Defense ---
  // Create an invoice for Nova Interactive (Client B)
  const novaInvoice = await rawPrisma.invoice.create({
    data: {
      organizationId: org.id,
      clientId: clientNova!.id,
      invoiceNumber: `INV-NOVA-CONFIDENTIAL-${Date.now()}`,
      status: InvoiceStatus.SENT,
      issueDate: new Date(),
      dueDate: new Date(),
      total: 25000,
    },
  });

  const canAcmeSeeNova = canViewInvoice(clientAcmeSession, novaInvoice);
  assert(!canAcmeSeeNova, "IDOR Resistance: Acme Global user is strictly BLOCKED from viewing Nova Interactive's invoice");

  // --- Test 8: Client Portal Overview DTO Shaping ---
  const portalData = await getClientPortalOverview(clientAcmeSession);
  assert(portalData.clientName.includes("Acme"), "Portal data correctly scoped to Acme Global");
  assert(
    !portalData.invoices.some((i) => i.invoiceNumber.includes("NOVA")),
    "Portal invoice list strictly contains only Acme's own invoices"
  );

  // Clean up test records
  await rawPrisma.invoice.deleteMany({
    where: { id: { in: [invoice.id, invoice2.id, overdueTestInv.id, novaInvoice.id] } },
  });
  await rawPrisma.project.delete({ where: { id: project.id } });

  console.log(`\n🎉 Billing & Client Portal Test Suite Completed: ${passed}/${total} tests passed!\n`);
}

runBillingTests()
  .catch((e) => {
    console.error("Test failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await rawPrisma.$disconnect();
  });
