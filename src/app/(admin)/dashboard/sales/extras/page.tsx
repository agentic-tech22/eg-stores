import { redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import { getActiveCurrency } from "@/lib/currency.server";
import { fetchSales } from "@/services/sale.service";
import type { Sale } from "@/types/sale.types";
import { ExtraSalesManager } from "./ExtraSalesManager";

export default async function ExtraSalesPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "sales.view")) redirect("/dashboard");

  let sales: Sale[] = [];
  try {
    // Extra lines are joined onto every sale read, so the same fetch the sales
    // list uses already carries everything this page needs.
    sales = await fetchSales();
  } catch {
    // Fall back to empty data on read failure.
  }

  return (
    <ExtraSalesManager
      initialSales={sales}
      currency={await getActiveCurrency()}
    />
  );
}
