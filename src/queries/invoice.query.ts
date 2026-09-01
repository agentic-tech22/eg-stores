import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/server";
import type { BusinessProfileRow, InvoiceRow } from "@/types/invoice.types";

/**
 * Invoice and business-profile reads use the service-role client because these
 * tables have no public RLS read policy. Callers in the service layer gate
 * access with the relevant `requirePermission(...)`.
 */

const INVOICE_SELECT = "*, invoice_items(*)";

export async function getInvoices(): Promise<InvoiceRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch invoices:", error.message);
    return [];
  }
  return (data ?? []) as InvoiceRow[];
}

export async function getInvoiceById(id: string): Promise<InvoiceRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as InvoiceRow;
}

export async function getInvoiceBySaleId(
  saleId: string,
): Promise<InvoiceRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("invoices")
    .select(INVOICE_SELECT)
    .eq("sale_id", saleId)
    .maybeSingle();

  if (error || !data) return null;
  return data as InvoiceRow;
}

/**
 * The single business_profile row, memoized for the duration of one request.
 *
 * Several things read it independently on the same render: the invoice header
 * via `fetchBusinessProfile`, the currency via `getActiveCurrency`, and the
 * loyalty config on a POS sale. Without this the print route alone hit the row
 * twice. `cache()` collapses those into one query per request; it does NOT
 * cache across requests, so a settings save is visible on the very next one
 * with no invalidation to get wrong.
 */
export const getBusinessProfile = cache(
  async (): Promise<BusinessProfileRow | null> => {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("business_profile")
      .select("*")
      .eq("id", true)
      .maybeSingle();

    if (error || !data) return null;
    return data as BusinessProfileRow;
  },
);
