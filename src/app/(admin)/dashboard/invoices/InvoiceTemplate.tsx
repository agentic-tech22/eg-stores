import type { BusinessProfile, Invoice } from "@/types/invoice.types";
import { cn } from "@/utils/cn";
import { formatCurrency } from "@/utils/format-currency";

interface InvoiceTemplateProps {
  invoice: Invoice;
  profile: BusinessProfile | null;
  currency: { code: string; locale: string };
}

/** Full-width dashed rule, the receipt's section separator. */
function Rule({ solid = false }: { solid?: boolean }) {
  return (
    <div
      className={cn(
        "my-[1.5mm] border-t border-black",
        !solid && "border-dashed",
      )}
    />
  );
}

/** Label on the left, value on the right, both on one line. */
function Row({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-baseline justify-between gap-2",
        bold && "font-bold",
      )}
    >
      <span className="shrink-0">{label}</span>
      <span className="text-right tabular-nums">{value}</span>
    </div>
  );
}

/**
 * Print-ready invoice, laid out as an 80 mm thermal receipt (72 mm of content
 * inside 4 mm side margins). Widths are in millimetres so the on-screen render
 * is physically the same size as the paper; type is black-on-white only, since
 * thermal heads print no colour and dither greys badly.
 *
 * The `invoice-receipt` class binds this element to the named `@page receipt`
 * rule in globals.css, which sets the 80 mm continuous page size.
 */
export function InvoiceTemplate({
  invoice,
  profile,
  currency,
}: InvoiceTemplateProps) {
  const money = (n: number) =>
    formatCurrency(n, currency.code, currency.locale);
  const items = invoice.items ?? [];
  const totalQty = items.reduce((sum, it) => sum + it.quantity, 0);
  const contact = [profile?.phone, profile?.email].filter(Boolean).join(" · ");

  return (
    <div className="invoice-receipt mx-auto w-[80mm] bg-white px-[4mm] py-[5mm] text-[11px] leading-snug text-black print:mx-0">
      {/* Shop identity */}
      <div className="text-center">
        {profile?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={profile.logoUrl}
            alt={profile.shopName ?? "Logo"}
            className="mx-auto mb-[2mm] h-[16mm] w-auto max-w-[40mm] object-contain"
          />
        )}
        <p className="text-[15px] font-extrabold uppercase">
          {profile?.shopName ?? "Your Business"}
        </p>
        {profile?.address && (
          <p className="mt-[1mm] text-[10px] whitespace-pre-line">
            {profile.address}
          </p>
        )}
        {contact && <p className="text-[10px]">{contact}</p>}
        {profile?.taxId && (
          <p className="text-[10px]">Tax ID: {profile.taxId}</p>
        )}
      </div>

      <Rule />

      {/* Meta */}
      <div className="space-y-[0.5mm] text-[10px]">
        <Row label="Invoice no." value={invoice.invoiceNumber} />
        <Row label="Date" value={invoice.issueDate.slice(0, 10)} />
        {invoice.dueDate && (
          <Row label="Due date" value={invoice.dueDate.slice(0, 10)} />
        )}
        <Row
          label="Customer"
          value={invoice.customerName ?? "Walk-in customer"}
        />
        {invoice.customerPhone && (
          <Row label="Phone" value={invoice.customerPhone} />
        )}
      </div>

      <Rule solid />

      {/* Line items: title on its own line, then qty × rate against the amount */}
      <div className="flex justify-between text-[9px] font-bold tracking-[0.1em] uppercase">
        <span>Item</span>
        <span>Amount</span>
      </div>
      <Rule solid />

      <div className="space-y-[1.5mm]">
        {items.map((it) => (
          <div key={it.id}>
            <p className="font-semibold break-words">{it.productTitle}</p>
            {it.variantLabel && (
              <p className="text-[10px]">{it.variantLabel}</p>
            )}
            <div className="flex items-baseline justify-between gap-2 tabular-nums">
              <span className="text-[10px]">
                {it.quantity} × {money(it.unitPrice)}
              </span>
              <span className="font-semibold">{money(it.lineTotal)}</span>
            </div>
          </div>
        ))}
      </div>

      <Rule />

      {/* Totals */}
      <div className="space-y-[0.5mm]">
        <Row label={`Items (${items.length})`} value={`Qty ${totalQty}`} />
        <Row label="Subtotal" value={money(invoice.subtotal)} />
        {invoice.discountAmount > 0 && (
          <Row label="Discount" value={`−${money(invoice.discountAmount)}`} />
        )}
      </div>

      <Rule solid />

      <div className="text-[14px]">
        <Row label="TOTAL" value={money(invoice.totalAmount)} bold />
      </div>

      <Rule solid />

      {/* Notes + footer */}
      {invoice.notes && (
        <>
          <p className="text-[9px] font-bold tracking-[0.1em] uppercase">
            Notes
          </p>
          <p className="text-[10px] break-words">{invoice.notes}</p>
          <Rule />
        </>
      )}
      {profile?.invoiceFooter && (
        <p className="mt-[1mm] text-center text-[10px] whitespace-pre-line">
          {profile.invoiceFooter}
        </p>
      )}
    </div>
  );
}
