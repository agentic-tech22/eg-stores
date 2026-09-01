import type { PermissionId, Role } from "@/lib/auth/permissions";

/** A row in the `profiles` table. */
export interface Profile {
  id: string;
  email: string;
  role: Role;
  permissions: PermissionId[];
  /** Per-user default warehouse (prefills the POS sale form); null when unset. */
  defaultWarehouseId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Raw `profiles` row shape as returned by Supabase. */
export interface ProfileRow {
  id: string;
  email: string;
  role: Role;
  permissions: PermissionId[] | null;
  default_warehouse_id: string | null;
  /** Account on/off switch; FALSE = deactivated (cannot sign in or operate). */
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

/** A user as shown in the admin Users page (auth account + profile). */
export interface ManagedUser {
  id: string;
  email: string;
  role: Role;
  permissions: PermissionId[];
  /** The member's default POS warehouse, or null when unset. */
  defaultWarehouseId: string | null;
  /** Whether the account is active; deactivated users cannot sign in or operate. */
  isActive: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  isSuperAdmin: boolean;
}

/** Resolved auth context for the current request. */
export interface AuthContext {
  userId: string;
  email: string;
  role: Role;
  permissions: PermissionId[];
  /** The user's default POS warehouse, or null when unset. */
  defaultWarehouseId: string | null;
  /** Whether the account is active; deactivated users are denied all access. */
  isActive: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}
