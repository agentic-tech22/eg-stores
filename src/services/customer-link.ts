/**
 * Server-side helpers that link POS sales to the customer directory and award
 * loyalty points. NOT a "use server" module: these take the caller's Supabase
 * (admin) client so they run inside the sale-persistence path, and so they are
 * never exposed as callable server actions. Loyalty is non-critical: callers
 * wrap these so a failure here never fails the underlying sale.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { getBusinessProfile } from "@/queries/invoice.query";
import { computeEarnedPoints } from "@/services/customer-engine";

type SupabaseClient = ReturnType<typeof createAdminClient>;

type Actor = { userId: string; email: string };

/**
 * Find-or-create a customer by phone. Returns the customer id, or null when no
 * phone is given. On an existing match the name is filled in only if it was
 * previously empty: a returning customer's saved name is never overwritten,
 * and created_by/created_at are preserved.
 */
export async function upsertCustomerByPhone(
  supabase: SupabaseClient,
  input: { phone: string | null | undefined; name: string | null | undefined },
  actor: Actor,
): Promise<string | null> {
  const phone = input.phone?.trim();
  if (!phone) return null;
  const name = input.name?.trim() || null;

  const { data: existing } = await supabase
    .from("customers")
    .select("id, name")
    .eq("phone", phone)
    .maybeSingle();

  if (existing) {
    const row = existing as { id: string; name: string | null };
    if (!row.name && name) {
      await supabase
        .from("customers")
        .update({ name, updated_at: new Date().toISOString() })
        .eq("id", row.id);
    }
    return row.id;
  }

  const { data: inserted, error } = await supabase
    .from("customers")
    .insert({
      phone,
      name,
      created_by: actor.userId,
      created_by_email: actor.email,
    })
    .select("id")
    .single();

  if (error || !inserted) {
    // Likely a concurrent insert won the unique(phone) race, so re-select it.
    const { data: retry } = await supabase
      .from("customers")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    return (retry as { id: string } | null)?.id ?? null;
  }
  return (inserted as { id: string }).id;
}

/**
 * Award loyalty points for a completed sale, per the current program config.
 * No-op when loyalty is disabled or the rule yields zero. One earn row per sale
 * (deduped by the caller reversing before re-award), tied to `saleId` so it is
 * reversible when the sale is edited or deleted.
 */
export async function awardSalePoints(
  supabase: SupabaseClient,
  input: { customerId: string; saleId: string; total: number; txnDate: string },
  actor: Actor,
): Promise<void> {
  const row = await getBusinessProfile();
  const profile = row
    ? {
        loyaltyEnabled: row.loyalty_enabled,
        loyaltyEarnMode: row.loyalty_earn_mode,
        loyaltyEarnRate: row.loyalty_earn_rate,
      }
    : null;
  const points = computeEarnedPoints(profile, input.total);
  if (points <= 0) return;

  await supabase.from("loyalty_transactions").insert({
    customer_id: input.customerId,
    type: "earn",
    points,
    txn_date: input.txnDate,
    sale_id: input.saleId,
    note: "Auto-earned from sale",
    created_by: actor.userId,
    created_by_email: actor.email,
  });
}

/** Remove the auto-earned points tied to a sale (used on sale edit/delete). */
export async function reverseSalePoints(
  supabase: SupabaseClient,
  saleId: string,
): Promise<void> {
  await supabase
    .from("loyalty_transactions")
    .delete()
    .eq("sale_id", saleId)
    .eq("type", "earn");
}
