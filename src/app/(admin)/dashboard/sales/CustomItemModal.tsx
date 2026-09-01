"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/molecules/admin";
import { Field, TextInput } from "@/components/molecules/form";
import { Modal } from "@/components/molecules/modal/Modal";
import {
  CUSTOM_ITEM_TITLE_MAX,
  validateCustomItem,
  type CustomItemErrors,
  type CustomItemValue,
} from "@/lib/pos/custom-item";
import { formatCurrency } from "@/utils/format-currency";

interface CustomItemModalProps {
  open: boolean;
  currency: { code: string; locale: string };
  /** Prefills the fields when editing a custom line that's already in the cart. */
  initial?: CustomItemValue | null;
  /** Receives the validated item; the modal never emits invalid values. */
  onSubmit: (value: CustomItemValue) => void;
  onClose: () => void;
}

const EMPTY = { title: "", unitPrice: "", quantity: "1" };

/**
 * Collects the name, unit price and quantity for a POS item that isn't in the
 * catalog, asked up front, before the line joins the sale. Doubles as the edit
 * dialog for a custom line already in the cart (`initial`).
 *
 * What it produces is an "extra sale": billed on the same sale, but persisted
 * to `extra_sale_items` and kept out of every product figure.
 */
export function CustomItemModal({
  open,
  currency,
  initial,
  onSubmit,
  onClose,
}: CustomItemModalProps) {
  const [draft, setDraft] = useState(EMPTY);
  const [errors, setErrors] = useState<CustomItemErrors>({});

  // Re-seed each time the modal opens so a cancelled entry never leaks into the
  // next one, and editing always starts from the line's current values.
  useEffect(() => {
    if (!open) return;
    setDraft(
      initial
        ? {
            title: initial.title,
            unitPrice: String(initial.unitPrice),
            quantity: String(initial.quantity),
          }
        : EMPTY,
    );
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  /** Patch one field and clear its error, so a fix disappears as it's typed. */
  function update(patch: Partial<typeof EMPTY>) {
    setDraft((prev) => ({ ...prev, ...patch }));
    setErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch) as (keyof typeof EMPTY)[]) {
        delete next[key];
      }
      return next;
    });
  }

  function handleSubmit() {
    const { errors: found, value } = validateCustomItem(draft);
    if (!value) {
      setErrors(found);
      return;
    }
    onSubmit(value);
  }

  // Live line total, shown only once both numbers are usable.
  const previewValue = validateCustomItem({ ...draft, title: draft.title || "-" }).value;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={initial ? "Edit extra item" : "Add an extra item"}
      description="For something that isn't in the catalog — a service charge, repair labour, a delivery fee. It's billed on this sale but holds no stock and is reported separately under Extra Sales, so it never counts toward product profit."
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleSubmit}>
            {initial ? "Save item" : "Add to sale"}
          </Button>
        </>
      }
    >
      <div
        className="space-y-4"
        onKeyDown={(e) => {
          // Enter anywhere in the form commits, matching the scan-and-go rhythm
          // of the POS page.
          if (e.key === "Enter") {
            e.preventDefault();
            handleSubmit();
          }
        }}
      >
        <Field label="Item name" required error={errors.title}>
          {(p) => (
            <TextInput
              value={draft.title}
              onChange={(e) => update({ title: e.target.value })}
              maxLength={CUSTOM_ITEM_TITLE_MAX}
              placeholder="e.g. Repair charge, Gift wrap"
              hasError={Boolean(errors.title)}
              autoFocus
              {...p}
            />
          )}
        </Field>

        <div className="grid grid-cols-2 gap-4">
          <Field
            label={`Unit price (${currency.code})`}
            required
            error={errors.unitPrice}
          >
            {(p) => (
              <TextInput
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                value={draft.unitPrice}
                onChange={(e) => update({ unitPrice: e.target.value })}
                placeholder="0.00"
                hasError={Boolean(errors.unitPrice)}
                {...p}
              />
            )}
          </Field>
          <Field label="Quantity" required error={errors.quantity}>
            {(p) => (
              <TextInput
                type="number"
                inputMode="numeric"
                step="1"
                min="1"
                value={draft.quantity}
                onChange={(e) => update({ quantity: e.target.value })}
                hasError={Boolean(errors.quantity)}
                {...p}
              />
            )}
          </Field>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-admin-border bg-admin-card/40 px-4 py-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-admin-text-muted">
            Line total
          </span>
          <span className="text-base font-extrabold text-admin-text">
            {previewValue
              ? formatCurrency(
                  previewValue.unitPrice * previewValue.quantity,
                  currency.code,
                  currency.locale,
                )
              : "N/A"}
          </span>
        </div>
      </div>
    </Modal>
  );
}
