import { createAdminClient } from "@/lib/supabase/server";
import type { OrderRow, OrderStatus } from "@/types/order.types";

/**
 * Order reads use the service-role client because `orders`/`order_items` have
 * no public RLS read policy (they are business-wide, not row-scoped). Callers
 * in the service layer gate access with `requirePermission("orders.view")`.
 */

// `converted_sale` is a reverse embed of the sale this order was converted into
// (0 or 1 row, since sales.order_id is UNIQUE).
const ORDER_SELECT = "*, order_items(*), converted_sale:sales(id, sale_number)";

export async function getOrders(): Promise<OrderRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch orders:", error.message);
    return [];
  }
  return (data ?? []) as OrderRow[];
}

export async function getOrderById(id: string): Promise<OrderRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", id)
    .single();

  if (error || !data) return null;
  return data as OrderRow;
}

export async function getOrdersByStatus(
  status: OrderStatus,
): Promise<OrderRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("orders")
    .select(ORDER_SELECT)
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch orders by status:", error.message);
    return [];
  }
  return (data ?? []) as OrderRow[];
}
