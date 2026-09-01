"use client";

import { useState } from "react";
import {
  Ban,
  FolderOpen,
  RotateCcw,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users as UsersIcon,
} from "lucide-react";
import {
  DEFAULT_MEMBER_PERMISSIONS,
  groupedPermissions,
  type PermissionId,
  type Role,
} from "@/lib/auth/permissions";
import { useUsers } from "@/hooks/users/use-users";
import {
  useDeleteUser,
  useInviteUser,
  useSaveUser,
  useSetUserActive,
} from "@/hooks/users/use-user-mutations";
import { useWarehouses } from "@/hooks/warehouses/use-warehouses";
import { useConfirm } from "@/components/molecules/confirm-dialog/confirm-context";
import {
  ActionMenu,
  type ActionMenuItem,
} from "@/components/molecules/action-menu/ActionMenu";
import { Modal } from "@/components/molecules/modal/Modal";
import { PageHeader, Pagination, RowLink, StatCard } from "@/components/molecules/admin";
import { Checkbox, Field, Select, TextInput } from "@/components/molecules/form";
import { notify } from "@/lib/toast";
import type { ManagedUser } from "@/types/user.types";
import { cn } from "@/utils/cn";

const groups = groupedPermissions();

const ITEMS_PER_PAGE = 8;

function randomPassword() {
  // 16 url-safe chars, plenty for an invite temp password.
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"[b % 56])
    .join("");
}

function toggle(list: PermissionId[], id: PermissionId): PermissionId[] {
  return list.includes(id) ? list.filter((p) => p !== id) : [...list, id];
}

interface UserManagerProps {
  initialUsers: ManagedUser[];
  currentUserId: string;
}

