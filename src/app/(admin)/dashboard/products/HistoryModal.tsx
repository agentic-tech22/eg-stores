"use client";

import { ArrowRight, Clock, PackagePlus, Tag } from "lucide-react";
import { Modal } from "@/components/molecules/modal/Modal";
import { useProductHistory } from "@/hooks/products/use-restock";
import { formatCurrency } from "@/utils/format-currency";
import type { PriceChange, Product, StockEntry } from "@/types/product.types";

interface HistoryModalProps {
  product: Product;
  currency: { code: string; locale: string };
  onClose: () => void;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

/**
 * Read-only view of a product's restock ledger and price-change history. Cost
 * figures are already redacted server-side for non-finance callers.
 */
export function HistoryModal({ product, currency, onClose }: HistoryModalProps) {
  const { data, isLoading } = useProductHistory(product.id, true);

  const restocks = data?.restocks ?? [];
  const priceChanges = data?.priceChanges ?? [];

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="lg"
      title="Product history"
      description={`Restocks and price changes for ${product.title}.`}
    >
      {isLoading ? (
        <p className="py-8 text-center text-sm text-admin-text-muted">
          Loading history...
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          <HistorySection
            icon={PackagePlus}
            title="Restock history"
            count={restocks.length}
            emptyText="No restocks recorded yet."
          >
            {restocks.map((entry) => (
              <RestockRow key={entry.id} entry={entry} currency={currency} />
            ))}
          </HistorySection>

          <HistorySection
            icon={Tag}
            title="Price changes"
            count={priceChanges.length}
            emptyText="No price changes recorded yet."
          >
            {priceChanges.map((change) => (
              <PriceRow key={change.id} change={change} currency={currency} />
            ))}
          </HistorySection>
        </div>
      )}
    </Modal>
  );
}

function HistorySection({
  icon: Icon,
  title,
  count,
  emptyText,
  children,
}: {
  icon: typeof Clock;
  title: string;
  count: number;
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 flex items-center gap-2">
        <Icon className="h-4 w-4 text-admin-text-muted" />
        <h3 className="text-sm font-bold text-admin-text">{title}</h3>
        <span className="rounded-full bg-admin-card px-2 py-0.5 text-[10px] font-bold text-admin-text-muted">
          {count}
        </span>
      </div>
      {count === 0 ? (
        <p className="rounded-xl border border-dashed border-admin-border px-4 py-6 text-center text-xs text-admin-text-muted">
          {emptyText}
        </p>
      ) : (
        <div className="divide-y divide-admin-border overflow-hidden rounded-xl border border-admin-border">
          {children}
        </div>
      )}
    </section>
  );
}

function RestockRow({
  entry,
  currency,
}: {
  entry: StockEntry;
  currency: { code: string; locale: string };
}) {
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-admin-text">
          +{entry.quantity} unit{entry.quantity === 1 ? "" : "s"}
        </p>
        {entry.note && (
          <p className="truncate text-[11px] text-admin-text-muted">{entry.note}</p>
        )}
        <p className="mt-0.5 text-[11px] text-admin-text-muted">
          {formatDateTime(entry.createdAt)}
          {entry.createdByEmail ? ` · ${entry.createdByEmail}` : ""}
        </p>
      </div>
      {entry.unitCost != null && (
        <div className="shrink-0 text-right">
          <p className="text-sm font-bold text-admin-text">
            {formatCurrency(entry.unitCost, currency.code, currency.locale)}
          </p>
          <p className="text-[10px] uppercase tracking-wide text-admin-text-muted">
            per unit
          </p>
        </div>
      )}
    </div>
  );
}

function PriceRow({
  change,
  currency,
}: {
  change: PriceChange;
  currency: { code: string; locale: string };
}) {
  const label = change.field === "price" ? "Selling price" : "Cost price";
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-admin-text">{label}</p>
        <p className="mt-0.5 text-[11px] text-admin-text-muted">
          {formatDateTime(change.createdAt)}
          {change.createdByEmail ? ` · ${change.createdByEmail}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-sm font-bold">
        <span className="text-admin-text-muted line-through">
          {change.oldValue != null
            ? formatCurrency(change.oldValue, currency.code, currency.locale)
            : "N/A"}
        </span>
        <ArrowRight className="h-3.5 w-3.5 text-admin-text-muted" />
        <span className="text-admin-text">
          {formatCurrency(change.newValue, currency.code, currency.locale)}
        </span>
      </div>
    </div>
  );
}
