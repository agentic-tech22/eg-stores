import { notFound, redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import {
  fetchBusinessProfile,
  fetchInvoiceById,
} from "@/services/invoice.service";
import { getActiveCurrency } from "@/lib/currency.server";
import type { BusinessProfile } from "@/types/invoice.types";
import { InvoiceDetailClient } from "./InvoiceDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function InvoiceDetailPage({ params }: PageProps) {
  const { id } = await params;

  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "invoices.view")) redirect("/dashboard");

  const invoice = await fetchInvoiceById(id);
  if (!invoice) notFound();

  let profile: BusinessProfile | null = null;
  try {
    profile = await fetchBusinessProfile();
  } catch {
    // Header degrades gracefully if the profile can't be read.
  }

  return (
    <InvoiceDetailClient
      initialInvoice={invoice}
      profile={profile}
      currency={await getActiveCurrency()}
      can={{
        edit: ctxHasPermission(ctx, "invoices.edit"),
        delete: ctxHasPermission(ctx, "invoices.delete"),
      }}
    />
  );
}
