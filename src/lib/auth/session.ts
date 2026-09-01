import { cache } from "react";
import {
  createAdminClient,
  createServerSupabaseClient,
} from "@/lib/supabase/server";
import type { AuthContext, ProfileRow } from "@/types/user.types";
import {
  DEFAULT_MEMBER_PERMISSIONS,
  sanitizePermissions,
  type PermissionId,
  type Role,
} from "./permissions";

/** Thrown by the `require*` guards when access is denied. Server actions that
 *  wrap their body in try/catch will surface `.message` to the client. */
export class AuthorizationError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "AuthorizationError";
  }
}

/** Emails (lowercased) that are always admin and can never be locked out. */
export function superAdminEmails(): string[] {
  return (process.env.SUPER_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isSuperAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return superAdminEmails().includes(email.toLowerCase());
}

/**
 * Ensure a `profiles` row exists for the signed-in user and reflects their
 * super-admin status. Returns the effective role/permissions. Uses the admin
 * client so it works regardless of RLS. Super admins are always promoted to
 * `admin` and can never be demoted here.
 */
async function ensureProfile(
  userId: string,
  email: string,
): Promise<{
  role: Role;
  permissions: PermissionId[];
  defaultWarehouseId: string | null;
  isActive: boolean;
}> {
  const admin = createAdminClient();
  const isSuper = isSuperAdminEmail(email);

  const { data } = await admin
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  const existing = data as ProfileRow | null;

  if (!existing) {
    const role: Role = isSuper ? "admin" : "member";
    const permissions: PermissionId[] = isSuper
      ? []
      : DEFAULT_MEMBER_PERMISSIONS;
    await admin
      .from("profiles")
      .insert({ id: userId, email, role, permissions });
    return { role, permissions, defaultWarehouseId: null, isActive: true };
  }

  // Keep super admins pinned to admin and keep the stored email fresh.
  const needsPromotion = isSuper && existing.role !== "admin";
  const needsEmailSync = existing.email !== email;
  if (needsPromotion || needsEmailSync) {
    await admin
      .from("profiles")
      .update({
        ...(needsPromotion ? { role: "admin" as Role } : {}),
        ...(needsEmailSync ? { email } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);
  }

  const role: Role = needsPromotion ? "admin" : existing.role;
  // Super admins can never be locked out, so they are always active regardless
  // of the stored flag. `is_active` may be undefined on rows from a DB not yet
  // migrated, so default missing values to active.
  const isActive = isSuper ? true : existing.is_active !== false;
  return {
    role,
    permissions: sanitizePermissions(existing.permissions),
    defaultWarehouseId: existing.default_warehouse_id ?? null,
    isActive,
  };
}

/**
 * Resolve the full auth context for the current request, or null if not
 * signed in. Memoized per-request via React `cache` so layout + page + actions
 * share a single resolution.
 */
export const getAuthContext = cache(async (): Promise<AuthContext | null> => {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !user.email) return null;

  const { role, permissions, defaultWarehouseId, isActive } =
    await ensureProfile(user.id, user.email);
  const isAdmin = role === "admin";

  return {
    userId: user.id,
    email: user.email,
    role,
    permissions,
    defaultWarehouseId,
    isActive,
    isAdmin,
    isSuperAdmin: isSuperAdminEmail(user.email),
  };
});

/** Admins implicitly hold every permission; members need an explicit grant. */
export function ctxHasPermission(
  ctx: AuthContext | null,
  permission: PermissionId,
): boolean {
  if (!ctx) return false;
  return ctx.isAdmin || ctx.permissions.includes(permission);
}

// ----- Guards for use inside server actions -----

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx) throw new AuthorizationError("You must be signed in.");
  // A deactivated account is denied every action. Because requirePermission and
  // requireAdmin both call this, one check covers every server action.
  if (!ctx.isActive) {
    throw new AuthorizationError("Your account has been deactivated.");
  }
  return ctx;
}

export async function requirePermission(
  permission: PermissionId,
): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!ctxHasPermission(ctx, permission)) throw new AuthorizationError();
  return ctx;
}

export async function requireAdmin(): Promise<AuthContext> {
  const ctx = await requireAuth();
  if (!ctx.isAdmin) {
    throw new AuthorizationError("This action requires an admin account.");
  }
  return ctx;
}
