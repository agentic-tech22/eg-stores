"use client";

import { useState } from "react";
import { Pencil, Plus, Star, Trash2, Warehouse as WarehouseIcon } from "lucide-react";
import {
  useCreateWarehouse,
  useDeleteWarehouse,
  useSetDefaultWarehouse,
  useUpdateWarehouse,
  useWarehouses,
} from "@/hooks/warehouses/use-warehouses";
import { useConfirm } from "@/components/molecules/confirm-dialog/confirm-context";
import {
  ActionMenu,
  type ActionMenuItem,
} from "@/components/molecules/action-menu/ActionMenu";
import { EmptyState, PageHeader } from "@/components/molecules/admin";
import { Modal } from "@/components/molecules/modal/Modal";
import { Checkbox, Field, TextInput } from "@/components/molecules/form";
import { PermissionGate } from "@/components/auth/permission-context";
import { notify } from "@/lib/toast";
import type { Warehouse, WarehouseStockValue } from "@/types/warehouse.types";

interface WarehouseManagerProps {
  initialWarehouses: Warehouse[];
  stockValue: WarehouseStockValue[];
  currency: string;
  can: { create: boolean; edit: boolean; delete: boolean };
}

export function WarehouseManager({
  initialWarehouses,
  stockValue,
  currency,
  can,
}: WarehouseManagerProps) {
  const { data: warehouses = initialWarehouses } = useWarehouses(initialWarehouses);
  const deleteWarehouse = useDeleteWarehouse();
  const setDefault = useSetDefaultWarehouse();
  const confirm = useConfirm();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Warehouse | null>(null);

  const unitsById = new Map(stockValue.map((s) => [s.warehouseId, s]));

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }
  function openEdit(w: Warehouse) {
    setEditing(w);
    setFormOpen(true);
  }

  async function handleDelete(w: Warehouse) {
    const ok = await confirm({
      title: "Delete warehouse",
      description: (
        <>
          Delete{" "}
          <span className="font-semibold text-admin-text">{w.name}</span>? A
          warehouse that holds stock or is referenced by orders/sales cannot be
          deleted. Deactivate it instead.
        </>
      ),
      confirmLabel: "Delete warehouse",
      destructive: true,
    });
    if (!ok) return;
    deleteWarehouse.mutate(w.id, {
      onSuccess: () => notify.success("Warehouse deleted."),
    });
  }

  function handleSetDefault(w: Warehouse) {
    if (w.isDefault) return;
    setDefault.mutate(w.id, {
      onSuccess: () => notify.success(`${w.name} is now the default warehouse.`),
    });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Warehouses"
        description="Stock locations. The same product can be stocked in several warehouses; sales and orders draw from the one they're created against."
        actions={
          can.create && (
            <button
              type="button"
              onClick={openCreate}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-admin-accent-hover"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add Warehouse
            </button>
          )
        }
      />

      {warehouses.length === 0 ? (
        <EmptyState
          icon={WarehouseIcon}
          title="No warehouses yet"
          description="Create your first warehouse to start tracking stock by location."
          action={
            can.create && (
              <button
                type="button"
                onClick={openCreate}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Add Warehouse
              </button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
          <div className="hidden border-b border-admin-border bg-admin-card/40 px-5 py-3 sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
            <p className="col-span-4 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Warehouse</p>
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Code</p>
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">On hand</p>
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Status</p>
            <p className="col-span-2 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Actions</p>
          </div>

          <div className="divide-y divide-admin-border">
            {warehouses.map((w) => {
              const sv = unitsById.get(w.id);
              return (
                <div
                  key={w.id}
                  className="grid grid-cols-1 gap-3 px-5 py-3.5 transition-colors hover:bg-admin-card/30 sm:grid-cols-12 sm:items-center sm:gap-4"
                >
                  <div className="col-span-4 flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-admin-accent/10 text-admin-accent">
                      <WarehouseIcon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="flex items-center gap-2 truncate text-sm font-bold text-admin-text">
                        {w.name}
                        {w.isDefault && (
                          <span className="inline-flex items-center gap-1 rounded-md bg-admin-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-admin-accent">
                            <Star className="h-3 w-3 fill-current" /> Default
                          </span>
                        )}
                      </p>
                      {w.address && (
                        <p className="truncate text-[11px] text-admin-text-muted">{w.address}</p>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 text-sm text-admin-text-secondary">
                    {w.code ?? "N/A"}
                  </div>

                  <div className="col-span-2">
                    <span className="inline-flex rounded-lg bg-admin-card px-2.5 py-1 text-xs font-bold text-admin-text">
                      {sv?.units ?? 0} units
                    </span>
                    <PermissionGate permission="finances.view">
                      {sv?.costValue != null && (
                        <p className="mt-0.5 text-[11px] text-admin-text-muted">
                          {currency} {sv.costValue.toLocaleString()}
                        </p>
                      )}
                    </PermissionGate>
                  </div>

                  <div className="col-span-2">
                    <span
                      className={
                        w.isActive
                          ? "inline-flex rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-500"
                          : "inline-flex rounded-lg bg-admin-card px-2.5 py-1 text-xs font-bold text-admin-text-muted"
                      }
                    >
                      {w.isActive ? "Active" : "Inactive"}
                    </span>
                  </div>

                  <div className="col-span-2 flex items-center justify-end gap-1">
                    {!can.edit && !can.delete && (
                      <span className="text-[11px] italic text-admin-text-muted">View only</span>
                    )}
                    <ActionMenu
                      label={`Actions for ${w.name}`}
                      items={[
                        {
                          key: "default",
                          label: "Set as default",
                          icon: Star,
                          onSelect: () => handleSetDefault(w),
                          disabled: setDefault.isPending,
                          hidden: !can.edit || w.isDefault,
                        },
                        {
                          key: "edit",
                          label: "Edit warehouse",
                          icon: Pencil,
                          onSelect: () => openEdit(w),
                          hidden: !can.edit,
                        },
                        {
                          key: "delete",
                          label: "Delete warehouse",
                          icon: Trash2,
                          onSelect: () => handleDelete(w),
                          disabled: deleteWarehouse.isPending,
                          destructive: true,
                          // The default warehouse can't be removed.
                          hidden: !can.delete || w.isDefault,
                        },
                      ] satisfies ActionMenuItem[]}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {formOpen && (
        <WarehouseFormModal
          key={editing?.id ?? "new"}
          warehouse={editing}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}

interface WarehouseFormModalProps {
  onClose: () => void;
  warehouse?: Warehouse | null;
}

function WarehouseFormModal({ onClose, warehouse }: WarehouseFormModalProps) {
  const isEdit = Boolean(warehouse);
  const createWarehouse = useCreateWarehouse();
  const updateWarehouse = useUpdateWarehouse();
  const pending = createWarehouse.isPending || updateWarehouse.isPending;

  const [name, setName] = useState(warehouse?.name ?? "");
  const [code, setCode] = useState(warehouse?.code ?? "");
  const [address, setAddress] = useState(warehouse?.address ?? "");
  const [phone, setPhone] = useState(warehouse?.phone ?? "");
  const [isActive, setIsActive] = useState(warehouse?.isActive ?? true);

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      notify.error("Warehouse name is required.");
      return;
    }
    const data = {
      name: trimmed,
      code: code.trim() || null,
      address: address.trim() || null,
      phone: phone.trim() || null,
      isActive,
    };
    const action = isEdit
      ? updateWarehouse.mutateAsync({ id: warehouse!.id, data })
      : createWarehouse.mutateAsync(data);

    action
      .then(() => {
        notify.success(isEdit ? "Warehouse updated." : "Warehouse created.");
        onClose();
      })
      .catch(() => {});
  }

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
      size="sm"
      title={isEdit ? "Edit warehouse" : "New warehouse"}
      description={
        isEdit ? "Update this stock location." : "Add a new stock location."
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-text-secondary transition-colors hover:bg-admin-card disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className="rounded-xl bg-admin-accent px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover disabled:opacity-40"
          >
            {pending ? "Saving..." : isEdit ? "Save changes" : "Create warehouse"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Warehouse name" required>
          {(p) => (
            <TextInput
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Kathmandu Store"
              autoFocus
              {...p}
            />
          )}
        </Field>
        <Field label="Code" hint="Short unique code, e.g. KTM">
          {(p) => (
            <TextInput
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="MAIN"
              {...p}
            />
          )}
        </Field>
        <Field label="Address">
          {(p) => (
            <TextInput
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              {...p}
            />
          )}
        </Field>
        <Field label="Phone">
          {(p) => (
            <TextInput
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              {...p}
            />
          )}
        </Field>
        <Checkbox
          label="Active"
          description="Inactive warehouses are hidden from sale/order pickers."
          checked={isActive}
          onChange={(e) => setIsActive(e.target.checked)}
        />
      </div>
    </Modal>
  );
}
