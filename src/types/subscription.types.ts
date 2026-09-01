/** Raw `app_subscription` row (single app-level row, id = TRUE). */
export interface AppSubscriptionRow {
  id: boolean;
  expires_at: string | null;
  disabled: boolean;
  locked_message: string | null;
  updated_at: string;
}

/** App-facing shape of the subscription settings. */
export interface AppSubscription {
  /** ISO timestamp when the subscription ends, or null for no expiry. */
  expiresAt: string | null;
  /** Hard kill-switch: locks the dashboard regardless of the date. */
  disabled: boolean;
  /** Optional custom message shown on the lock screen. */
  lockedMessage: string | null;
  updatedAt: string;
}

/** Resolved lock state derived from the row + the current time. */
export interface SubscriptionStatus {
  locked: boolean;
  /** Why it's locked: manually `disabled`, or past `expired`. Null when active. */
  reason: "disabled" | "expired" | null;
  expiresAt: string | null;
  lockedMessage: string | null;
}
