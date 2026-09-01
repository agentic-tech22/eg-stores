import { redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import { getActiveCurrency } from "@/lib/currency.server";
import { fetchSales } from "@/services/sale.service";
import { fetchWarehouses } from "@/services/warehouse.service";
import type { Sale } from "@/types/sale.types";
import type { Warehouse } from "@/types/warehouse.types";
import { AnalyticsClient } from "./AnalyticsClient";

export default async function AnalyticsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  // Analytics reads sales, so it shares the sales view permission.
  if (!ctxHasPermission(ctx, "sales.view")) redirect("/dashboard");

  let sales: Sale[] = [];
  let warehouses: Warehouse[] = [];
  try {
    [sales, warehouses] = await Promise.all([fetchSales(), fetchWarehouses()]);
  } catch {
    // Fall back to empty data on read failure.
  }

  return (
    <AnalyticsClient
      initialSales={sales}
      warehouses={warehouses}
      currency={await getActiveCurrency()}
    />
  );
}
