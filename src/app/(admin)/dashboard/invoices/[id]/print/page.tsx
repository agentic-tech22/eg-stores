import { notFound, redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import {
  fetchBusinessProfile,
  fetchInvoiceById,
} from "@/services/invoice.service";
import { getActiveCurrency } from "@/lib/currency.server";
import type { BusinessProfile } from "@/types/invoice.types";
import { InvoiceTemplate } from "../../InvoiceTemplate";
import { AutoPrint } from "../../AutoPrint";

interface PageProps {
  params: Promise<{ id: string }>;
  // `auto=0` renders the invoice WITHOUT firing the print dialog on load: used
  // when this route is embedded in an iframe for an in-app preview (e.g. the POS
  // sale invoice modal), where printing is triggered by an explicit button.
  searchParams: Promise<{ auto?: string }>;
}

export default async function InvoicePrintPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { auto } = await searchParams;

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
    <div className="bg-white">
      {auto !== "0" && <AutoPrint />}
      <InvoiceTemplate
        invoice={invoice}
        profile={profile}
        currency={await getActiveCurrency()}
      />
    </div>
  );
}
