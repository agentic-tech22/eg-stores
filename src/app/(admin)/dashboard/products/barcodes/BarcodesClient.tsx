"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Plus, Printer, Search, Trash2 } from "lucide-react";
import { PageHeader } from "@/components/molecules/admin";
import { Select } from "@/components/molecules/form";
import { useConfirm } from "@/components/molecules/confirm-dialog/confirm-context";
import { notify } from "@/lib/toast";
import { formatCurrency } from "@/utils/format-currency";
import { fetchBarcodeItems, markBarcodesPrinted } from "@/services/product.service";
import type { BarcodeLabel } from "@/types/product.types";
import { Barcode } from "./Barcode";

type PrintedFilter = "all" | "printed" | "unprinted";
type DateRange = "all" | "today" | "7d" | "30d";

const DATE_RANGES: { value: DateRange; label: string }[] = [
  { value: "all", label: "Any time" },
  { value: "today", label: "Added today" },
  { value: "7d", label: "Added in last 7 days" },
  { value: "30d", label: "Added in last 30 days" },
];

const PRINTED_FILTERS: { value: PrintedFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "unprinted", label: "Not printed" },
  { value: "printed", label: "Printed" },
];

interface BarcodesClientProps {
  currency: { code: string; locale: string };
  /** Most-recently-added products, shown before any search/filter is applied. */
  recent: BarcodeLabel[];
}

interface QueueEntry {
  label: BarcodeLabel;
  copies: number;
}

// Cap generous enough that "one label per piece in stock" is never clamped for
// a normal catalog, while still guarding against a runaway print run.
const MAX_COPIES = 999;

/**
 * Printed width of one barcode module, in millimetres. Must stay a whole number
 * of printer dots or the symbol stops scanning: at 203dpi one dot is 0.125mm, so
 * 0.25mm is exactly 2 dots. Raise it to 0.375mm (3 dots) if your scanner still
 * struggles and your codes are short enough to fit.
 */
const PRINT_MODULE_MM = 0.25;

/** Default copies for a freshly-queued label: one per piece on hand (min 1). */
function defaultCopies(label: BarcodeLabel) {
  return Math.min(MAX_COPIES, Math.max(1, label.stock));
}

/** "12 Jun 2026" style short date for the printed badge. */
function formatPrintedDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Translate a date-added range into an ISO lower bound on created_at. */
function sinceForRange(range: DateRange): string | null {
  if (range === "all") return null;
  const now = new Date();
  if (range === "today") {
    return new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    ).toISOString();
  }
  const days = range === "7d" ? 7 : 30;
  return new Date(now.getTime() - days * 86_400_000).toISOString();
}

