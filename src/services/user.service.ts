"use server";

import { createAdminClient } from "@/lib/supabase/server";
import {
  isSuperAdminEmail,
  requireAdmin,
} from "@/lib/auth/session";
import {
  sanitizePermissions,
  type PermissionId,
  type Role,
} from "@/lib/auth/permissions";
import type { ManagedUser, ProfileRow } from "@/types/user.types";

type Result = { success: boolean; error?: string };

function authError(err: unknown): Result {
  return {
    success: false,
    error: err instanceof Error ? err.message : "Not authorized.",
  };
}

/** List every account with its role/permissions. Admin only. */
export async function listUsers(): Promise<ManagedUser[]> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: authData, error } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (error) throw new Error(error.message);

  const { data: profileRows } = await admin.from("profiles").select("*");
  const profiles = new Map<string, ProfileRow>(
    ((profileRows as ProfileRow[]) ?? []).map((p) => [p.id, p]),
  );

  return authData.users
    .map((u): ManagedUser => {
      const profile = profiles.get(u.id);
      const isSuper = isSuperAdminEmail(u.email);
      const role: Role = isSuper ? "admin" : (profile?.role ?? "member");
      return {
        id: u.id,
        email: u.email ?? "(no email)",
        role,
        permissions: sanitizePermissions(profile?.permissions),
        defaultWarehouseId: profile?.default_warehouse_id ?? null,
        // Super admins are always active; missing profiles/columns default to
        // active so a not-yet-migrated DB reads as active rather than locked.
        isActive: isSuper ? true : profile?.is_active !== false,
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        isSuperAdmin: isSuper,
      };
    })
    .sort((a, b) => a.email.localeCompare(b.email));
}

/** Fetch a single account (auth + profile) for the detail page. Admin only. */
export async function getManagedUser(
  userId: string,
): Promise<ManagedUser | null> {
  await requireAdmin();
  const admin = createAdminClient();

  const { data: authData, error } = await admin.auth.admin.getUserById(userId);
  if (error || !authData?.user) return null;
  const u = authData.user;

  const { data: profileData } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  const profile = (profileData as ProfileRow | null) ?? undefined;

  const isSuper = isSuperAdminEmail(u.email);
  const role: Role = isSuper ? "admin" : (profile?.role ?? "member");
  return {
    id: u.id,
    email: u.email ?? "(no email)",
    role,
    permissions: sanitizePermissions(profile?.permissions),
    defaultWarehouseId: profile?.default_warehouse_id ?? null,
    isActive: isSuper ? true : profile?.is_active !== false,
    createdAt: u.created_at,
    lastSignInAt: u.last_sign_in_at ?? null,
    isSuperAdmin: isSuper,
  };
}

/** Create an account and its profile. Admin only. */
export async function inviteUser(input: {
  email: string;
  password: string;
  role: Role;
  permissions: PermissionId[];
}): Promise<Result> {
  let admin: ReturnType<typeof createAdminClient>;
  try {
    await requireAdmin();
    admin = createAdminClient();
  } catch (err) {
    return authError(err);
  }

  const email = input.email.trim().toLowerCase();
  if (!email || !input.password) {
    return { success: false, error: "Email and password are required." };
  }
  if (input.password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters." };
  }

  const role: Role = isSuperAdminEmail(email) ? "admin" : input.role;
  const permissions = role === "admin" ? [] : sanitizePermissions(input.permissions);

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
  });
  if (error) return { success: false, error: error.message };

  const { error: profileError } = await admin.from("profiles").insert({
    id: data.user.id,
    email,
    role,
    permissions,
  });
  if (profileError) {
    // Roll back the auth account so we don't leave an orphan with no profile.
    await admin.auth.admin.deleteUser(data.user.id);
    return { success: false, error: profileError.message };
  }

  return { success: true };
}

/** Replace a member's granted permissions. Admin only. */
export async function updateUserPermissions(
  userId: string,
  permissions: PermissionId[],
): Promise<Result> {
  try {
    await requireAdmin();
  } catch (err) {
    return authError(err);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      permissions: sanitizePermissions(permissions),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Set a member's default POS warehouse (null clears it). Admin only. */
export async function updateUserDefaultWarehouse(
  userId: string,
  warehouseId: string | null,
): Promise<Result> {
  try {
    await requireAdmin();
  } catch (err) {
    return authError(err);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({
      default_warehouse_id: warehouseId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Change a user's role. Admin only. Super admins cannot be demoted. */
export async function updateUserRole(
  userId: string,
  role: Role,
): Promise<Result> {
  try {
    await requireAdmin();
  } catch (err) {
    return authError(err);
  }

  const admin = createAdminClient();

  const { data } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (data && isSuperAdminEmail((data as { email: string }).email) && role !== "admin") {
    return { success: false, error: "A super admin cannot be demoted." };
  }

  const { error } = await admin
    .from("profiles")
    .update({ role, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/**
 * Activate or deactivate an account. Admin only. A deactivated user cannot sign
 * in and every server action is denied (enforced in signIn + requireAuth + the
 * admin layout). Super admins cannot be deactivated, and you cannot deactivate
 * your own account.
 */
export async function setUserActive(
  userId: string,
  isActive: boolean,
): Promise<Result> {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (err) {
    return authError(err);
  }

  if (userId === ctx.userId && !isActive) {
    return { success: false, error: "You cannot deactivate your own account." };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (
    data &&
    isSuperAdminEmail((data as { email: string }).email) &&
    !isActive
  ) {
    return { success: false, error: "A super admin cannot be deactivated." };
  }

  const { error } = await admin
    .from("profiles")
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Permanently delete an account (profile cascades). Admin only. */
export async function deleteUser(userId: string): Promise<Result> {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (err) {
    return authError(err);
  }

  if (userId === ctx.userId) {
    return { success: false, error: "You cannot delete your own account." };
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  if (data && isSuperAdminEmail((data as { email: string }).email)) {
    return { success: false, error: "A super admin cannot be deleted." };
  }

  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
