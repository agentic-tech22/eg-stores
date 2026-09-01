"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Modal } from "@/components/molecules/modal/Modal";
import { Field, Select, TextInput, Textarea } from "@/components/molecules/form";
import { useCreateOrder } from "@/hooks/orders/use-order-mutations";
import { notify } from "@/lib/toast";
import type { Product, ProductVariant } from "@/types/product.types";
import type { OrderLineInput } from "@/types/order.types";
import type {
  Warehouse,
  WarehouseAvailability,
} from "@/types/warehouse.types";
import { formatCurrency } from "@/utils/format-currency";

interface CreateOrderModalProps {
  open: boolean;
  onClose: () => void;
  products: Product[];
  variantsByProduct: Record<string, ProductVariant[]>;
  warehouses: Warehouse[];
  availabilityByWarehouse: WarehouseAvailability;
  currency: { code: string; locale: string };
}

interface DraftLine {
  key: string;
  productId: string;
  variantId: string;
  quantity: string;
}

function newLine(): DraftLine {
  return {
    key: Math.random().toString(36).slice(2),
    productId: "",
    variantId: "",
    quantity: "1",
  };
}

export function CreateOrderModal({
  open,
  onClose,
  products,
  variantsByProduct,
  warehouses,
  availabilityByWarehouse,
  currency,
}: CreateOrderModalProps) {
  const createOrder = useCreateOrder();

  const activeWarehouses = useMemo(
    () => warehouses.filter((w) => w.isActive),
    [warehouses],
  );
  const defaultWarehouseId =
    warehouses.find((w) => w.isDefault && w.isActive)?.id ??
    activeWarehouses[0]?.id ??
    "";

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerPhone2, setCustomerPhone2] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [warehouseId, setWarehouseId] = useState(defaultWarehouseId);
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<DraftLine[]>([newLine()]);

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  function updateLine(key: string, patch: Partial<DraftLine>) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...patch } : l)),
    );
  }

  function unitPriceFor(line: DraftLine): number | null {
    const product = productById.get(line.productId);
    if (!product) return null;
    if (product.hasVariants) {
      const variant = (variantsByProduct[product.id] ?? []).find(
        (v) => v.id === line.variantId,
      );
      return variant ? (variant.priceOverride ?? product.price) : null;
    }
    return product.price;
  }

  /** Available for the selected warehouse (0 when not stocked there). */
  function availableFor(line: DraftLine): number | null {
    const product = productById.get(line.productId);
    if (!product) return null;
    const bucket = availabilityByWarehouse[warehouseId];
    if (product.hasVariants) {
      if (!line.variantId) return null;
      return bucket?.variants[line.variantId] ?? 0;
    }
    return bucket?.products[product.id] ?? 0;
  }

  const subtotal = lines.reduce((sum, line) => {
    const price = unitPriceFor(line);
    const qty = parseInt(line.quantity, 10);
    return price && qty > 0 ? sum + price * qty : sum;
  }, 0);

  function handleSubmit() {
    if (!customerName.trim() || !customerPhone.trim() || !customerAddress.trim()) {
      notify.error("Customer name, phone, and address are required.");
      return;
    }
    if (!warehouseId) {
      notify.error("Choose a warehouse to fulfill from.");
      return;
    }

    const items: OrderLineInput[] = [];
    for (const line of lines) {
      if (!line.productId) continue;
      const product = productById.get(line.productId);
      const qty = parseInt(line.quantity, 10);
      if (!product || !qty || qty <= 0) {
        notify.error("Each line needs a product and a positive quantity.");
        return;
      }
      if (product.hasVariants && !line.variantId) {
        notify.error(`Choose a variant for "${product.title}".`);
        return;
      }
      const available = availableFor(line);
      if (available !== null && qty > available) {
        const label = product.hasVariants
          ? `${product.title} (${
              variantsByProduct[product.id]?.find((v) => v.id === line.variantId)
                ?.displayName ?? "variant"
            })`
          : product.title;
        notify.error(
          `Only ${available} of "${label}" in stock. Reduce the quantity.`,
        );
        return;
      }
      items.push({
        productId: line.productId,
        productVariantId: product.hasVariants ? line.variantId : null,
        quantity: qty,
      });
    }

    if (items.length === 0) {
      notify.error("Add at least one product.");
      return;
    }

    createOrder.mutate(
      {
        customerName,
        customerPhone,
        customerPhone2: customerPhone2 || null,
        customerAddress,
        warehouseId,
        notes: notes || null,
        items,
      },
      {
        onSuccess: () => {
          notify.success("Order created.");
          onClose();
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next && !createOrder.isPending) onClose();
      }}
      size="lg"
      title="New order"
      description="Create an order on behalf of a customer."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={createOrder.isPending}
            className="rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-text-secondary transition-colors hover:bg-admin-card disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={createOrder.isPending}
            className="rounded-xl bg-admin-accent px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover disabled:opacity-40"
          >
            {createOrder.isPending ? "Creating..." : "Create order"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Customer name" required>
          {(p) => (
            <TextInput
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Jane Doe"
              {...p}
            />
          )}
        </Field>
        <Field label="Phone" required>
          {(p) => (
            <TextInput
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              placeholder="98XXXXXXXX"
              {...p}
            />
          )}
        </Field>
        <Field label="Alternate phone">
          {(p) => (
            <TextInput
              value={customerPhone2}
              onChange={(e) => setCustomerPhone2(e.target.value)}
              placeholder="Optional"
              {...p}
            />
          )}
        </Field>
        <Field label="Delivery address" required className="sm:col-span-2">
          {(p) => (
            <Textarea
              value={customerAddress}
              onChange={(e) => setCustomerAddress(e.target.value)}
              rows={2}
              placeholder="Street, city, landmark"
              {...p}
            />
          )}
        </Field>
        <Field
          label="Fulfill from warehouse"
          required
          className="sm:col-span-2"
          hint="Stock is reserved from this location."
        >
          {(p) => (
            <Select
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              {...p}
            >
              {activeWarehouses.length === 0 && (
                <option value="">No warehouses</option>
              )}
              {activeWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.isDefault ? " (default)" : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>
      </div>

      {/* Line items */}
      <div className="mt-6">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-admin-text-muted">
            Items
          </p>
          <button
            type="button"
            onClick={() => setLines((prev) => [...prev, newLine()])}
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-admin-accent transition-colors hover:bg-admin-accent/10"
          >
            <Plus className="h-3.5 w-3.5" /> Add item
          </button>
        </div>

        <div className="space-y-3">
          {lines.map((line) => {
            const product = productById.get(line.productId);
            const variants = product?.hasVariants
              ? (variantsByProduct[product.id] ?? [])
              : [];
            const available = availableFor(line);
            const qty = parseInt(line.quantity, 10);
            const overStock =
              available !== null && qty > 0 && qty > available;
            return (
              <div
                key={line.key}
                className="grid grid-cols-12 items-end gap-2 rounded-xl border border-admin-border bg-admin-card/30 p-3"
              >
                <div className={product?.hasVariants ? "col-span-5" : "col-span-8"}>
                  <Field label="Product">
                    {(p) => (
                      <Select
                        value={line.productId}
                        onChange={(e) =>
                          updateLine(line.key, {
                            productId: e.target.value,
                            variantId: "",
                          })
                        }
                        {...p}
                      >
                        <option value="">Select a product…</option>
                        {products.map((prod) => (
                          <option key={prod.id} value={prod.id}>
                            {prod.title}
                            {prod.sku ? ` · ${prod.sku}` : ""}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                </div>

                {product?.hasVariants && (
                  <div className="col-span-3">
                    <Field label="Variant">
                      {(p) => (
                        <Select
                          value={line.variantId}
                          onChange={(e) =>
                            updateLine(line.key, { variantId: e.target.value })
                          }
                          {...p}
                        >
                          <option value="">Select…</option>
                          {variants.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.displayName}
                              {v.sku ? ` · ${v.sku}` : ""} (
                              {availabilityByWarehouse[warehouseId]?.variants[v.id] ?? 0} left)
                            </option>
                          ))}
                        </Select>
                      )}
                    </Field>
                  </div>
                )}

                <div className="col-span-2">
                  <Field label="Qty">
                    {(p) => (
                      <TextInput
                        type="number"
                        min="1"
                        max={available ?? undefined}
                        value={line.quantity}
                        onChange={(e) =>
                          updateLine(line.key, { quantity: e.target.value })
                        }
                        {...p}
                      />
                    )}
                  </Field>
                </div>

                <div className="col-span-2 flex items-center justify-end gap-2 pb-2">
                  {available !== null && (
                    <span
                      className={
                        overStock
                          ? "text-[11px] font-semibold text-admin-danger"
                          : "text-[11px] text-admin-text-muted"
                      }
                    >
                      {available} avail.
                    </span>
                  )}
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setLines((prev) => prev.filter((l) => l.key !== line.key))
                      }
                      aria-label="Remove item"
                      className="rounded-lg p-1.5 text-admin-danger/60 transition-colors hover:bg-admin-danger/10 hover:text-admin-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-admin-border pt-4">
          <Field label="Notes" className="flex-1">
            {(p) => (
              <TextInput
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional internal note"
                {...p}
              />
            )}
          </Field>
          <div className="ml-4 text-right">
            <p className="text-[11px] uppercase tracking-wide text-admin-text-muted">
              Subtotal
            </p>
            <p className="text-lg font-extrabold text-admin-text">
              {formatCurrency(subtotal, currency.code, currency.locale)}
            </p>
          </div>
        </div>
      </div>
    </Modal>
  );
}
