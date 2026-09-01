"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Warehouse as WarehouseIcon } from "lucide-react";
import { PageHeader } from "@/components/molecules/admin";
import { writeDeviceWarehouseId } from "@/lib/pos/device-warehouse";
import type { Product, ProductVariant } from "@/types/product.types";
import type {
  Warehouse,
  WarehouseAvailability,
} from "@/types/warehouse.types";
import { SaleForm } from "../SaleForm";
import { PosWarehouseModal } from "../PosWarehouseModal";

interface CreateSaleClientProps {
  products: Product[];
  variantsByProduct: Record<string, ProductVariant[]>;
  warehouses: Warehouse[];
  userDefaultWarehouseId: string | null;
  /** This device's saved POS warehouse (cookie); null until the cashier picks one. */
  initialDeviceWarehouseId: string | null;
  availabilityByWarehouse: WarehouseAvailability;
  currency: { code: string; locale: string };
}

/**
 * The dedicated "Create New Sale" page. Each POS device sells from one
 * warehouse: the first visit prompts the cashier to choose it (stored per
 * device), and that warehouse prefills the form and scopes which products are
 * offered. The cashier can still switch warehouse per-sale, or change the
 * device default from the header. On save or cancel it returns to the sales list.
 */
export function CreateSaleClient({
  products,
  variantsByProduct,
  warehouses,
  userDefaultWarehouseId,
  initialDeviceWarehouseId,
  availabilityByWarehouse,
  currency,
}: CreateSaleClientProps) {
  const router = useRouter();

  const activeWarehouses = useMemo(
    () => warehouses.filter((w) => w.isActive),
    [warehouses],
  );

  // Honor the saved cookie only while it still points at an active warehouse.
  const validInitial =
    initialDeviceWarehouseId &&
    activeWarehouses.some((w) => w.id === initialDeviceWarehouseId)
      ? initialDeviceWarehouseId
      : null;

  const [deviceWarehouseId, setDeviceWarehouseId] = useState<string | null>(
    validInitial,
  );
  // Prompt immediately when there's no valid device warehouse yet.
  const [promptOpen, setPromptOpen] = useState(validInitial === null);

  const deviceWarehouseName = warehouses.find(
    (w) => w.id === deviceWarehouseId,
  )?.name;

  function confirmDeviceWarehouse(id: string) {
    writeDeviceWarehouseId(id);
    setDeviceWarehouseId(id);
    setPromptOpen(false);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Point of sale"
        title="Create New Sale"
        description="Record a new in-person sale. Stock is deducted immediately on save."
        actions={
          deviceWarehouseId && (
            <button
              type="button"
              onClick={() => setPromptOpen(true)}
              className="flex items-center gap-2 rounded-xl border border-admin-border bg-admin-surface px-3 py-2 text-sm text-admin-text-muted transition-colors hover:border-admin-accent hover:text-admin-text"
            >
              <WarehouseIcon className="h-4 w-4 text-admin-accent" />
              <span className="font-semibold text-admin-text">
                {deviceWarehouseName}
              </span>
              <span className="text-xs">· Change</span>
            </button>
          )
        }
      />

      {deviceWarehouseId ? (
        <div className="rounded-2xl border border-admin-border bg-admin-surface p-5 sm:p-6">
          <SaleForm
            // Remount when the device warehouse changes so the prefill + scoped
            // product list reset to the new location.
            key={deviceWarehouseId}
            products={products}
            variantsByProduct={variantsByProduct}
            warehouses={warehouses}
            userDefaultWarehouseId={userDefaultWarehouseId}
            deviceWarehouseId={deviceWarehouseId}
            availabilityByWarehouse={availabilityByWarehouse}
            currency={currency}
            enableScanner
            onSaved={() => router.push("/dashboard/sales")}
            onCancel={() => router.push("/dashboard/sales")}
          />
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-admin-border bg-admin-surface p-10 text-center text-sm text-admin-text-muted">
          Choose the warehouse this terminal sells from to start recording sales.
        </div>
      )}

      <PosWarehouseModal
        open={promptOpen}
        warehouses={activeWarehouses}
        currentId={deviceWarehouseId}
        dismissable={deviceWarehouseId !== null}
        onConfirm={confirmDeviceWarehouse}
        onClose={() => setPromptOpen(false)}
      />
    </div>
  );
}
