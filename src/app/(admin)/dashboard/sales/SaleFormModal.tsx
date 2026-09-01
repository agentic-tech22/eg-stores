"use client";

import { Modal } from "@/components/molecules/modal/Modal";
import type { Product, ProductVariant } from "@/types/product.types";
import type { Sale } from "@/types/sale.types";
import type {
  Warehouse,
  WarehouseAvailability,
} from "@/types/warehouse.types";
import { SaleForm } from "./SaleForm";

interface SaleFormModalProps {
  open: boolean;
  onClose: () => void;
  products: Product[];
  variantsByProduct: Record<string, ProductVariant[]>;
  warehouses: Warehouse[];
  userDefaultWarehouseId?: string | null;
  availabilityByWarehouse: WarehouseAvailability;
  currency: { code: string; locale: string };
  /** When provided the modal edits this sale; otherwise it creates a new one. */
  sale?: Sale | null;
  /** Called after a sale is successfully recorded/updated (before `onClose`). */
  onSaved?: () => void;
}

/**
 * Modal wrapper around {@link SaleForm}, used for editing a sale and for
 * quick-creating one from the sales list. The dedicated "Create New Sale" page
 * renders `SaleForm` inline instead.
 */
export function SaleFormModal({
  open,
  onClose,
  products,
  variantsByProduct,
  warehouses,
  userDefaultWarehouseId,
  availabilityByWarehouse,
  currency,
  sale,
  onSaved,
}: SaleFormModalProps) {
  const isEdit = Boolean(sale);
  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="lg"
      title={isEdit ? "Edit sale" : "New sale"}
      description={
        isEdit
          ? "Update this sale's items, payment, and details."
          : "Record a point-of-sale transaction. Stock is deducted immediately."
      }
    >
      <SaleForm
        products={products}
        variantsByProduct={variantsByProduct}
        warehouses={warehouses}
        userDefaultWarehouseId={userDefaultWarehouseId}
        availabilityByWarehouse={availabilityByWarehouse}
        currency={currency}
        sale={sale}
        onSaved={() => {
          onSaved?.();
          onClose();
        }}
        onCancel={onClose}
      />
    </Modal>
  );
}
