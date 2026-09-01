import { createAdminClient } from "@/lib/supabase/server";
import type { AppSubscriptionRow } from "@/types/subscription.types";

/**
 * The `app_subscription` table has no public RLS policy, so reads use the
 * service-role client. There is a single row (id = TRUE).
 */
export async function getAppSubscription(): Promise<AppSubscriptionRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("app_subscription")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch app subscription:", error.message);
    return null;
  }
  return data as AppSubscriptionRow | null;
}
