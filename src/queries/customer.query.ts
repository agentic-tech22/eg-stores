import { createAdminClient } from "@/lib/supabase/server";
import type {
  CustomerRow,
  CustomerSale,
  LoyaltyTransactionRow,
} from "@/types/customer.types";

/**
 * Customer reads use the service-role client because `customers`/
 * `loyalty_transactions` have no public RLS read policy (business-private).
 * Callers in the service layer gate access with `requirePermission("customers.view")`.
 */

export async function getCustomers(): Promise<CustomerRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to fetch customers:", error.message);
    return [];
  }
  return (data ?? []) as CustomerRow[];
}

export async function getCustomerById(id: string): Promise<CustomerRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as CustomerRow;
}

export async function getCustomerByPhone(
  phone: string,
): Promise<CustomerRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("customers")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();

  if (error || !data) return null;
  return data as CustomerRow;
}

/** All loyalty ledger rows for one customer, newest first. */
export async function getLoyaltyTransactions(
  customerId: string,
): Promise<LoyaltyTransactionRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("loyalty_transactions")
    .select("*")
    .eq("customer_id", customerId)
    .order("txn_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch loyalty transactions:", error.message);
    return [];
  }
  return (data ?? []) as LoyaltyTransactionRow[];
}

/** Ledger rows for many customers at once (feeds the list-page balance rollup). */
export async function getLoyaltyTransactionsForCustomers(
  customerIds: string[],
): Promise<Pick<LoyaltyTransactionRow, "id" | "customer_id" | "points">[]> {
  if (customerIds.length === 0) return [];
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("loyalty_transactions")
    .select("id, customer_id, points")
    .in("customer_id", customerIds);

  if (error) {
    console.error("Failed to fetch loyalty transactions:", error.message);
    return [];
  }
  return (data ?? []) as Pick<
    LoyaltyTransactionRow,
    "id" | "customer_id" | "points"
  >[];
}

/** A customer's linked sales (purchase history), newest first. */
export async function getCustomerSales(
  customerId: string,
): Promise<CustomerSale[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("sales")
    .select("id, sale_number, total, sale_date, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch customer sales:", error.message);
    return [];
  }
  return (
    (data ?? []) as {
      id: string;
      sale_number: number;
      total: number;
      sale_date: string;
      created_at: string;
    }[]
  ).map((r) => ({
    id: r.id,
    saleNumber: r.sale_number,
    total: r.total,
    saleDate: r.sale_date,
    createdAt: r.created_at,
  }));
}
