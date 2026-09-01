"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/molecules/admin";
import { Field, Select } from "@/components/molecules/form";
import { Modal } from "@/components/molecules/modal/Modal";
import type { Warehouse } from "@/types/warehouse.types";

interface PosWarehouseModalProps {
  open: boolean;
  /** Active warehouses to choose from. */
  warehouses: Warehouse[];
  /** Currently selected device warehouse, if any. */
  currentId: string | null;
  /** When false, a choice is required and the modal can't be dismissed. */
  dismissable: boolean;
  onConfirm: (warehouseId: string) => void;
  onClose: () => void;
}

/**
 * Prompts the cashier to pick the warehouse this POS terminal sells from. Shown
 * on first use (blocking, no cancel) and reopened from the "Change" action
 * (dismissable). The choice is stored per-device (see `device-warehouse.ts`).
 */
export function PosWarehouseModal({
  open,
  warehouses,
  currentId,
  dismissable,
  onConfirm,
  onClose,
}: PosWarehouseModalProps) {
  const fallback =
    currentId ??
    warehouses.find((w) => w.isDefault)?.id ??
    warehouses[0]?.id ??
    "";
  const [selected, setSelected] = useState(fallback);

  // Re-seed the selection each time the modal opens.
  useEffect(() => {
    if (open) setSelected(fallback);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Modal
      open={open}
      // Ignore dismiss requests (Escape / overlay) until a warehouse is chosen.
      onOpenChange={(next) => {
        if (!next && dismissable) onClose();
      }}
      title="Select this terminal's warehouse"
      description="Choose the warehouse this POS device sells from. We'll remember it on this device and show only its products. You can change it anytime."
      size="sm"
      footer={
        <>
          {dismissable && (
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          )}
          <Button
            variant="primary"
            disabled={!selected}
            onClick={() => selected && onConfirm(selected)}
          >
            {dismissable ? "Save" : "Confirm & start selling"}
          </Button>
        </>
      }
    >
      <Field label="Warehouse" required>
        {(p) => (
          <Select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            {...p}
          >
            {warehouses.length === 0 && (
              <option value="">No active warehouses</option>
            )}
            {warehouses.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.isDefault ? " (default)" : ""}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </Modal>
  );
}
