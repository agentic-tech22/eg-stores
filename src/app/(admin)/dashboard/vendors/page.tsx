import { redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import { getActiveCurrency } from "@/lib/currency.server";
import { fetchVendorPurchases, fetchVendors } from "@/services/vendor.service";
import type { VendorPurchase, VendorWithBalance } from "@/types/vendor.types";
import { VendorManager } from "./VendorManager";

export default async function VendorsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "vendors.view")) redirect("/dashboard");

  let vendors: VendorWithBalance[] = [];
  let purchases: VendorPurchase[] = [];
  try {
    [vendors, purchases] = await Promise.all([
      fetchVendors(),
      fetchVendorPurchases(),
    ]);
  } catch {
    // Fallback to empty lists on read failure.
  }

  const can = {
    create: ctxHasPermission(ctx, "vendors.create"),
    edit: ctxHasPermission(ctx, "vendors.edit"),
    delete: ctxHasPermission(ctx, "vendors.delete"),
  };

  return (
    <div>
      <VendorManager
        initialVendors={vendors}
        initialPurchases={purchases}
        currency={await getActiveCurrency()}
        can={can}
      />
    </div>
  );
}
