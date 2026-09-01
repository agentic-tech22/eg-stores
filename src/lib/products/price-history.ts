import type { createAdminClient } from "@/lib/supabase/server";
import type { PriceField } from "@/types/product.types";

type SupabaseClient = ReturnType<typeof createAdminClient>;

interface Actor {
  userId: string;
  email: string;
}

export interface PriceChangeInput {
  field: PriceField;
  oldValue: number | null;
  newValue: number;
}

/**
 * Append price-change rows to the audit ledger. Entries whose value is
 * unchanged are skipped, so callers can pass both fields unconditionally.
 * Best-effort: a logging failure is swallowed (never blocks the price update
 * that already succeeded).
 */
export async function recordPriceChanges(
  supabase: SupabaseClient,
  productId: string,
  changes: PriceChangeInput[],
  actor: Actor,
): Promise<void> {
  const rows = changes
    .filter((c) => c.oldValue !== c.newValue)
    .map((c) => ({
      product_id: productId,
      field: c.field,
      old_value: c.oldValue,
      new_value: c.newValue,
      created_by: actor.userId,
      created_by_email: actor.email,
    }));

  if (rows.length === 0) return;

  const { error } = await supabase.from("product_price_changes").insert(rows);
  if (error) console.error("Failed to log price change:", error.message);
}
