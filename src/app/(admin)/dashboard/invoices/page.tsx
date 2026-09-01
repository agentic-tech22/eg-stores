import { redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import { getActiveCurrency } from "@/lib/currency.server";
import { fetchInvoices } from "@/services/invoice.service";
import type { Invoice } from "@/types/invoice.types";
import { InvoicesManager } from "./InvoicesManager";

export default async function InvoicesPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "invoices.view")) redirect("/dashboard");

  let invoices: Invoice[] = [];
  try {
    invoices = await fetchInvoices();
  } catch {
    // Fall back to empty data on read failure.
  }

  return (
    <InvoicesManager
      initialInvoices={invoices}
      currency={await getActiveCurrency()}
      can={{ manageBusiness: ctxHasPermission(ctx, "settings.business") }}
    />
  );
}
