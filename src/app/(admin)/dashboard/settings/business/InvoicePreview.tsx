"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { resolveCurrency } from "@/lib/currency";
import {
  formatInvoiceNumber,
  type BusinessProfile,
  type Invoice,
} from "@/types/invoice.types";
import { InvoiceTemplate } from "../../invoices/InvoiceTemplate";

/** Fallback width (80 mm at 96 dpi) used before the receipt has been measured. */
const FALLBACK_WIDTH = 302;

interface InvoicePreviewProps {
  shopName: string;
  address: string;
  phone: string;
  email: string;
  taxId: string;
  logoUrl: string;
  currency: string;
  invoicePrefix: string;
  invoiceFooter: string;
  /** Counter from the saved profile, so the sample number matches what's next. */
  nextInvoiceNumber: number;
}

const SAMPLE_ITEMS = [
  {
    productTitle: "Cotton T-Shirt",
    variantLabel: "Medium / Black",
    quantity: 2,
    unitPrice: 1200,
  },
  {
    productTitle: "Canvas Tote Bag",
    variantLabel: null,
    quantity: 1,
    unitPrice: 850,
  },
  {
    productTitle: "Leather Belt",
    variantLabel: "34 in",
    quantity: 1,
    unitPrice: 1950,
  },
];

const SAMPLE_SUBTOTAL = SAMPLE_ITEMS.reduce(
  (sum, it) => sum + it.quantity * it.unitPrice,
  0,
);
const SAMPLE_DISCOUNT = 200;

/** Today's date, resolved on the client only (the server's date may differ) and
 * memoised so `useSyncExternalStore` sees a stable snapshot. */
let cachedToday: string | null = null;
const subscribeToNothing = () => () => {};
function getToday(): string {
  cachedToday ??= new Date().toISOString().slice(0, 10);
  return cachedToday;
}

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Live preview of the invoice header/footer built from the unsaved form state.
 * Renders the real `InvoiceTemplate` against sample line items so what the user
 * sees here is exactly what gets printed, then scales the full-width document
 * down to fit the side column.
 */
export function InvoicePreview(props: InvoicePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const documentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState(0);
  // Null while server-rendering/hydrating, then today's date on the client.
  const issueDate = useSyncExternalStore(
    subscribeToNothing,
    getToday,
    () => null,
  );

  useEffect(() => {
    const container = containerRef.current;
    const doc = documentRef.current;
    if (!container || !doc) return;

    const measure = () => {
      // The receipt sets its own physical width (80 mm), so read it back rather
      // than assuming a pixel size; `offsetWidth` ignores the transform.
      const docWidth = doc.offsetWidth || FALLBACK_WIDTH;
      const next = Math.min(1, container.clientWidth / docWidth);
      setScale(next);
      setHeight(doc.offsetHeight * next);
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    observer.observe(doc);
    return () => observer.disconnect();
  }, []);

  const profile: BusinessProfile = {
    shopName: props.shopName.trim() || "Your Business",
    address: props.address.trim() || null,
    phone: props.phone.trim() || null,
    email: props.email.trim() || null,
    taxId: props.taxId.trim() || null,
    logoUrl: props.logoUrl || null,
    currency: props.currency,
    invoicePrefix: props.invoicePrefix,
    invoiceFooter: props.invoiceFooter.trim() || null,
    nextInvoiceNumber: props.nextInvoiceNumber,
    loyaltyEnabled: false,
    loyaltyEarnMode: "percent",
    loyaltyEarnRate: 0,
    updatedAt: "",
  };

  const invoice: Invoice = {
    id: "preview",
    saleId: "preview",
    invoiceNumber: formatInvoiceNumber(
      props.invoicePrefix.trim() || "INV",
      props.nextInvoiceNumber,
    ),
    issueDate: issueDate ?? "",
    dueDate: issueDate ? addDays(issueDate, 7) : null,
    status: "issued",
    subtotal: SAMPLE_SUBTOTAL,
    discountAmount: SAMPLE_DISCOUNT,
    totalAmount: SAMPLE_SUBTOTAL - SAMPLE_DISCOUNT,
    customerName: "Sample Customer",
    customerPhone: "+977 98XXXXXXXX",
    notes: null,
    createdAt: "",
    updatedAt: "",
    items: SAMPLE_ITEMS.map((it, i) => ({
      id: `preview-${i}`,
      invoiceId: "preview",
      productTitle: it.productTitle,
      variantLabel: it.variantLabel,
      sku: null,
      quantity: it.quantity,
      unitPrice: it.unitPrice,
      lineTotal: it.quantity * it.unitPrice,
      sortOrder: i,
      createdAt: "",
    })),
  };

  return (
    <div className="border-admin-border bg-admin-surface rounded-2xl border p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <p className="text-admin-text-muted text-[11px] font-bold tracking-[0.15em] uppercase">
          Invoice preview
        </p>
        <span className="bg-admin-accent/10 text-admin-accent rounded-full px-2 py-0.5 text-[10px] font-bold tracking-wide uppercase">
          80 mm receipt
        </span>
      </div>

      <div className="border-admin-border rounded-xl border bg-admin-bg p-3">
        <div
          ref={containerRef}
          className="flex justify-center overflow-hidden"
          style={{ height: height ? `${height}px` : undefined }}
        >
          <div
            ref={documentRef}
            className="origin-top shadow-sm"
            style={{ transform: `scale(${scale})` }}
          >
            <InvoiceTemplate
              invoice={invoice}
              profile={profile}
              currency={resolveCurrency(props.currency)}
            />
          </div>
        </div>
      </div>

      <p className="text-admin-text-muted mt-3 text-xs">
        Shown at actual size for 80 mm thermal paper. Line items, customer and
        dates are placeholders; your shop details, logo, currency, numbering and
        footer update as you type.
      </p>
    </div>
  );
}
