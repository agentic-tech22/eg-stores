import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { getActiveCurrency } from "@/lib/currency.server";
import { ExportDataClient } from "./ExportDataClient";

export default async function ExportDataPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  // Bulk egress of the shop's books is admin-only — the per-resource `*.view`
  // grants a cashier holds deliberately don't reach this screen.
  if (!ctx.isAdmin) redirect("/dashboard");

  // Nothing is read here: a dataset is only queried once its button is pressed.
  return <ExportDataClient currency={await getActiveCurrency()} />;
}
