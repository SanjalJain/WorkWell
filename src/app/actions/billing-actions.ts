"use server";

import { getSessionUser } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import {
  generateInvoiceFromTime,
  updateInvoiceStatus,
  generateInvoicePdf,
} from "@/modules/work/billing-service";
import { GenerateInvoiceSchema, UpdateInvoiceStatusSchema } from "@/modules/work/billing-schema";

export async function generateInvoiceAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const raw = {
    projectId: formData.get("projectId") as string,
    startDate: formData.get("startDate") as string,
    endDate: formData.get("endDate") as string,
    dueDate: formData.get("dueDate") as string,
    defaultRate: formData.get("defaultRate")
      ? parseFloat(formData.get("defaultRate") as string)
      : 150,
  };

  const parsed = GenerateInvoiceSchema.parse(raw);
  const invoice = await generateInvoiceFromTime(parsed, user);

  revalidatePath("/billing");
  revalidatePath("/portal");
  return { success: true, invoiceNumber: invoice.invoiceNumber };
}

export async function updateInvoiceStatusAction(invoiceId: string, status: any) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const parsed = UpdateInvoiceStatusSchema.parse({ invoiceId, status });
  await updateInvoiceStatus(parsed.invoiceId, parsed.status, user);

  revalidatePath("/billing");
  revalidatePath("/portal");
  return { success: true };
}

export async function downloadInvoicePdfAction(invoiceId: string) {
  const user = await getSessionUser();
  if (!user) throw new Error("Unauthorized");

  const url = await generateInvoicePdf(invoiceId, user);
  return { success: true, url };
}
