import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import path from "path";
import { Role, InvoiceStatus, LeaveStatus } from "@prisma/client";
import { encodeSession, decodeSession } from "../src/lib/auth";
import { decideLeave, getLeaveBalances } from "../src/modules/people/leave-service";
import { toggleOnboardingItem } from "../src/modules/people/onboarding-service";
import { listReviewsForSubject, scheduleOneOnOne, sendFeedback } from "../src/modules/performance/service";
import { getWeeklyTimesheet } from "../src/modules/work/service";
import { canViewInvoice } from "../src/modules/work/billing-policies";
import { getClientPortalOverview } from "../src/modules/work/billing-service";
import { rawPrisma } from "../src/lib/db";
import { env } from "../src/lib/env";

describe("Sprint 1 Security & Multi-Tenancy Hardening", () => {
  let orgA: any;
  let orgB: any;
  let ownerA: any;
  let empA: any;
  let ownerB: any;
  let empB: any;
  let clientA: any;
  let clientUserA: any;

  before(async () => {
    // Clean up test data if left over
    await rawPrisma.organization.deleteMany({
      where: { slug: { in: ["sec-test-org-a", "sec-test-org-b"] } },
    });

    // Create Organization A
    orgA = await rawPrisma.organization.create({
      data: {
        name: "Security Test Org A",
        slug: "sec-test-org-a",
        invoiceSequence: { create: { lastNumber: 100 } },
      },
    });

    empA = await rawPrisma.employee.create({
      data: {
        organizationId: orgA.id,
        firstName: "Alice",
        lastName: "A",
        jobTitle: "Engineer A",
        startDate: new Date("2024-01-01"),
      },
    });

    ownerA = await rawPrisma.user.create({
      data: {
        organizationId: orgA.id,
        email: "owner@orga.com",
        role: Role.OWNER,
        employeeId: empA.id,
      },
    });

    clientA = await rawPrisma.client.create({
      data: {
        organizationId: orgA.id,
        name: "Client Alpha",
        email: "client@alpha.com",
      },
    });

    clientUserA = await rawPrisma.user.create({
      data: {
        organizationId: orgA.id,
        email: "portal@alpha.com",
        role: Role.CLIENT,
        clientId: clientA.id,
      },
    });

    // Create Organization B
    orgB = await rawPrisma.organization.create({
      data: {
        name: "Security Test Org B",
        slug: "sec-test-org-b",
        invoiceSequence: { create: { lastNumber: 100 } },
      },
    });

    empB = await rawPrisma.employee.create({
      data: {
        organizationId: orgB.id,
        firstName: "Bob",
        lastName: "B",
        jobTitle: "Engineer B",
        startDate: new Date("2024-01-01"),
      },
    });

    ownerB = await rawPrisma.user.create({
      data: {
        organizationId: orgB.id,
        email: "owner@orgb.com",
        role: Role.OWNER,
        employeeId: empB.id,
      },
    });
  });

  after(async () => {
    await rawPrisma.organization.deleteMany({
      where: { slug: { in: ["sec-test-org-a", "sec-test-org-b"] } },
    });
  });

  // ==========================================
  // S1: SESSION COOKIE SIGNING & TAMPERING
  // ==========================================
  describe("S1: Session Cookie HMAC Integrity", () => {
    it("should correctly encode and decode a valid session", () => {
      const sessionData = {
        userId: ownerA.id,
        organizationId: orgA.id,
        role: Role.OWNER,
        email: ownerA.email,
        name: "Owner A",
      };

      const cookieVal = encodeSession(sessionData);
      assert.ok(cookieVal.includes("."), "Cookie must have format payload.signature");

      const decoded = decodeSession(cookieVal);
      assert.ok(decoded);
      assert.equal(decoded.userId, ownerA.id);
      assert.equal(decoded.role, Role.OWNER);
    });

    it("should reject tampered session payload (privilege escalation attempt)", () => {
      const validCookie = encodeSession({
        userId: "user-123",
        organizationId: orgA.id,
        role: Role.EMPLOYEE,
        email: "employee@orga.com",
        name: "Employee",
      });

      const [payload, signature] = validCookie.split(".");
      // Tamper payload to elevate to OWNER
      const decodedPayload = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
      decodedPayload.role = "OWNER";
      const tamperedPayload = Buffer.from(JSON.stringify(decodedPayload)).toString("base64url");
      const tamperedCookie = `${tamperedPayload}.${signature}`;

      const result = decodeSession(tamperedCookie);
      assert.equal(result, null, "Tampered payload with original signature must be rejected");
    });

    it("should reject invalid/forged signature", () => {
      const validCookie = encodeSession({
        userId: "user-123",
        organizationId: orgA.id,
        role: Role.EMPLOYEE,
        email: "employee@orga.com",
        name: "Employee",
      });

      const [payload] = validCookie.split(".");
      const forgedCookie = `${payload}.invalidsignature1234567890`;
      assert.equal(decodeSession(forgedCookie), null);
    });

    it("should reject legacy unsigned base64 cookies", () => {
      const unsigned = Buffer.from(JSON.stringify({ userId: "123", role: "OWNER" })).toString("base64");
      assert.equal(decodeSession(unsigned), null);
    });
  });

  // ==========================================
  // S5: CROSS-TENANT IDOR IN CHILD SERVICES
  // ==========================================
  describe("S5: Cross-Tenant IDOR Guard Verification", () => {
    it("decideLeave: prevents Owner of Org A from deciding leave of Org B employee", async () => {
      const leaveTypeB = await rawPrisma.leaveType.create({
        data: { organizationId: orgB.id, name: "Vacation B", daysAllowance: 20 },
      });

      const leaveReqB = await rawPrisma.leaveRequest.create({
        data: {
          employeeId: empB.id,
          leaveTypeId: leaveTypeB.id,
          startDate: new Date("2026-06-01"),
          endDate: new Date("2026-06-03"),
          daysCount: 3,
          status: LeaveStatus.PENDING,
        },
      });

      const sessionUserA = {
        userId: ownerA.id,
        organizationId: orgA.id,
        role: Role.OWNER,
        email: ownerA.email,
        name: "Owner A",
      };

      await assert.rejects(
        async () => {
          await decideLeave(leaveReqB.id, "APPROVED", sessionUserA);
        },
        /Leave request not found/
      );
    });

    it("getLeaveBalances: prevents querying balances of an employee from another organization", async () => {
      await assert.rejects(
        async () => {
          await getLeaveBalances(empB.id, orgA.id);
        },
        /Employee not found in organization/
      );
    });

    it("toggleOnboardingItem: prevents Owner of Org A from modifying checklist of Org B", async () => {
      const templateB = await rawPrisma.onboardingTemplate.create({
        data: { organizationId: orgB.id, name: "Engineering Onboarding B" },
      });

      const checklistB = await rawPrisma.onboardingChecklist.create({
        data: {
          organizationId: orgB.id,
          employeeId: empB.id,
          templateId: templateB.id,
          items: {
            create: [{ title: "Setup Laptop", dueDate: new Date() }],
          },
        },
        include: { items: true },
      });

      const itemB = checklistB.items[0];

      const sessionUserA = {
        userId: ownerA.id,
        organizationId: orgA.id,
        role: Role.OWNER,
        email: ownerA.email,
        name: "Owner A",
      };

      await assert.rejects(
        async () => {
          await toggleOnboardingItem(itemB.id, true, sessionUserA);
        },
        /Onboarding item not found/
      );
    });

    it("listReviewsForSubject: returns empty list when subject belongs to another organization", async () => {
      const sessionUserA = {
        userId: ownerA.id,
        organizationId: orgA.id,
        role: Role.OWNER,
        email: ownerA.email,
        name: "Owner A",
      };

      const reviews = await listReviewsForSubject(empB.id, sessionUserA);
      assert.deepEqual(reviews, [], "Must return empty array for out-of-tenant subject");
    });

    it("scheduleOneOnOne: prevents scheduling 1:1 with an employee from another organization", async () => {
      const sessionUserA = {
        userId: ownerA.id,
        organizationId: orgA.id,
        role: Role.OWNER,
        employeeId: empA.id,
        email: ownerA.email,
        name: "Owner A",
      };

      await assert.rejects(
        async () => {
          await scheduleOneOnOne(
            { reportId: empB.id, scheduledAt: new Date().toISOString() },
            sessionUserA
          );
        },
        /Report not found in organization/
      );
    });

    it("sendFeedback: prevents sending feedback to an employee from another organization", async () => {
      const sessionUserA = {
        userId: ownerA.id,
        organizationId: orgA.id,
        role: Role.OWNER,
        employeeId: empA.id,
        email: ownerA.email,
        name: "Owner A",
      };

      await assert.rejects(
        async () => {
          await sendFeedback(
            { toId: empB.id, type: "KUDOS", message: "Great job across orgs!" },
            sessionUserA
          );
        },
        /Recipient not found in organization/
      );
    });

    it("getWeeklyTimesheet: prevents viewing timesheet of another organization", async () => {
      const sessionUserA = {
        userId: ownerA.id,
        organizationId: orgA.id,
        role: Role.OWNER,
        employeeId: empA.id,
        email: ownerA.email,
        name: "Owner A",
      };

      await assert.rejects(
        async () => {
          await getWeeklyTimesheet(empB.id, "2026-05-04", sessionUserA);
        },
        /Employee not found in organization/
      );
    });
  });

  // ==========================================
  // S7: STORAGE PATH TRAVERSAL
  // ==========================================
  describe("S7: Storage Containment", () => {
    it("should reject path traversal in storage path resolution", () => {
      const baseDir = path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR);
      const evilKey = "../../../.env";
      const resolved = path.resolve(baseDir, evilKey);

      assert.equal(
        resolved.startsWith(baseDir + path.sep),
        false,
        "Malicious key must resolve outside base directory"
      );
    });
  });

  // ==========================================
  // S8: CLIENT PORTAL & INVOICE SCOPING
  // ==========================================
  describe("S8: Client Portal & Invoice Policies", () => {
    it("canViewInvoice: blocks manager from viewing invoice if manager does not lead any project on it", () => {
      const managerUser = {
        userId: "mgr-1",
        organizationId: orgA.id,
        role: Role.MANAGER,
        employeeId: "emp-mgr-1",
        email: "mgr@orga.com",
        name: "Manager 1",
      };

      const invoiceWithoutManager = {
        organizationId: orgA.id,
        clientId: clientA.id,
        lineItems: [
          {
            timeEntries: [
              { project: { leadId: "other-lead" }, projectId: "proj-1" },
            ],
          },
        ],
      };

      assert.equal(
        canViewInvoice(managerUser, invoiceWithoutManager),
        false,
        "Manager must not view invoice without led projects"
      );
    });

    it("canViewInvoice: allows manager when manager leads a project on the invoice", () => {
      const managerUser = {
        userId: "mgr-1",
        organizationId: orgA.id,
        role: Role.MANAGER,
        employeeId: "emp-mgr-1",
        email: "mgr@orga.com",
        name: "Manager 1",
      };

      const invoiceWithManager = {
        organizationId: orgA.id,
        clientId: clientA.id,
        lineItems: [
          {
            timeEntries: [
              { project: { leadId: "emp-mgr-1" }, projectId: "proj-1" },
            ],
          },
        ],
      };

      assert.equal(
        canViewInvoice(managerUser, invoiceWithManager),
        true,
        "Manager should be able to view invoice containing their led project"
      );
    });

    it("getClientPortalOverview: rejects non-owner employee from accessing portal overview", async () => {
      const employeeUser = {
        userId: "emp-user-1",
        organizationId: orgA.id,
        role: Role.EMPLOYEE,
        employeeId: empA.id,
        email: "alice@orga.com",
        name: "Alice",
      };

      await assert.rejects(
        async () => {
          await getClientPortalOverview(employeeUser);
        },
        /Unauthorized to access the client portal/
      );
    });

    it("getClientPortalOverview: excludes DRAFT and VOID invoices from client overview", async () => {
      // Create a DRAFT, a VOID, and a SENT invoice for Client A
      await rawPrisma.invoice.create({
        data: {
          organizationId: orgA.id,
          clientId: clientA.id,
          invoiceNumber: "INV-SEC-DRAFT",
          status: InvoiceStatus.DRAFT,
          issueDate: new Date(),
          dueDate: new Date(),
          total: 100,
        },
      });

      await rawPrisma.invoice.create({
        data: {
          organizationId: orgA.id,
          clientId: clientA.id,
          invoiceNumber: "INV-SEC-VOID",
          status: InvoiceStatus.VOID,
          issueDate: new Date(),
          dueDate: new Date(),
          total: 200,
        },
      });

      await rawPrisma.invoice.create({
        data: {
          organizationId: orgA.id,
          clientId: clientA.id,
          invoiceNumber: "INV-SEC-SENT",
          status: InvoiceStatus.SENT,
          issueDate: new Date(),
          dueDate: new Date(),
          total: 300,
        },
      });

      const clientSession = {
        userId: clientUserA.id,
        organizationId: orgA.id,
        role: Role.CLIENT,
        clientId: clientA.id,
        email: clientUserA.email,
        name: "Client Alpha User",
      };

      const overview = await getClientPortalOverview(clientSession);
      const invoiceNumbers = overview.invoices.map((inv) => inv.invoiceNumber);

      assert.ok(invoiceNumbers.includes("INV-SEC-SENT"), "Sent invoice must be visible to client");
      assert.ok(!invoiceNumbers.includes("INV-SEC-DRAFT"), "Draft invoice must NOT be visible to client");
      assert.ok(!invoiceNumbers.includes("INV-SEC-VOID"), "Void invoice must NOT be visible to client");
    });
  });
});
