"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/molecules/modal/Modal";
import { Checkbox, Field, Select, TextInput, Textarea } from "@/components/molecules/form";
import { useRestockProduct } from "@/hooks/products/use-restock";
import { useWarehouses } from "@/hooks/warehouses/use-warehouses";
import { fetchProductWithVariants } from "@/services/product.service";
import { usePermission } from "@/components/auth/permission-context";
import { notify } from "@/lib/toast";
import type { Product, ProductVariant } from "@/types/product.types";

interface RestockModalProps {
  product: Product;
  onClose: () => void;
}

/**
 * Records a stock import for a product: how many units arrived and, for finance
 * users, the per-unit cost paid, optionally promoting it to the product's cost
 * price. Variant products require choosing which variant the stock belongs to.
 */
export function RestockModal({ product, onClose }: RestockModalProps) {
  const canViewFinance = usePermission("finances.view");
  const restock = useRestockProduct();
  const pending = restock.isPending;
  const { data: warehouses = [] } = useWarehouses();
  const activeWarehouses = warehouses.filter((w) => w.isActive);

  const [quantity, setQuantity] = useState("");
  const [unitCost, setUnitCost] = useState("");
  const [note, setNote] = useState("");
  const [setAsCostPrice, setSetAsCostPrice] = useState(false);
  const [variantId, setVariantId] = useState("");
  // Empty until the user picks; falls back to the default warehouse for both the
  // Select value and submission, so no effect is needed to seed it.
  const [pickedWarehouseId, setPickedWarehouseId] = useState("");
  const defaultWarehouseId =
    warehouses.find((w) => w.isDefault && w.isActive)?.id ??
    activeWarehouses[0]?.id ??
    "";
  const warehouseId = pickedWarehouseId || defaultWarehouseId;

  // Variant products hold stock per variant; load the list so the user can pick.
  const [variants, setVariants] = useState<ProductVariant[] | null>(null);
  useEffect(() => {
    if (!product.hasVariants) return;
    let active = true;
    void fetchProductWithVariants(product.id).then((p) => {
      if (active) setVariants(p?.variants ?? []);
    });
    return () => {
      active = false;
    };
  }, [product.id, product.hasVariants]);

  function handleSubmit() {
    const qty = Number(quantity);
    if (!Number.isInteger(qty) || qty <= 0) {
      notify.error("Enter a positive whole number of units.");
      return;
    }
    if (product.hasVariants && !variantId) {
      notify.error("Choose which variant this stock is for.");
      return;
    }
    if (!warehouseId) {
      notify.error("Choose which warehouse this stock goes into.");
      return;
    }

    restock.mutate(
      {
        productId: product.id,
        variantId: product.hasVariants ? variantId : null,
        warehouseId,
        quantity: qty,
        unitCost: canViewFinance && unitCost !== "" ? Number(unitCost) : null,
        note: note.trim() || null,
        setAsCostPrice: canViewFinance && setAsCostPrice && unitCost !== "",
      },
      {
        onSuccess: () => {
          notify.success(`Added ${qty} unit${qty === 1 ? "" : "s"} to stock.`);
          onClose();
        },
      },
    );
  }

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
      size="md"
      title="Restock product"
      description={`Add imported units for ${product.title}.`}
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
            {pending ? "Saving..." : "Add stock"}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Field label="Warehouse" required hint="Which location these units arrive at.">
          {(p) => (
            <Select
              value={warehouseId}
              onChange={(e) => setPickedWarehouseId(e.target.value)}
              {...p}
            >
              <option value="">Select a warehouse</option>
              {activeWarehouses.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                  {w.isDefault ? " (default)" : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {product.hasVariants && (
          <Field label="Variant" required hint="Stock is tracked per variant for this product.">
            {(p) => (
              <Select
                value={variantId}
                onChange={(e) => setVariantId(e.target.value)}
                disabled={variants === null}
                {...p}
              >
                <option value="">
                  {variants === null ? "Loading variants..." : "Select a variant"}
                </option>
                {(variants ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.displayName}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}

        <Field label="Quantity imported" required>
          {(p) => (
            <TextInput
              type="number"
              step="1"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="50"
              {...p}
            />
          )}
        </Field>

        {canViewFinance && (
          <>
            <Field
              label="Unit cost"
              hint="Per-unit price paid to the supplier for this batch (optional)."
            >
              {(p) => (
                <TextInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={unitCost}
                  onChange={(e) => setUnitCost(e.target.value)}
                  placeholder="18.00"
                  {...p}
                />
              )}
            </Field>

            <Checkbox
              checked={setAsCostPrice}
              onChange={(e) => setSetAsCostPrice(e.target.checked)}
              disabled={unitCost === ""}
              label="Set this as the product's cost price"
            />
          </>
        )}

        <Field label="Note">
          {(p) => (
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Supplier name, invoice number"
              {...p}
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
