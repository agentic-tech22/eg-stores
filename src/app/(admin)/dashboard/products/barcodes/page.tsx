import { redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import { getActiveCurrency } from "@/lib/currency.server";
import { fetchBarcodeItems } from "@/services/product.service";
import { BarcodesClient } from "./BarcodesClient";

export default async function BarcodesPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "products.view")) redirect("/dashboard");

  // Search fetches labels on demand (the catalog can be huge), but we preload a
  // short list of the most recently added products so the common "print the
  // label for the product I just created" flow needs no typing.
  const [currency, recent] = await Promise.all([
    getActiveCurrency(),
    fetchBarcodeItems(),
  ]);
  return <BarcodesClient currency={currency} recent={recent} />;
}