export function BarcodesClient({
  currency,
  recent: initialRecent,
}: BarcodesClientProps) {
  const [query, setQuery] = useState("");
  const [printed, setPrinted] = useState<PrintedFilter>("all");
  const [dateRange, setDateRange] = useState<DateRange>("all");
  const [items, setItems] = useState<BarcodeLabel[]>(initialRecent);
  const [loading, setLoading] = useState(false);
  const [queue, setQueue] = useState<QueueEntry[]>([]);
  const reqId = useRef(0);
  const firstRun = useRef(true);
  const confirm = useConfirm();

  const money = (n: number) => formatCurrency(n, currency.code, currency.locale);

  const isDefaultView =
    query.trim() === "" && printed === "all" && dateRange === "all";

  // Debounced, race-safe fetch on any search/filter change: only the latest
  // request wins. The SSR-provided list already matches the default view, so
  // the first mount is skipped to avoid a redundant refetch.
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setLoading(true);
    const id = ++reqId.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetchBarcodeItems({
          search: query.trim(),
          printed,
          since: sinceForRange(dateRange),
        });
        if (id === reqId.current) setItems(res);
      } catch {
        if (id === reqId.current) {
          setItems([]);
          notify.error("Couldn't load products. Please try again.");
        }
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, printed, dateRange]);

  const queued = new Set(queue.map((q) => q.label.code));

  function addToQueue(label: BarcodeLabel) {
    setQueue((prev) =>
      prev.some((q) => q.label.code === label.code)
        ? prev
        : [...prev, { label, copies: defaultCopies(label) }],
    );
  }

  function setCopies(code: string, copies: number) {
    setQueue((prev) =>
      prev.map((q) =>
        q.label.code === code
          ? { ...q, copies: Math.min(MAX_COPIES, Math.max(1, copies)) }
          : q,
      ),
    );
  }

  function removeFromQueue(code: string) {
    setQueue((prev) => prev.filter((q) => q.label.code !== code));
  }

  // The printable sheet: each queued label repeated by its copy count.
  const sheet = queue.flatMap((q) =>
    Array.from({ length: q.copies }, () => q.label),
  );
  // Stamp every queued code as printed and reflect it in the badges (the queue
  // rows plus any matching cards still on screen).
  async function markQueuePrinted() {
    const codes = [...new Set(queue.map((q) => q.label.code))];
    try {
      const { printedAt } = await markBarcodesPrinted(codes);
      const mark = <T extends BarcodeLabel>(l: T): T =>
        codes.includes(l.code) ? { ...l, printedAt } : l;
      setQueue((prev) => prev.map((q) => ({ ...q, label: mark(q.label) })));
      setItems((prev) => prev.map(mark));
    } catch {
      notify.error("Printed, but couldn't save the printed status.");
    }
  }

  // Open the print dialog, then flag the labels as printed. Browsers don't
  // report whether the user actually printed or hit Cancel (both resolve
  // window.print() and fire "afterprint" identically), so we confirm with the
  // user once the dialog closes and only stamp them on an explicit "yes".
  function handlePrint() {
    if (sheet.length === 0) return;

    const onAfterPrint = () => {
      window.removeEventListener("afterprint", onAfterPrint);
      // Defer so the browser finishes tearing down the print dialog before the
      // modal opens.
      window.setTimeout(async () => {
        const printed = await confirm({
          title: "Labels printed?",
          description:
            "Did the labels print correctly? Confirm to mark them as printed, or cancel if the print was cancelled or failed.",
          confirmLabel: "Mark as printed",
          cancelLabel: "Not printed",
        });
        if (printed) void markQueuePrinted();
      }, 0);
    };

    window.addEventListener("afterprint", onAfterPrint);
    window.print();
  }

  // One selectable catalog card, reused for both search results and the recent
  // list. Clicking Add drops the label into the print queue.
  function renderCard(label: BarcodeLabel) {
    const isQueued = queued.has(label.code);
    return (
      <div
        key={label.code}
        className="flex items-center gap-3 rounded-xl border border-admin-border bg-admin-surface p-3"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-admin-text">
            {label.title}
          </p>
          {label.variantLabel && (
            <p className="truncate text-[11px] text-admin-text-muted">
              {label.variantLabel}
            </p>
          )}
          <p className="truncate font-mono text-[10px] text-admin-text-muted">
            {label.code} · {money(label.price)} · {label.stock} in stock
          </p>
          {label.printedAt && (
            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-admin-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-admin-accent">
              <Check className="h-3 w-3" />
              Printed {formatPrintedDate(label.printedAt)}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => addToQueue(label)}
          disabled={isQueued}
          aria-label={isQueued ? "Already added" : `Add ${label.title}`}
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 data-[added=true]:text-admin-accent"
          data-added={isQueued}
        >
          {isQueued ? (
            <>
              <Check className="h-4 w-4" /> Added
            </>
          ) : (
            <>
              <Plus className="h-4 w-4" /> Add
            </>
          )}
        </button>
      </div>
    );
  }

  return (
    <div>
      {/* Screen UI (hidden when printing) */}
      <div className="print:hidden">
        <PageHeader
          eyebrow="Catalog"
          title="Barcodes"
          description="Search products, build a print list, and print scannable barcode labels."
          actions={
            <button
              type="button"
              onClick={handlePrint}
              disabled={sheet.length === 0}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-admin-accent-hover disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Printer className="h-4 w-4" strokeWidth={2.5} />
              Print {sheet.length > 0 && `(${sheet.length})`}
            </button>
          }
        />

        {/* Search */}
        <div className="mb-3 flex items-center gap-2 rounded-2xl border border-admin-border bg-admin-surface px-4">
          <Search className="h-4 w-4 shrink-0 text-admin-text-muted" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by product name, SKU, or barcode..."
            aria-label="Search products"
            autoFocus
            className="w-full bg-transparent py-3.5 text-sm text-admin-text placeholder:text-admin-text-muted focus:outline-none"
          />
        </div>

        {/* Filters: printed status + date added */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl border border-admin-border bg-admin-surface p-0.5">
            {PRINTED_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setPrinted(f.value)}
                aria-pressed={printed === f.value}
                className="rounded-lg px-3 py-1.5 text-xs font-bold text-admin-text-muted transition-colors aria-pressed:bg-admin-accent aria-pressed:text-white"
              >
                {f.label}
              </button>
            ))}
          </div>
          <Select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            aria-label="Filter by date added"
            className="w-auto text-xs font-bold"
          >
            {DATE_RANGES.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
          {!isDefaultView && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setPrinted("all");
                setDateRange("all");
              }}
              className="text-xs font-bold text-admin-text-muted transition-colors hover:text-admin-text"
            >
              Clear
            </button>
          )}
        </div>

        {/* Results (defaults to the most recently added products) */}
        <div className="mb-8">
          {isDefaultView && items.length > 0 && (
            <p className="mb-2 px-1 text-xs font-bold uppercase tracking-wide text-admin-text-muted">
              Recently added
            </p>
          )}
          {loading ? (
            <p className="px-1 py-4 text-sm text-admin-text-muted">Loading…</p>
          ) : items.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-admin-border bg-admin-surface px-5 py-10 text-center text-sm text-admin-text-muted">
              {isDefaultView
                ? "No products yet. Add products, then print their barcodes here."
                : "No products match these filters."}
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {items.map(renderCard)}
            </div>
          )}
        </div>

        {/* Print list */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-admin-text">
              Print list{" "}
              <span className="text-admin-text-muted">
                ({sheet.length} label{sheet.length === 1 ? "" : "s"})
              </span>
            </h2>
            {queue.length > 0 && (
              <button
                type="button"
                onClick={() => setQueue([])}
                className="text-xs font-bold text-admin-danger/70 transition-colors hover:text-admin-danger"
              >
                Clear all
              </button>
            )}
          </div>

          {queue.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-admin-border bg-admin-surface px-5 py-10 text-center text-sm text-admin-text-muted">
              Nothing to print yet. Add products from the search above.
            </p>
          ) : (
            <div className="divide-y divide-admin-border overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
              {queue.map((entry) => (
                <div
                  key={entry.label.code}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <div className="hidden shrink-0 rounded-md border border-admin-border bg-white p-1 sm:block">
                    <Barcode
                      value={entry.label.code}
                      height={32}
                      moduleWidth={2}
                      quietZone={10}
                      className="h-8 w-auto"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-admin-text">
                      {entry.label.title}
                      {entry.label.variantLabel && (
                        <span className="font-normal text-admin-text-muted">
                          {" "}
                          · {entry.label.variantLabel}
                        </span>
                      )}
                    </p>
                    <p className="truncate font-mono text-[10px] text-admin-text-muted">
                      {entry.label.code} · {money(entry.label.price)}
                    </p>
                    {entry.label.printedAt && (
                      <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-admin-accent/10 px-1.5 py-0.5 text-[10px] font-bold text-admin-accent">
                        <Check className="h-3 w-3" />
                        Printed {formatPrintedDate(entry.label.printedAt)}
                      </span>
                    )}
                  </div>
                  <label className="flex shrink-0 items-center gap-1.5 text-[11px] text-admin-text-muted">
                    Copies
                    <input
                      type="number"
                      min={1}
                      max={MAX_COPIES}
                      value={entry.copies}
                      onChange={(e) => {
                        const n = parseInt(e.target.value, 10);
                        setCopies(entry.label.code, Number.isNaN(n) ? 1 : n);
                      }}
                      aria-label={`Copies of ${entry.label.title}`}
                      className="w-14 rounded-lg border border-admin-border bg-admin-input px-2 py-1 text-center text-sm font-bold text-admin-text focus:outline-none"
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => removeFromQueue(entry.label.code)}
                    aria-label={`Remove ${entry.label.title}`}
                    className="shrink-0 rounded-lg p-2 text-admin-danger/60 transition-colors hover:bg-admin-danger/10 hover:text-admin-danger"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Print-only sheet: each label repeated by its copy count. Geometry lives
          in the `@media print` block in globals.css: 34 x 20 mm cells, three to
          a row, no gaps, and one page per row so the roll advances a row at a
          time. */}
      <div className="barcode-sheet hidden print:grid">
        {sheet.map((label, i) => (
          <div key={`${label.code}-${i}`} className="barcode-label">
            <p className="barcode-label-title" title={label.title}>
              {label.title}
            </p>
            {label.variantLabel && (
              <p className="barcode-label-variant">{label.variantLabel}</p>
            )}
            <div className="barcode-label-code">
              {/* 0.25mm per module = exactly 2 dots on a 203dpi thermal head, so
                  every bar edge lands on a dot boundary. An 8-digit code comes
                  out 24.75mm wide, well inside the 33mm of usable label. */}
              <Barcode value={label.code} moduleMm={PRINT_MODULE_MM} />
            </div>
            <p className="barcode-label-value">{label.code}</p>
            <p className="barcode-label-price">{money(label.price)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
