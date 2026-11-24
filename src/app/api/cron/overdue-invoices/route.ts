import { NextRequest, NextResponse } from "next/server";
import { checkOverdueInvoices } from "@/modules/work/billing-service";

export async function POST(req: NextRequest) {
  // Optional cron secret authorization
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const updatedCount = await checkOverdueInvoices();
    return NextResponse.json({ success: true, updatedCount });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to process overdue invoices" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
