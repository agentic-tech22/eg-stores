import { describe, it, expect, vi } from "vitest";

// Prevent the transitive Supabase/query import chain from loading in a unit env.
vi.mock("@/queries/subscription.query", () => ({ getAppSubscription: vi.fn() }));

import { computeStatus } from "./status";
import type { AppSubscriptionRow } from "@/types/subscription.types";

const row = (over: Partial<AppSubscriptionRow>): AppSubscriptionRow => ({
  id: true,
  expires_at: null,
  disabled: false,
  locked_message: null,
  updated_at: "2026-01-01T00:00:00.000Z",
  ...over,
});

describe("computeStatus: dashboard kill-switch", () => {
  it("is unlocked when there is no subscription row", () => {
    expect(computeStatus(null)).toEqual({
      locked: false,
      reason: null,
      expiresAt: null,
      lockedMessage: null,
    });
  });

  it("locks with reason 'disabled' when the manual kill-switch is on", () => {
    const status = computeStatus(row({ disabled: true, locked_message: "Unpaid" }));
    expect(status.locked).toBe(true);
    expect(status.reason).toBe("disabled");
    expect(status.lockedMessage).toBe("Unpaid");
  });

  it("'disabled' takes precedence even if expiry is still in the future", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const status = computeStatus(row({ disabled: true, expires_at: future }));
    expect(status.reason).toBe("disabled");
  });

  it("locks with reason 'expired' once expires_at has passed", () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    const status = computeStatus(row({ expires_at: past }));
    expect(status.locked).toBe(true);
    expect(status.reason).toBe("expired");
  });

  it("stays unlocked while expires_at is in the future", () => {
    const future = new Date(Date.now() + 60_000).toISOString();
    const status = computeStatus(row({ expires_at: future }));
    expect(status.locked).toBe(false);
    expect(status.reason).toBeNull();
  });

  it("treats the exact expiry instant as expired (<= now)", () => {
    const now = new Date("2026-07-15T00:00:00.000Z");
    vi.useFakeTimers();
    vi.setSystemTime(now);
    try {
      const status = computeStatus(row({ expires_at: now.toISOString() }));
      expect(status.locked).toBe(true);
      expect(status.reason).toBe("expired");
    } finally {
      vi.useRealTimers();
    }
  });
});
