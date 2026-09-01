"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Building2,
  ChevronRight,
  FileText,
  Search,
} from "lucide-react";
import { useInvoices } from "@/hooks/invoices/use-invoices";
import {
  EmptyState,
  PageHeader,
  Pagination,
  StatCard,
  TableRowsSkeleton,
} from "@/components/molecules/admin";
import {
  INVOICE_STATUSES,
  type Invoice,
  type InvoiceStatus,
} from "@/types/invoice.types";
import { formatCurrency } from "@/utils/format-currency";
import { InvoiceStatusBadge } from "./status-badge";

const ITEMS_PER_PAGE = 10;

interface InvoicesManagerProps {
  initialInvoices: Invoice[];
  currency: { code: string; locale: string };
  can: { manageBusiness: boolean };
}

export function InvoicesManager({
  initialInvoices,
  currency,
  can,
}: InvoicesManagerProps) {
  const { data: invoices, isFetching } = useInvoices(initialInvoices);

  const [filterText, setFilterText] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "">("");
  const [currentPage, setCurrentPage] = useState(1);

  const money = (n: number) =>
    formatCurrency(n, currency.code, currency.locale);

  const paidCount = invoices.filter((i) => i.status === "paid").length;
  const outstanding = invoices
    .filter((i) => i.status === "issued")
    .reduce((sum, i) => sum + i.totalAmount, 0);

  const filtered = useMemo(() => {
    let rows = invoices;
    if (statusFilter) rows = rows.filter((i) => i.status === statusFilter);
    if (filterText.trim()) {
      const q = filterText.toLowerCase();
      rows = rows.filter(
        (i) =>
          i.invoiceNumber.toLowerCase().includes(q) ||
          (i.customerName?.toLowerCase().includes(q) ?? false) ||
          (i.customerPhone?.toLowerCase().includes(q) ?? false),
      );
    }
    return rows;
  }, [invoices, statusFilter, filterText]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  function resetPage() {
    setCurrentPage(1);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Billing"
        title="Invoices"
        description="Issue invoices from sales, track payment, and print or share them."
        actions={
          can.manageBusiness && (
            <Link
              href="/dashboard/settings/business"
              className="flex cursor-pointer items-center gap-2 rounded-xl border border-admin-border px-4 py-2.5 text-sm font-bold text-admin-text transition-colors hover:bg-admin-card"
            >
              <Building2 className="h-4 w-4" />
              Business profile
            </Link>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatCard label="Invoices" value={invoices.length} icon={FileText} />
        <StatCard label="Paid" value={paidCount} icon={FileText} tone="emerald" />
        <StatCard
          label="Outstanding"
          value={money(outstanding)}
          icon={FileText}
          tone="amber"
        />
      </div>

      <div className="mb-6 flex h-11 items-center gap-2 rounded-xl border border-admin-border bg-admin-surface px-3.5">
        <Search className="h-4 w-4 shrink-0 text-admin-text-muted" />
        <input
          type="text"
          value={filterText}
          onChange={(e) => {
            setFilterText(e.target.value);
            resetPage();
          }}
          placeholder="Search by # or customer..."
          aria-label="Search invoices"
          className="h-full w-full bg-transparent text-sm text-admin-text placeholder:text-admin-text-muted focus:outline-none"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setStatusFilter("");
            resetPage();
          }}
          className={statusPill(statusFilter === "")}
        >
          All
        </button>
        {INVOICE_STATUSES.map((s) => (
          <button
            key={s.value}
            type="button"
            onClick={() => {
              setStatusFilter(s.value);
              resetPage();
            }}
            className={statusPill(statusFilter === s.value)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Open a sale and generate an invoice to see it here."
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
          <div className="hidden border-b border-admin-border bg-admin-card/40 px-5 py-3 sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
            <p className="col-span-1 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">S.N</p>
            <p className="col-span-3 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Invoice #</p>
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Customer</p>
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Date</p>
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Status</p>
            <p className="col-span-1 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Total</p>
            <p className="col-span-1 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">View</p>
          </div>

          {isFetching && invoices.length === 0 ? (
            <TableRowsSkeleton />
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-admin-text-muted">
              No invoices match the current filters.
            </div>
          ) : (
            <div className="divide-y divide-admin-border">
              {paginated.map((invoice, i) => (
                <Link
                  key={invoice.id}
                  href={`/dashboard/invoices/${invoice.id}`}
                  className="grid cursor-pointer grid-cols-1 gap-2 px-5 py-3.5 transition-colors hover:bg-admin-card/30 sm:grid-cols-12 sm:items-center sm:gap-4"
                >
                  <div className="col-span-1 text-sm font-bold text-admin-text-muted">
                    {(safePage - 1) * ITEMS_PER_PAGE + i + 1}
                  </div>
                  <div className="col-span-3 text-sm font-bold text-admin-text">
                    {invoice.invoiceNumber}
                  </div>
                  <div className="col-span-2 min-w-0">
                    <p className="truncate text-sm text-admin-text">
                      {invoice.customerName ?? "Walk-in customer"}
                    </p>
                  </div>
                  <div className="col-span-2 text-sm text-admin-text-muted">
                    {invoice.issueDate.slice(0, 10)}
                  </div>
                  <div className="col-span-2">
                    <InvoiceStatusBadge status={invoice.status} />
                  </div>
                  <div className="col-span-1 text-sm font-bold text-admin-text">
                    {money(invoice.totalAmount)}
                  </div>
                  <div className="col-span-1 text-right text-admin-accent">
                    <ChevronRight className="ml-auto h-4 w-4" />
                  </div>
                </Link>
              ))}
            </div>
          )}

          <Pagination
            page={safePage}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={ITEMS_PER_PAGE}
            itemLabel="invoices"
            onPageChange={setCurrentPage}
          />
        </div>
      )}
    </div>
  );
}

function statusPill(active: boolean): string {
  return [
    "rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
    active
      ? "bg-admin-accent text-white"
      : "bg-admin-surface text-admin-text-muted ring-1 ring-admin-border hover:text-admin-text",
  ].join(" ");
}