export function UserManager({ initialUsers, currentUserId }: UserManagerProps) {
  const { data: users } = useUsers(initialUsers);

  const inviteUserMutation = useInviteUser();
  const deleteUserMutation = useDeleteUser();
  const saveUser = useSaveUser();
  const setUserActiveMutation = useSetUserActive();
  const confirm = useConfirm();

  const [showInvite, setShowInvite] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingId, setEditingId] = useState<string | null>(null);
  const editingUser = users.find((u) => u.id === editingId) ?? null;

  // Invite form state
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [inviteRole, setInviteRole] = useState<Role>("member");
  const [invitePerms, setInvitePerms] = useState<PermissionId[]>(
    DEFAULT_MEMBER_PERMISSIONS,
  );

  function resetInvite() {
    setEmail("");
    setPassword("");
    setInviteRole("member");
    setInvitePerms(DEFAULT_MEMBER_PERMISSIONS);
  }

  // Generate the temp password lazily when the modal opens (client-side only,
  // so there is no server/client hydration mismatch on the controlled input).
  function openInvite() {
    setPassword(randomPassword());
    setShowInvite(true);
  }

  function handleInvite() {
    if (!email.trim() || password.length < 8) {
      notify.error("Valid email and an 8+ character password are required.");
      return;
    }
    inviteUserMutation.mutate(
      {
        email: email.trim(),
        password,
        role: inviteRole,
        permissions: invitePerms,
      },
      {
        onSuccess: () => {
          setShowInvite(false);
          resetInvite();
          notify.success("User invited.");
        },
      },
    );
  }

  async function handleDelete(user: ManagedUser) {
    const ok = await confirm({
      title: "Delete user",
      description: (
        <>
          Delete <span className="font-semibold text-admin-text">{user.email}</span>?
          This permanently removes their account.
        </>
      ),
      confirmLabel: "Delete user",
      destructive: true,
    });
    if (!ok) return;
    deleteUserMutation.mutate(user.id, {
      onSuccess: () => notify.success("User deleted."),
    });
  }

  async function handleToggleActive(user: ManagedUser) {
    const deactivating = user.isActive;
    if (deactivating) {
      const ok = await confirm({
        title: "Deactivate user",
        description: (
          <>
            Deactivate{" "}
            <span className="font-semibold text-admin-text">{user.email}</span>?
            They will be signed out and blocked from logging in or performing any
            action until reactivated.
          </>
        ),
        confirmLabel: "Deactivate user",
        destructive: true,
      });
      if (!ok) return;
    }
    setUserActiveMutation.mutate(
      { id: user.id, isActive: !user.isActive },
      {
        onSuccess: () =>
          notify.success(deactivating ? "User deactivated." : "User reactivated."),
      },
    );
  }

  const adminCount = users.filter((u) => u.role === "admin").length;

  const totalPages = Math.max(1, Math.ceil(users.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = users.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  return (
    <div>
      <PageHeader
        eyebrow="Team"
        title="Users"
        description="Invite teammates and control exactly what each member can do."
        actions={
          <button
            type="button"
            onClick={openInvite}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-admin-accent-hover"
          >
            <UserPlus className="h-4 w-4" strokeWidth={2.5} />
            Invite User
          </button>
        }
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4">
        <StatCard label="Total Users" value={users.length} icon={UsersIcon} tone="indigo" />
        <StatCard
          label="Admins"
          value={adminCount}
          icon={ShieldCheck}
          hint={`${users.length - adminCount} member${users.length - adminCount === 1 ? "" : "s"}`}
        />
      </div>

      {/* User list */}
      <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
        <div className="hidden border-b border-admin-border bg-admin-card/40 px-5 py-3 sm:grid sm:grid-cols-12 sm:gap-4">
          <p className="col-span-1 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">S.N</p>
          <p className="col-span-4 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">User</p>
          <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Role</p>
          <p className="col-span-1 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Access</p>
          <p className="col-span-1 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Status</p>
          <p className="col-span-3 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Actions</p>
        </div>

        <div className="divide-y divide-admin-border">
          {paginated.map((user, i) => {
            const isSelf = user.id === currentUserId;
            const initial = user.email.trim().charAt(0).toUpperCase() || "?";
            return (
              <div
                key={user.id}
                className={cn(
                  "grid grid-cols-1 gap-3 px-5 py-3.5 transition-colors hover:bg-admin-card/30 sm:grid-cols-12 sm:items-center sm:gap-4",
                  !user.isActive && "opacity-60",
                )}
              >
                <div className="col-span-1 text-sm font-bold text-admin-text-muted">
                  {(safePage - 1) * ITEMS_PER_PAGE + i + 1}
                </div>
                {/* Avatar + email open the user's personnel file */}
                <RowLink
                  href={`/dashboard/users/${user.id}`}
                  label={`View ${user.email}`}
                  className="col-span-4"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-admin-accent/10 text-sm font-bold text-admin-accent">
                    {initial}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-admin-text transition-colors group-hover:text-admin-accent">
                      {user.email}
                      {isSelf && <span className="ml-2 text-[11px] font-normal text-admin-text-muted">(you)</span>}
                    </p>
                    {user.isSuperAdmin && (
                      <span className="text-[11px] text-admin-accent">Super admin</span>
                    )}
                  </div>
                </RowLink>
                <div className="col-span-2">
                  <span className={cn(
                    "inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]",
                    user.role === "admin" ? "bg-admin-accent/15 text-admin-accent" : "bg-admin-card text-admin-text-secondary",
                  )}>
                    {user.role}
                  </span>
                </div>
                <div className="col-span-1">
                  <span className="text-xs text-admin-text-secondary">
                    {user.role === "admin" ? "Everything" : `${user.permissions.length} permission${user.permissions.length === 1 ? "" : "s"}`}
                  </span>
                </div>
                <div className="col-span-1">
                  <span className={cn(
                    "inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.1em]",
                    user.isActive ? "bg-admin-success/15 text-admin-success" : "bg-admin-danger/15 text-admin-danger",
                  )}>
                    {user.isActive ? "Active" : "Off"}
                  </span>
                </div>
                <div className="col-span-3 flex items-center justify-end gap-1">
                  <ActionMenu
                    label={`Actions for ${user.email}`}
                    items={[
                      {
                        key: "file",
                        label: "Open personnel file",
                        icon: FolderOpen,
                        href: `/dashboard/users/${user.id}`,
                        title: "Documents, salary, notes",
                      },
                      {
                        key: "manage",
                        label: "Manage access",
                        icon: ShieldCheck,
                        onSelect: () => setEditingId(user.id),
                      },
                      {
                        key: "active",
                        label: user.isActive ? "Deactivate user" : "Reactivate user",
                        icon: user.isActive ? Ban : RotateCcw,
                        onSelect: () => handleToggleActive(user),
                        disabled: setUserActiveMutation.isPending || isSelf || user.isSuperAdmin,
                        title: user.isSuperAdmin
                          ? "Super admins cannot be deactivated"
                          : isSelf
                            ? "You cannot deactivate yourself"
                            : undefined,
                      },
                      {
                        key: "delete",
                        label: "Delete user",
                        icon: Trash2,
                        onSelect: () => handleDelete(user),
                        disabled: deleteUserMutation.isPending || isSelf || user.isSuperAdmin,
                        destructive: true,
                        title: user.isSuperAdmin
                          ? "Super admins cannot be deleted"
                          : isSelf
                            ? "You cannot delete yourself"
                            : undefined,
                      },
                    ] satisfies ActionMenuItem[]}
                  />
                </div>
              </div>
            );
          })}
        </div>

        <Pagination
          page={safePage}
          totalPages={totalPages}
          totalItems={users.length}
          pageSize={ITEMS_PER_PAGE}
          itemLabel="users"
          onPageChange={setCurrentPage}
        />
      </div>

      {/* Invite modal */}
      <Modal
        open={showInvite}
        onOpenChange={setShowInvite}
        size="lg"
        title="Invite a new user"
        description="They sign in with the temporary password you share."
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowInvite(false)}
              className="rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-text-secondary transition-colors hover:bg-admin-card"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleInvite}
              disabled={inviteUserMutation.isPending}
              className="rounded-xl bg-admin-accent px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover disabled:opacity-40"
            >
              {inviteUserMutation.isPending ? "Creating..." : "Create User"}
            </button>
          </>
        }
      >
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email" required>
              {(p) => (
                <TextInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="teammate@example.com"
                  {...p}
                />
              )}
            </Field>
            <Field
              label="Temporary password"
              hint="Share this with the user; they sign in with it."
            >
              {(p) => (
                <div className="flex gap-2">
                  <TextInput
                    type="text"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    {...p}
                  />
                  <button
                    type="button"
                    onClick={() => setPassword(randomPassword())}
                    className="shrink-0 rounded-xl border border-admin-border px-3 text-xs font-bold text-admin-text-secondary hover:bg-admin-card"
                  >
                    Regenerate
                  </button>
                </div>
              )}
            </Field>
            <Field label="Role" className="sm:col-span-2 sm:max-w-xs">
              {(p) => (
                <Select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as Role)}
                  {...p}
                >
                  <option value="member">Member (specific permissions)</option>
                  <option value="admin">Admin (full access)</option>
                </Select>
              )}
            </Field>
          </div>

          {inviteRole === "member" ? (
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-admin-text-muted">
                Permissions
              </p>
              <PermissionPicker
                selected={invitePerms}
                onToggle={(id) => setInvitePerms((prev) => toggle(prev, id))}
              />
            </div>
          ) : (
            <p className="rounded-lg bg-admin-accent/10 px-3 py-2 text-xs text-admin-accent">
              Admins have full access to everything, including user management.
            </p>
          )}
        </div>
      </Modal>

      {/* Manage modal */}
      {editingUser && (
        <UserEditor
          key={editingUser.id}
          user={editingUser}
          isPending={saveUser.isPending}
          onClose={() => setEditingId(null)}
          onSave={(role, permissions, defaultWarehouseId) => {
            saveUser.mutate(
              {
                id: editingUser.id,
                role,
                currentRole: editingUser.role,
                permissions,
                defaultWarehouseId,
              },
              {
                onSuccess: () => {
                  setEditingId(null);
                  notify.success("Changes saved.");
                },
              },
            );
          }}
        />
      )}
    </div>
  );
}

