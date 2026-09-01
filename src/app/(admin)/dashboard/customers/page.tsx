import { redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import { fetchCustomers } from "@/services/customer.service";
import { fetchBusinessProfile } from "@/services/invoice.service";
import type { CustomerWithBalance } from "@/types/customer.types";
import { CustomerManager } from "./CustomerManager";

export default async function CustomersPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "customers.view")) redirect("/dashboard");

  let customers: CustomerWithBalance[] = [];
  try {
    customers = await fetchCustomers();
  } catch {
    // Fallback to an empty list on read failure.
  }

  // Only used to title the printable membership QR card, so a missing profile
  // is not worth failing the page over.
  let shopName: string | null = null;
  try {
    shopName = (await fetchBusinessProfile())?.shopName ?? null;
  } catch {
    // Leave the card with its generic heading.
  }

  const can = {
    create: ctxHasPermission(ctx, "customers.create"),
    edit: ctxHasPermission(ctx, "customers.edit"),
    delete: ctxHasPermission(ctx, "customers.delete"),
  };

  return (
    <div>
      <CustomerManager
        initialCustomers={customers}
        can={can}
        shopName={shopName}
      />
    </div>
  );
}
