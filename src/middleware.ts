import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "workwell_session";
const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  "workwell-ultra-secure-development-session-secret-key-32-chars-min";

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function verifyHmac(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyData,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const sigArrayBuffer = await crypto.subtle.sign("HMAC", cryptoKey, encoder.encode(payload));
    const expectedSig = base64UrlEncode(new Uint8Array(sigArrayBuffer));
    return signature === expectedSig;
  } catch {
    return false;
  }
}

interface DecodedSession {
  userId: string;
  organizationId: string;
  role: string;
  employeeId?: string | null;
  clientId?: string | null;
  email: string;
  name: string;
}

function parseSessionPayload(payloadBase64Url: string): DecodedSession | null {
  try {
    const base64 = payloadBase64Url.replace(/-/g, "+").replace(/_/g, "/");
    const json = atob(base64);
    return JSON.parse(json) as DecodedSession;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Ignore static assets, next internal paths, health checks, and scheduled cron jobs
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/api/cron") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  let session: DecodedSession | null = null;

  if (cookie && cookie.includes(".")) {
    const parts = cookie.split(".");
    if (parts.length === 2) {
      const [payload, signature] = parts;
      const isValid = await verifyHmac(payload, signature, SESSION_SECRET);
      if (isValid) {
        session = parseSessionPayload(payload);
      }
    }
  }

  const isDemoAllowed =
    process.env.NODE_ENV !== "production" || process.env.ENABLE_DEMO_AUTH === "true";

  // Production check: reject unauthenticated traffic when demo fallback is disabled
  if (!session && !isDemoAllowed) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    // Redirect unauthenticated visitors to login or home
    if (pathname !== "/") {
      return NextResponse.redirect(new URL("/", req.url));
    }
  }

  // Role-based route scoping if session is resolved
  if (session) {
    const isClient = session.role === "CLIENT";

    // 1. External clients must only access /portal and allowed storage/download endpoints
    if (isClient) {
      const allowedForClient =
        pathname === "/portal" ||
        pathname.startsWith("/api/storage/download") ||
        pathname === "/";
      if (!allowedForClient) {
        return NextResponse.redirect(new URL("/portal", req.url));
      }
    }

    // 2. Internal employees/managers should not access the client portal (only OWNER can preview)
    if (!isClient && pathname === "/portal" && session.role !== "OWNER") {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    // Attach verified session headers for downstream consumption
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-user-id", session.userId);
    requestHeaders.set("x-user-role", session.role);
    requestHeaders.set("x-org-id", session.organizationId);

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
