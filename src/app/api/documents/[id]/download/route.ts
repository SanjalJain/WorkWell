import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDocumentDownloadUrl } from "@/modules/people/document-service";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const url = await getDocumentDownloadUrl(id, user);
    return NextResponse.json({ url });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Failed to generate download URL" },
      { status: 403 }
    );
  }
}
