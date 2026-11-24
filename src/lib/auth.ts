import { cookies } from "next/headers";
import { Role } from "@prisma/client";
import crypto from "crypto";
import { rawPrisma } from "./db";
import { env } from "./env";

export interface SessionUser {
  userId: string;
  organizationId: string;
  role: Role;
  employeeId?: string | null;
  clientId?: string | null;
  email: string;
  name: string;
}

const SESSION_COOKIE_NAME = "workwell_session";

/**
 * Encodes a session user object into a signed base64url cookie value.
 * Format: <payload_base64url>.<signature_base64url>
 */
export function encodeSession(user: SessionUser): string {
  const payload = Buffer.from(JSON.stringify(user)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", env.SESSION_SECRET)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

/**
 * Decodes and verifies a signed session cookie value.
 * Uses crypto.timingSafeEqual to prevent HMAC timing attacks.
 */
export function decodeSession(cookieValue: string): SessionUser | null {
  try {
    if (!cookieValue || !cookieValue.includes(".")) return null;
    const parts = cookieValue.split(".");
    if (parts.length !== 2) return null;

    const [payload, signature] = parts;
    if (!payload || !signature) return null;

    const expectedSignature = crypto
      .createHmac("sha256", env.SESSION_SECRET)
      .update(payload)
      .digest("base64url");

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSignature);

    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

    const json = Buffer.from(payload, "base64url").toString("utf-8");
    return JSON.parse(json) as SessionUser;
  } catch {
    return null;
  }
}

/**
 * Retrieves the current session user on server components and server actions.
 * Revalidates the user and their role against the database to prevent stale permissions.
 * Falls back to demo owner ONLY when in development/test or ENABLE_DEMO_AUTH is true.
 */
export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);

  if (sessionCookie?.value) {
    const session = decodeSession(sessionCookie.value);
    if (session?.userId) {
      // Re-validate against database to ensure freshness (role revocations, active org, deletions)
      const dbUser = await rawPrisma.user.findUnique({
        where: { id: session.userId },
        include: {
          employee: {
            select: { firstName: true, lastName: true },
          },
          client: {
            select: { name: true },
          },
        },
      });

      if (dbUser) {
        const name = dbUser.employee
          ? `${dbUser.employee.firstName} ${dbUser.employee.lastName}`
          : dbUser.client
          ? `Client (${dbUser.client.name})`
          : dbUser.email;

        return {
          userId: dbUser.id,
          organizationId: dbUser.organizationId,
          role: dbUser.role,
          employeeId: dbUser.employeeId,
          clientId: dbUser.clientId,
          email: dbUser.email,
          name,
        };
      }
    }
  }

  // Fallback: gated strictly to non-production or when demo auth is explicitly enabled
  const isDemoAuthEnabled =
    process.env.NODE_ENV !== "production" || process.env.ENABLE_DEMO_AUTH === "true";

  if (isDemoAuthEnabled) {
    const fallbackUser = await rawPrisma.user.findFirst({
      where: { role: Role.OWNER },
      include: {
        employee: true,
        organization: true,
      },
      orderBy: { createdAt: "asc" },
    });

    if (fallbackUser) {
      return {
        userId: fallbackUser.id,
        organizationId: fallbackUser.organizationId,
        role: fallbackUser.role,
        employeeId: fallbackUser.employeeId,
        clientId: fallbackUser.clientId,
        email: fallbackUser.email,
        name: fallbackUser.employee
          ? `${fallbackUser.employee.firstName} ${fallbackUser.employee.lastName}`
          : "Demo Owner",
      };
    }
  }

  return null;
}

/**
 * Sets the active session cookie for the user.
 */
export async function setSessionUser(user: SessionUser) {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, encodeSession(user), {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

/**
 * Clears the session cookie.
 */
export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}
