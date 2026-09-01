import { notFound, redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import { getActiveCurrency } from "@/lib/currency.server";
import {
  fetchVendor,
  fetchVendorTransactions,
} from "@/services/vendor.service";
import type { VendorTransaction } from "@/types/vendor.types";
import { VendorDetailClient } from "./VendorDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function VendorDetailPage({ params }: PageProps) {
  const { id } = await params;

  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "vendors.view")) redirect("/dashboard");

  const vendor = await fetchVendor(id);
  if (!vendor) notFound();

  let transactions: VendorTransaction[] = [];
  try {
    transactions = await fetchVendorTransactions(id);
  } catch {
    // Non-fatal: show the vendor with an empty ledger.
  }

  return (
    <VendorDetailClient
      vendor={vendor}
      initialTransactions={transactions}
      currency={await getActiveCurrency()}
      can={{ edit: ctxHasPermission(ctx, "vendors.edit") }}
    />
  );
}
