import { notFound, redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import { fetchSaleById } from "@/services/sale.service";
import { fetchProductsForPicker } from "@/services/product.service";
import { fetchWarehouses } from "@/services/warehouse.service";
import { fetchInvoiceForSale } from "@/services/invoice.service";
import { getActiveCurrency } from "@/lib/currency.server";
import type { Product, ProductVariant } from "@/types/product.types";
import type { Invoice } from "@/types/invoice.types";
import type {
  Warehouse,
  WarehouseAvailability,
} from "@/types/warehouse.types";
import { SaleDetailClient } from "./SaleDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SaleDetailPage({ params }: PageProps) {
  const { id } = await params;

  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "sales.view")) redirect("/dashboard");

  const sale = await fetchSaleById(id);
  if (!sale) notFound();

  let products: Product[] = [];
  let variantsByProduct: Record<string, ProductVariant[]> = {};
  let availabilityByWarehouse: WarehouseAvailability = {};
  let warehouses: Warehouse[] = [];
  try {
    const [picker, warehouseList] = await Promise.all([
      fetchProductsForPicker(),
      fetchWarehouses(),
    ]);
    products = picker.products;
    variantsByProduct = picker.variantsByProduct;
    availabilityByWarehouse = picker.availabilityByWarehouse;
    warehouses = warehouseList;
  } catch {
    // Picker is only needed for the edit modal; degrade gracefully.
  }

  // Any invoice already generated for this sale (drives the invoice button).
  const canViewInvoices = ctxHasPermission(ctx, "invoices.view");
  let invoice: Invoice | null = null;
  if (canViewInvoices) {
    try {
      invoice = await fetchInvoiceForSale(id);
    } catch {
      // Non-fatal: the button falls back to "generate".
    }
  }

  return (
    <SaleDetailClient
      initialSale={sale}
      products={products}
      variantsByProduct={variantsByProduct}
      warehouses={warehouses}
      userDefaultWarehouseId={ctx.defaultWarehouseId}
      availabilityByWarehouse={availabilityByWarehouse}
      invoice={invoice}
      currency={await getActiveCurrency()}
      can={{
        edit: ctxHasPermission(ctx, "sales.edit"),
        delete: ctxHasPermission(ctx, "sales.delete"),
        viewInvoice: canViewInvoices,
        generateInvoice: ctxHasPermission(ctx, "invoices.generate"),
        // Collecting a due is the same grant as taking money at the counter.
        recordPayment: ctxHasPermission(ctx, "sales.create"),
      }}
    />
  );
}
