import { cache } from "react";
import { getAppSubscription } from "@/queries/subscription.query";
import type {
  AppSubscriptionRow,
  SubscriptionStatus,
} from "@/types/subscription.types";

/**
 * Pure: derive the lock state from a row and the current time. The dashboard is
 * locked when the kill-switch is on, or when the expiry date has passed.
 */
export function computeStatus(
  row: AppSubscriptionRow | null,
): SubscriptionStatus {
  if (!row) {
    return { locked: false, reason: null, expiresAt: null, lockedMessage: null };
  }

  const base = {
    expiresAt: row.expires_at,
    lockedMessage: row.locked_message,
  };

  if (row.disabled) {
    return { locked: true, reason: "disabled", ...base };
  }
  if (row.expires_at && new Date(row.expires_at).getTime() <= Date.now()) {
    return { locked: true, reason: "expired", ...base };
  }
  return { locked: false, reason: null, ...base };
}

/**
 * Resolve the dashboard lock state for the current request. Memoized per-request
 * via React `cache` so the layout can call it without an extra DB round-trip.
 */
export const getSubscriptionStatus = cache(
  async (): Promise<SubscriptionStatus> => {
    const row = await getAppSubscription();
    return computeStatus(row);
  },
);
