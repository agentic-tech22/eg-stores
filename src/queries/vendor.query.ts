import { createAdminClient } from "@/lib/supabase/server";
import type { VendorRow, VendorTransactionRow } from "@/types/vendor.types";

/**
 * Vendor reads use the service-role client because `vendors`/`vendor_transactions`
 * have no public RLS read policy (they hold business-private financials). Callers
 * in the service layer gate access with `requirePermission("vendors.view")`.
 */

export async function getVendors(): Promise<VendorRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to fetch vendors:", error.message);
    return [];
  }
  return (data ?? []) as VendorRow[];
}

export async function getVendorById(id: string): Promise<VendorRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("vendors")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as VendorRow;
}

/** All ledger rows for one vendor, newest first. */
export async function getVendorTransactions(
  vendorId: string,
): Promise<VendorTransactionRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("vendor_transactions")
    .select("*")
    .eq("vendor_id", vendorId)
    .order("txn_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch vendor transactions:", error.message);
    return [];
  }
  return (data ?? []) as VendorTransactionRow[];
}

/** Ledger rows for many vendors at once (feeds the list-page balance rollup). */
export async function getVendorTransactionsForVendors(
  vendorIds: string[],
): Promise<VendorTransactionRow[]> {
  if (vendorIds.length === 0) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("vendor_transactions")
    .select("id, vendor_id, type, amount, status")
    .in("vendor_id", vendorIds);

  if (error) {
    console.error("Failed to fetch vendor transactions:", error.message);
    return [];
  }
  return (data ?? []) as VendorTransactionRow[];
}

/** All bill rows across every vendor (amount + date), for purchase reporting. */
export async function getVendorBills(): Promise<
  Pick<VendorTransactionRow, "vendor_id" | "amount" | "txn_date">[]
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("vendor_transactions")
    .select("vendor_id, amount, txn_date")
    .eq("type", "bill");

  if (error) {
    console.error("Failed to fetch vendor bills:", error.message);
    return [];
  }
  return (data ?? []) as Pick<
    VendorTransactionRow,
    "vendor_id" | "amount" | "txn_date"
  >[];
}
