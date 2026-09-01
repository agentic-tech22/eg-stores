"use client";

import { createContext, useContext, useMemo } from "react";
import type { PermissionId } from "@/lib/auth/permissions";

interface PermissionContextValue {
  isAdmin: boolean;
  permissions: PermissionId[];
  /** Mirrors server-side ctxHasPermission: admins implicitly hold every permission. */
  has: (permission: PermissionId) => boolean;
}

const PermissionContext = createContext<PermissionContextValue | null>(null);

/**
 * Seeds the current user's role + grants for client components. Mount it once,
 * high in the admin tree (see AdminShell), so any descendant can call
 * `usePermission` or render a `<PermissionGate>` without prop-drilling `can`
 * flags. This is a UI-convenience layer only: every server action still gates
 * itself with `requirePermission`, which is the real boundary.
 */
export function PermissionProvider({
  isAdmin,
  permissions,
  children,
}: {
  isAdmin: boolean;
  permissions: PermissionId[];
  children: React.ReactNode;
}) {
  const value = useMemo<PermissionContextValue>(() => {
    const granted = new Set(permissions);
    return {
      isAdmin,
      permissions,
      has: (permission) => isAdmin || granted.has(permission),
    };
  }, [isAdmin, permissions]);

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}

/** True when the current user holds `permission` (admins always do). */
export function usePermission(permission: PermissionId): boolean {
  const ctx = useContext(PermissionContext);
  if (!ctx) {
    throw new Error("usePermission must be used within a PermissionProvider");
  }
  return ctx.has(permission);
}

/**
 * Renders `children` only when the current user holds `permission`, otherwise
 * `fallback` (default: nothing). Reusable gate for any permission-scoped UI.
 */
export function PermissionGate({
  permission,
  children,
  fallback = null,
}: {
  permission: PermissionId;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return <>{usePermission(permission) ? children : fallback}</>;
}