// ===== Editor modal for a single user =====
function UserEditor({
  user,
  isPending,
  onClose,
  onSave,
}: {
  user: ManagedUser;
  isPending: boolean;
  onClose: () => void;
  onSave: (
    role: Role,
    permissions: PermissionId[],
    defaultWarehouseId: string | null,
  ) => void;
}) {
  const [role, setRole] = useState<Role>(user.role);
  const [perms, setPerms] = useState<PermissionId[]>(user.permissions);
  const [defaultWarehouseId, setDefaultWarehouseId] = useState<string>(
    user.defaultWarehouseId ?? "",
  );
  const { data: warehouses = [] } = useWarehouses();
  const activeWarehouses = warehouses.filter((w) => w.isActive);

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="lg"
      title={`Manage ${user.email}`}
      description="Change this user's role and permissions."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-text-secondary transition-colors hover:bg-admin-card"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() =>
              onSave(role, perms, defaultWarehouseId || null)
            }
            disabled={isPending}
            className="rounded-xl bg-admin-accent px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover disabled:opacity-40"
          >
            {isPending ? "Saving..." : "Save changes"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <Field
          label="Role"
          className="sm:max-w-xs"
          hint={user.isSuperAdmin ? "Super admins are always admin." : undefined}
        >
          {(p) => (
            <Select
              value={role}
              onChange={(e) => setRole(e.target.value as Role)}
              disabled={user.isSuperAdmin}
              {...p}
            >
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </Select>
          )}
        </Field>

        <Field
          label="Default warehouse (POS)"
          className="sm:max-w-xs"
          hint="Prefilled on this user's Point of Sale screen. They can still switch."
        >
          {(p) => (
            <Select
              value={defaultWarehouseId}
              onChange={(e) => setDefaultWarehouseId(e.target.value)}
              {...p}
            >
              <option value="">No default (use shop default)</option>
              {activeWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.isDefault ? " (shop default)" : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {role === "member" ? (
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.1em] text-admin-text-muted">
              Permissions
            </p>
            <PermissionPicker
              selected={perms}
              onToggle={(id) => setPerms((prev) => toggle(prev, id))}
            />
          </div>
        ) : (
          <p className="rounded-lg bg-admin-accent/10 px-3 py-2 text-xs text-admin-accent">
            Admins have full access. Individual permissions don&apos;t apply.
          </p>
        )}
      </div>
    </Modal>
  );
}

// ===== Grouped permission checkboxes =====
function PermissionPicker({
  selected,
  onToggle,
}: {
  selected: PermissionId[];
  onToggle: (id: PermissionId) => void;
}) {
  return (
    <div className="space-y-4">
      {Object.entries(groups).map(([group, perms]) => (
        <div key={group}>
          <p className="mb-2 text-xs font-bold text-admin-text">{group}</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {perms.map((perm) => (
              <Checkbox
                key={perm.id}
                label={perm.label}
                description={perm.description}
                checked={selected.includes(perm.id)}
                onChange={() => onToggle(perm.id)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
