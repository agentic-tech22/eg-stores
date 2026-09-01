"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { getAppSubscription } from "@/queries/subscription.query";
import {
  createSuperManagerSession,
  destroySuperManagerSession,
  isSuperManagerAuthed,
  isValidPinShape,
  pinMatches,
  superManagerPin,
} from "@/lib/super-manager/auth";
import type { AppSubscription } from "@/types/subscription.types";

/** Guard: every super-manager action requires a valid PIN session. */
async function requireSuperManager(): Promise<void> {
  if (!(await isSuperManagerAuthed())) {
    throw new Error("Not authorized.");
  }
}

/**
 * Verify the PIN and, on success, open a super-manager session (sets the
 * httpOnly cookie). Returns a generic error on mismatch so the response can't be
 * used to probe the PIN.
 */
export async function unlockSuperManager(
  pin: string,
): Promise<{ success: boolean; error?: string }> {
  if (!superManagerPin()) {
    return { success: false, error: "Access is not configured." };
  }
  if (!isValidPinShape(pin)) {
    return { success: false, error: "Enter the 4-digit PIN." };
  }
  if (!pinMatches(pin)) {
    return { success: false, error: "Incorrect PIN." };
  }
  await createSuperManagerSession();
  return { success: true };
}

/** End the super-manager session. */
export async function lockSuperManager(): Promise<void> {
  await destroySuperManagerSession();
}

/** Current subscription settings, for the panel. PIN-gated. */
export async function getSuperManagerSubscription(): Promise<AppSubscription> {
  await requireSuperManager();
  const row = await getAppSubscription();
  return {
    expiresAt: row?.expires_at ?? null,
    disabled: row?.disabled ?? false,
    lockedMessage: row?.locked_message ?? null,
    updatedAt: row?.updated_at ?? new Date().toISOString(),
  };
}

/**
 * Update the subscription settings from the panel. PIN-gated. An empty/blank
 * `expiresAt` clears the expiry (no expiry). The date string is an ISO instant.
 */
export async function updateSubscription(input: {
  expiresAt: string | null;
  disabled: boolean;
  lockedMessage: string | null;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requireSuperManager();

    let expiresAt: string | null = null;
    if (input.expiresAt && input.expiresAt.trim()) {
      const parsed = new Date(input.expiresAt);
      if (Number.isNaN(parsed.getTime())) {
        return { success: false, error: "Invalid date." };
      }
      expiresAt = parsed.toISOString();
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from("app_subscription").upsert(
      {
        id: true,
        expires_at: expiresAt,
        disabled: input.disabled,
        locked_message: input.lockedMessage?.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );

    return error ? { success: false, error: error.message } : { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
