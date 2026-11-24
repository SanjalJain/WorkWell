import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { env } from "@/lib/env";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const expires = url.searchParams.get("expires");
  const token = url.searchParams.get("token");

  if (!key || !expires || !token) {
    return NextResponse.json({ error: "Missing required query parameters" }, { status: 400 });
  }

  if (Date.now() > parseInt(expires, 10)) {
    return NextResponse.json({ error: "Download link has expired" }, { status: 403 });
  }

  // Validate HMAC using constant-time comparison
  const hmac = crypto.createHmac("sha256", env.SESSION_SECRET);
  hmac.update(`${key}:${expires}`);
  const expectedToken = hmac.digest("hex");

  const tokenBuf = Buffer.from(token);
  const expectedBuf = Buffer.from(expectedToken);
  if (tokenBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(tokenBuf, expectedBuf)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
  }

  // Path containment check (anti-path traversal)
  const baseDir = path.resolve(process.cwd(), env.STORAGE_LOCAL_DIR);
  const filePath = path.resolve(baseDir, key);
  if (!filePath.startsWith(baseDir + path.sep)) {
    return NextResponse.json({ error: "Invalid file key path" }, { status: 403 });
  }

  try {
    const fileBuffer = await fs.readFile(filePath);
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Disposition": `attachment; filename="${path.basename(key)}"`,
        "Content-Type": "application/octet-stream",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
