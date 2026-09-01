/**
 * Applies an NCM status string to a local order, translating it into the order
 * lifecycle + stock side-effects. Shared by the manual sync action and the
 * webhook route, so it lives outside any "use server" module.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { applyStatusTransition } from "@/services/order-engine";
import { getNcmPhase } from "@/lib/ncm/statusMapping";
import type { OrderRow } from "@/types/order.types";

type SupabaseClient = ReturnType<typeof createAdminClient>;

export async function applyNcmStatus(
  supabase: SupabaseClient,
  order: OrderRow,
  ncmStatus: string,
): Promise<{ error?: string }> {
  const extra = {
    ncm_status: ncmStatus,
    ncm_synced_at: new Date().toISOString(),
  };
  const phase = getNcmPhase(ncmStatus);

  if (phase === "delivered") {
    return applyStatusTransition(supabase, order, "delivered", extra);
  }
  if (phase === "returned" || phase === "failed") {
    return applyStatusTransition(supabase, order, "cancelled", extra);
  }

  // Non-terminal update: record the NCM status without changing order.status.
  const { error } = await supabase
    .from("orders")
    .update({ ...extra, updated_at: new Date().toISOString() })
    .eq("id", order.id);
  return error ? { error: error.message } : {};
}
