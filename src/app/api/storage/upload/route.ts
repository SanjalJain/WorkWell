import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { env } from "@/lib/env";

const MAX_UPLOAD_SIZE = 15 * 1024 * 1024; // 15 MB
const ALLOWED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".txt",
];

export async function PUT(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const expires = url.searchParams.get("expires");
  const token = url.searchParams.get("token");

  if (!key || !expires || !token) {
    return NextResponse.json({ error: "Missing required query parameters" }, { status: 400 });
  }

  if (Date.now() > parseInt(expires, 10)) {
    return NextResponse.json({ error: "Upload token has expired" }, { status: 403 });
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

  // Validate file extension against allowlist
  const ext = path.extname(key).toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return NextResponse.json(
      { error: `File type ${ext || "unknown"} is not permitted` },
      { status: 400 }
    );
  }

  const arrayBuffer = await req.arrayBuffer();
  if (arrayBuffer.byteLength > MAX_UPLOAD_SIZE) {
    return NextResponse.json(
      { error: "File exceeds maximum allowed size of 15MB" },
      { status: 413 }
    );
  }

  const buffer = Buffer.from(arrayBuffer);
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buffer);

  return NextResponse.json({ success: true, key });
}
