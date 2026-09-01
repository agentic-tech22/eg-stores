"use client";

import { useMemo, useState } from "react";
import { ArrowRight, Plus, Repeat } from "lucide-react";
import { useTransferStock } from "@/hooks/warehouses/use-warehouses";
import { EmptyState, PageHeader } from "@/components/molecules/admin";
import { Modal } from "@/components/molecules/modal/Modal";
import { Field, Select, TextInput, Textarea } from "@/components/molecules/form";
import { notify } from "@/lib/toast";
import type { Product, ProductVariant } from "@/types/product.types";
import type {
  StockMovement,
  Warehouse,
  WarehouseAvailability,
} from "@/types/warehouse.types";

interface TransferManagerProps {
  warehouses: Warehouse[];
  products: Product[];
  variantsByProduct: Record<string, ProductVariant[]>;
  availabilityByWarehouse: WarehouseAvailability;
  movements: StockMovement[];
  canTransfer: boolean;
}

export function TransferManager({
  warehouses,
  products,
  variantsByProduct,
  availabilityByWarehouse,
  movements,
  canTransfer,
}: TransferManagerProps) {
  const [open, setOpen] = useState(false);

  return (
    <div>
      <PageHeader
        eyebrow="Inventory"
        title="Stock Transfers"
        description="Move a chosen quantity of a product from one warehouse to another. Only free (unreserved) stock can be moved."
        actions={
          canTransfer && (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-admin-accent-hover"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              New Transfer
            </button>
          )
        }
      />

      {movements.length === 0 ? (
        <EmptyState
          icon={Repeat}
          title="No stock movements yet"
          description="Transfers, manual stock edits, and deletions will appear here."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
          <div className="hidden border-b border-admin-border bg-admin-card/40 px-5 py-3 sm:grid sm:grid-cols-12 sm:gap-4">
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Date</p>
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Type</p>
            <p className="col-span-4 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Product</p>
            <p className="col-span-3 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Movement</p>
            <p className="col-span-1 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Qty</p>
          </div>
          <div className="divide-y divide-admin-border">
            {movements.map((m) => (
              <div
                key={m.id}
                className="grid grid-cols-1 gap-2 px-5 py-3.5 sm:grid-cols-12 sm:items-center sm:gap-4"
              >
                <div className="col-span-2 text-xs text-admin-text-muted">
                  {new Date(m.createdAt).toLocaleDateString()}
                </div>
                <div className="col-span-2">
                  <MovementBadge type={m.type} />
                </div>
                <div className="col-span-4 min-w-0">
                  <p className="truncate text-sm font-semibold text-admin-text">
                    {m.productTitle ?? "N/A"}
                  </p>
                  {m.variantLabel && (
                    <p className="truncate text-[11px] text-admin-text-muted">{m.variantLabel}</p>
                  )}
                </div>
                <div className="col-span-3 text-xs text-admin-text-secondary">
                  {m.type === "transfer" ? (
                    <span className="inline-flex items-center gap-1">
                      {m.fromWarehouseName ?? "N/A"}
                      <ArrowRight className="h-3 w-3" />
                      {m.toWarehouseName ?? "N/A"}
                    </span>
                  ) : m.type === "edit" ? (
                    <span>
                      {m.warehouseName ?? "N/A"}: {m.oldValue} → {m.newValue}
                    </span>
                  ) : (
                    <span>{m.warehouseName ?? "Deleted"}</span>
                  )}
                </div>
                <div className="col-span-1 text-right text-sm font-bold text-admin-text">
                  {m.type === "transfer"
                    ? m.quantity
                    : m.type === "edit"
                      ? (m.newValue ?? 0) - (m.oldValue ?? 0)
                      : (m.quantity ?? "")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {open && (
        <TransferModal
          warehouses={warehouses}
          products={products}
          variantsByProduct={variantsByProduct}
          availabilityByWarehouse={availabilityByWarehouse}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

function MovementBadge({ type }: { type: StockMovement["type"] }) {
  const map = {
    transfer: "bg-admin-accent/10 text-admin-accent",
    edit: "bg-amber-500/10 text-amber-500",
    deletion: "bg-admin-danger/10 text-admin-danger",
  } as const;
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-[11px] font-bold capitalize ${map[type]}`}>
      {type}
    </span>
  );
}

interface TransferModalProps {
  warehouses: Warehouse[];
  products: Product[];
  variantsByProduct: Record<string, ProductVariant[]>;
  availabilityByWarehouse: WarehouseAvailability;
  onClose: () => void;
}

function TransferModal({
  warehouses,
  products,
  variantsByProduct,
  availabilityByWarehouse,
  onClose,
}: TransferModalProps) {
  const transfer = useTransferStock();
  const activeWarehouses = warehouses.filter((w) => w.isActive);
  const defaultWh = warehouses.find((w) => w.isDefault) ?? activeWarehouses[0];

  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [fromId, setFromId] = useState(defaultWh?.id ?? "");
  const [toId, setToId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");

  const product = products.find((p) => p.id === productId);
  const variants = product?.hasVariants ? (variantsByProduct[productId] ?? []) : [];

  const fromAvailable = useMemo(() => {
    if (!fromId || !productId) return 0;
    const bucket = availabilityByWarehouse[fromId];
    if (!bucket) return 0;
    if (product?.hasVariants) {
      return variantId ? (bucket.variants[variantId] ?? 0) : 0;
    }
    return bucket.products[productId] ?? 0;
  }, [availabilityByWarehouse, fromId, productId, variantId, product]);

  const pending = transfer.isPending;

  function handleSubmit() {
    if (!productId) return notify.error("Choose a product.");
    if (product?.hasVariants && !variantId) return notify.error("Choose a variant.");
    if (!fromId || !toId) return notify.error("Choose both warehouses.");
    if (fromId === toId) return notify.error("Source and destination must differ.");
    const qty = Math.trunc(quantity);
    if (!Number.isFinite(qty) || qty <= 0) return notify.error("Enter a valid quantity.");
    if (qty > fromAvailable)
      return notify.error(`Only ${fromAvailable} available in the source warehouse.`);

    transfer
      .mutateAsync({
        productId,
        productVariantId: product?.hasVariants ? variantId : null,
        fromWarehouseId: fromId,
        toWarehouseId: toId,
        quantity: qty,
        note: note.trim() || null,
      })
      .then(() => {
        notify.success("Stock transferred.");
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
      size="md"
      title="Transfer stock"
      description="Move units between warehouses. The move is logged."
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
            {pending ? "Transferring..." : "Transfer"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Product" required>
          {(p) => (
            <Select
              value={productId}
              onChange={(e) => {
                setProductId(e.target.value);
                setVariantId("");
              }}
              {...p}
            >
              <option value="">Select a product…</option>
              {products.map((prod) => (
                <option key={prod.id} value={prod.id}>
                  {prod.title}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {product?.hasVariants && (
          <Field label="Variant" required>
            {(p) => (
              <Select
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                {...p}
              >
                <option value="">Select a variant…</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.displayName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3">
          <Field label="From" required hint={`${fromAvailable} available`}>
            {(p) => (
              <Select value={fromId} onChange={(e) => setFromId(e.target.value)} {...p}>
                <option value="">Source…</option>
                {activeWarehouses.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <Field label="To" required>
            {(p) => (
              <Select value={toId} onChange={(e) => setToId(e.target.value)} {...p}>
                <option value="">Destination…</option>
                {activeWarehouses
                  .filter((w) => w.id !== fromId)
                  .map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
        </div>

        <Field label="Quantity" required>
          {(p) => (
            <TextInput
              type="number"
              min={1}
              max={fromAvailable || undefined}
              value={quantity}
              onChange={(e) => setQuantity(Number(e.target.value))}
              {...p}
            />
          )}
        </Field>

        <Field label="Note">
          {(p) => (
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional reason for the transfer"
              {...p}
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
