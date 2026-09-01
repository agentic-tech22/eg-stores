import { notFound, redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import { getActiveCurrency } from "@/lib/currency.server";
import {
  fetchCustomer,
  fetchCustomerSales,
  fetchLoyaltyTransactions,
} from "@/services/customer.service";
import type {
  CustomerSale,
  LoyaltyTransaction,
} from "@/types/customer.types";
import { CustomerDetailClient } from "./CustomerDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CustomerDetailPage({ params }: PageProps) {
  const { id } = await params;

  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "customers.view")) redirect("/dashboard");

  const customer = await fetchCustomer(id);
  if (!customer) notFound();

  let transactions: LoyaltyTransaction[] = [];
  let sales: CustomerSale[] = [];
  try {
    [transactions, sales] = await Promise.all([
      fetchLoyaltyTransactions(id),
      fetchCustomerSales(id),
    ]);
  } catch {
    // Non-fatal: show the customer with an empty ledger / history.
  }

  return (
    <CustomerDetailClient
      customer={customer}
      initialTransactions={transactions}
      sales={sales}
      currency={await getActiveCurrency()}
      can={{ edit: ctxHasPermission(ctx, "customers.edit") }}
    />
  );
}
