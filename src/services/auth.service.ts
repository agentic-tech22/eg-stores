"use server";

import { headers } from "next/headers";
import {
  createAdminClient,
  createServerSupabaseClient,
} from "@/lib/supabase/server";
import { isSuperAdminEmail } from "@/lib/auth/session";
import type { ProfileRow } from "@/types/user.types";

export async function signIn(
  email: string,
  password: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { success: false, error: error.message };

    // Block deactivated accounts at the door: undo the session and report it,
    // rather than letting them land on a locked dashboard. Super admins are
    // exempt and can never be locked out.
    const userId = data.user?.id;
    if (userId && !isSuperAdminEmail(data.user?.email)) {
      const admin = createAdminClient();
      const { data: profile } = await admin
        .from("profiles")
        .select("is_active")
        .eq("id", userId)
        .maybeSingle();
      if ((profile as Pick<ProfileRow, "is_active"> | null)?.is_active === false) {
        await supabase.auth.signOut();
        return {
          success: false,
          error: "Your account has been deactivated. Contact your admin.",
        };
      }
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function signOut(): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function requestPasswordReset(
  email: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();

    const hdrs = await headers();
    const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
    const proto = hdrs.get("x-forwarded-proto") ?? "http";
    const origin = `${proto}://${host}`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/reset`,
    });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function updatePassword(
  newPassword: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function getUser() {
  try {
    const supabase = await createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    return user;
  } catch {
    return null;
  }
}
