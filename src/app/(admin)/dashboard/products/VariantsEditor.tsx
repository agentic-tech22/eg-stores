"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Sparkles, Trash2, X } from "lucide-react";
import { Field, TextInput } from "@/components/molecules/form";
import type { VariantInput } from "@/services/product.service";
import type { ProductVariant } from "@/types/product.types";

interface AttrDef {
  name: string;
  /** Raw text as typed (e.g. "Red, Blue, Green"); parsed into values lazily. */
  valuesText: string;
}

/** Split the raw comma-separated text into trimmed, non-empty values. */
function parseValues(valuesText: string): string[] {
  return valuesText
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

interface VariantRow {
  key: string;
  id?: string;
  attributes: Record<string, string>;
  displayName: string;
  sku: string;
  priceOverride: string;
  stockQuantity: string;
}

interface VariantsEditorProps {
  initialVariants: ProductVariant[];
  onChange: (variants: VariantInput[]) => void;
}

function comboKey(attributes: Record<string, string>): string {
  return Object.entries(attributes)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${v}`)
    .join("|");
}

function displayNameFor(
  attrs: AttrDef[],
  combo: Record<string, string>,
): string {
  // Use trimmed names to match the keys buildCombos() stores, so every
  // attribute (e.g. Size) is reflected in the label, not just the first.
  return attrs
    .map((a) => combo[a.name.trim()])
    .filter(Boolean)
    .join(" / ");
}

/** Cartesian product of every attribute's values. */
function buildCombos(attrs: AttrDef[]): Record<string, string>[] {
  const usable = attrs
    .map((a) => ({ name: a.name.trim(), values: parseValues(a.valuesText) }))
    .filter((a) => a.name && a.values.length > 0);
  if (usable.length === 0) return [];
  return usable.reduce<Record<string, string>[]>(
    (acc, attr) =>
      acc.flatMap((combo) =>
        attr.values.map((value) => ({ ...combo, [attr.name]: value })),
      ),
    [{}],
  );
}

export function VariantsEditor({
  initialVariants,
  onChange,
}: VariantsEditorProps) {
  const [attrs, setAttrs] = useState<AttrDef[]>(() => {
    // Derive attributes from existing variants when editing.
    const map = new Map<string, Set<string>>();
    for (const v of initialVariants) {
      for (const [k, val] of Object.entries(v.attributes)) {
        (map.get(k) ?? map.set(k, new Set()).get(k)!).add(val);
      }
    }
    const derived = [...map.entries()].map(([name, values]) => ({
      name,
      valuesText: [...values].join(", "),
    }));
    return derived.length > 0 ? derived : [{ name: "", valuesText: "" }];
  });

  const [rows, setRows] = useState<VariantRow[]>(() =>
    initialVariants.map((v) => ({
      key: v.id,
      id: v.id,
      attributes: v.attributes,
      displayName: v.displayName,
      sku: v.sku ?? "",
      priceOverride: v.priceOverride !== null ? String(v.priceOverride) : "",
      stockQuantity: String(v.stockQuantity),
    })),
  );

  // Emit the current rows to the parent whenever they change.
  useEffect(() => {
    const variants: VariantInput[] = rows
      .filter((r) => r.displayName.trim())
      .map((r) => ({
        id: r.id,
        attributes: r.attributes,
        displayName: r.displayName.trim(),
        sku: r.sku.trim() || null,
        priceOverride: r.priceOverride.trim()
          ? parseFloat(r.priceOverride)
          : null,
        stockQuantity: parseInt(r.stockQuantity, 10) || 0,
      }));
    onChange(variants);
  }, [rows, onChange]);

  /**
   * Running totals for the footer row.
   *
   * Deliberately mirrors the filter and the parse in the emit effect above: a
   * row with no display name is dropped on save, and each stock box is read
   * with `parseInt(…) || 0`. Counting them any other way would show the user a
   * total the product never ends up with.
   */
  const totals = useMemo(() => {
    const saved = rows.filter((r) => r.displayName.trim());
    return {
      count: saved.length,
      stock: saved.reduce(
        (sum, r) => sum + (parseInt(r.stockQuantity, 10) || 0),
        0,
      ),
    };
  }, [rows]);

  const existingByCombo = useMemo(() => {
    const map = new Map<string, VariantRow>();
    for (const r of rows) map.set(comboKey(r.attributes), r);
    return map;
  }, [rows]);

  function generate() {
    const combos = buildCombos(attrs);
    if (combos.length === 0) return;
    const next: VariantRow[] = combos.map((combo) => {
      const existing = existingByCombo.get(comboKey(combo));
      if (existing) {
        return { ...existing, displayName: displayNameFor(attrs, combo) };
      }
      return {
        key: comboKey(combo) || Math.random().toString(36).slice(2),
        attributes: combo,
        displayName: displayNameFor(attrs, combo),
        sku: "",
        priceOverride: "",
        stockQuantity: "0",
      };
    });
    setRows(next);
  }

  function updateRow(key: string, patch: Partial<VariantRow>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function updateAttr(index: number, patch: Partial<AttrDef>) {
    setAttrs((prev) => prev.map((a, i) => (i === index ? { ...a, ...patch } : a)));
  }

  return (
    <div className="space-y-4">
      {/* Attribute definitions */}
      <div className="rounded-xl border border-admin-border bg-admin-card/30 p-4">
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-admin-text-muted">
          Attributes
        </p>
        <div className="space-y-3">
          {attrs.map((attr, i) => (
            <div key={i} className="grid grid-cols-12 items-end gap-2">
              <div className="col-span-4">
                <Field label="Name">
                  {(p) => (
                    <TextInput
                      value={attr.name}
                      onChange={(e) => updateAttr(i, { name: e.target.value })}
                      placeholder="Color"
                      {...p}
                    />
                  )}
                </Field>
              </div>
              <div className="col-span-7">
                <Field label="Values (comma-separated)">
                  {(p) => (
                    <TextInput
                      value={attr.valuesText}
                      onChange={(e) =>
                        updateAttr(i, { valuesText: e.target.value })
                      }
                      placeholder="Red, Blue, Green"
                      {...p}
                    />
                  )}
                </Field>
              </div>
              <div className="col-span-1 pb-2">
                {attrs.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setAttrs((prev) => prev.filter((_, idx) => idx !== i))
                    }
                    aria-label="Remove attribute"
                    className="rounded-lg p-1.5 text-admin-danger/60 transition-colors hover:bg-admin-danger/10 hover:text-admin-danger"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setAttrs((prev) => [...prev, { name: "", valuesText: "" }])
            }
            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-admin-text-muted transition-colors hover:bg-admin-card"
          >
            <Plus className="h-3.5 w-3.5" /> Add attribute
          </button>
          <button
            type="button"
            onClick={generate}
            className="flex items-center gap-1.5 rounded-lg bg-admin-accent/10 px-2.5 py-1.5 text-xs font-bold text-admin-accent transition-colors hover:bg-admin-accent/20"
          >
            <Sparkles className="h-3.5 w-3.5" /> Generate combinations
          </button>
        </div>
      </div>

      {/* Variant rows */}
      {rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-admin-border">
          <div className="grid grid-cols-12 gap-2 border-b border-admin-border bg-admin-card/40 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.1em] text-admin-text-muted">
            <span className="col-span-4">Variant</span>
            <span className="col-span-3">SKU</span>
            <span className="col-span-2">Price</span>
            <span className="col-span-2">Stock</span>
            <span className="col-span-1" />
          </div>
          <div className="divide-y divide-admin-border">
            {rows.map((row) => (
              <div
                key={row.key}
                className="grid grid-cols-12 items-center gap-2 px-3 py-2"
              >
                <span className="col-span-4 truncate text-sm font-semibold text-admin-text">
                  {row.displayName || "N/A"}
                </span>
                <input
                  className="col-span-3 rounded-lg border border-admin-border bg-admin-input px-2 py-1.5 text-xs text-admin-text focus:outline-none"
                  value={row.sku}
                  onChange={(e) => updateRow(row.key, { sku: e.target.value })}
                  placeholder="Optional"
                />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  className="col-span-2 rounded-lg border border-admin-border bg-admin-input px-2 py-1.5 text-xs text-admin-text focus:outline-none"
                  value={row.priceOverride}
                  onChange={(e) =>
                    updateRow(row.key, { priceOverride: e.target.value })
                  }
                  placeholder="Inherit"
                />
                <input
                  type="number"
                  min="0"
                  className="col-span-2 rounded-lg border border-admin-border bg-admin-input px-2 py-1.5 text-xs text-admin-text focus:outline-none"
                  value={row.stockQuantity}
                  onChange={(e) =>
                    updateRow(row.key, { stockQuantity: e.target.value })
                  }
                />
                <div className="col-span-1 text-right">
                  <button
                    type="button"
                    onClick={() =>
                      setRows((prev) => prev.filter((r) => r.key !== row.key))
                    }
                    aria-label="Remove variant"
                    className="rounded-lg p-1.5 text-admin-danger/60 transition-colors hover:bg-admin-danger/10 hover:text-admin-danger"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
          {/* Total stock across the variants, in the column it sums. With
              variants on, this is the product's whole stock figure — there is
              no single-quantity box to read it off. */}
          <div className="grid grid-cols-12 items-center gap-2 border-t border-admin-border bg-admin-card/40 px-3 py-2.5">
            <span className="col-span-9 text-[11px] font-bold uppercase tracking-[0.1em] text-admin-text-muted">
              Total stock
              <span className="ml-1.5 normal-case tracking-normal">
                ({totals.count} {totals.count === 1 ? "variant" : "variants"})
              </span>
            </span>
            <span className="col-span-2 text-sm font-bold text-admin-text">
              {totals.stock}
            </span>
            <span className="col-span-1" />
          </div>
        </div>
      )}
    </div>
  );
}
