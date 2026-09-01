import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, Clock, PackagePlus, Repeat, Tag, Trash2 } from "lucide-react";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import {
  fetchProductInventory,
  fetchProductWithVariants,
} from "@/services/product.service";
import { fetchProductHistory } from "@/services/restock.service";
import { fetchBusinessProfile } from "@/services/invoice.service";
import { formatCurrency } from "@/utils/format-currency";
import type { PriceChange, StockEntry } from "@/types/product.types";
import type { StockMovement } from "@/types/warehouse.types";

/** A single normalized entry on the unified history timeline. */
interface TimelineItem {
  key: string;
  at: string;
  icon: typeof Clock;
  tone: string;
  title: string;
  detail: string;
  by: string | null;
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "products.view")) redirect("/dashboard");

  const product = await fetchProductWithVariants(id);
  if (!product) notFound();

  const [inventory, history, profile] = await Promise.all([
    fetchProductInventory(id),
    fetchProductHistory(id),
    fetchBusinessProfile(),
  ]);
  const currency = profile?.currency ?? "NPR";
  const money = (n: number) => formatCurrency(n, currency);

  const timeline = buildTimeline(history.restocks, history.priceChanges, history.movements, money);

  const totalOnHand = inventory.reduce((s, r) => s + r.stockQuantity, 0);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/products"
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-admin-text-muted transition-colors hover:text-admin-text"
      >
        <ArrowLeft className="h-4 w-4" /> Back to products
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {product.imageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={product.imageUrl}
              alt={product.title}
              className="h-16 w-16 rounded-xl object-cover"
            />
          )}
          <div>
            <h1 className="text-xl font-bold text-admin-text">{product.title}</h1>
            <p className="text-sm text-admin-text-muted">
              SKU {product.sku} · {money(product.price)} · {totalOnHand} on hand
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/warehouses/transfers"
            className="inline-flex items-center gap-2 rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-text-secondary transition-colors hover:bg-admin-card"
          >
            <Repeat className="h-4 w-4" /> Transfer
          </Link>
        </div>
      </div>

      {/* Per-warehouse stock breakdown */}
      <section className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
        <div className="border-b border-admin-border bg-admin-card/40 px-5 py-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-admin-text-muted">
            Stock by warehouse
          </h2>
        </div>
        {inventory.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-admin-text-muted">
            No stock recorded in any warehouse yet.
          </p>
        ) : (
          <div className="divide-y divide-admin-border">
            {inventory.map((row) => (
              <div
                key={`${row.warehouseId}-${row.variantId ?? "base"}`}
                className="grid grid-cols-12 items-center gap-4 px-5 py-3"
              >
                <div className="col-span-6 min-w-0">
                  <p className="truncate text-sm font-semibold text-admin-text">
                    {row.warehouseName}
                  </p>
                  {row.variantLabel && (
                    <p className="truncate text-[11px] text-admin-text-muted">{row.variantLabel}</p>
                  )}
                </div>
                <div className="col-span-2 text-sm text-admin-text-secondary">
                  {row.stockQuantity} on hand
                </div>
                <div className="col-span-2 text-sm text-admin-text-muted">
                  {row.reservedQuantity} reserved
                </div>
                <div className="col-span-2 text-right text-sm font-bold text-admin-text">
                  {row.available} free
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Unified history timeline */}
      <section className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
        <div className="border-b border-admin-border bg-admin-card/40 px-5 py-3">
          <h2 className="text-xs font-bold uppercase tracking-[0.15em] text-admin-text-muted">
            History
          </h2>
        </div>
        {timeline.length === 0 ? (
          <p className="px-5 py-6 text-center text-sm text-admin-text-muted">
            No history yet. Restocks, transfers, edits, and price changes appear here.
          </p>
        ) : (
          <div className="divide-y divide-admin-border">
            {timeline.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.key} className="flex items-start gap-3 px-5 py-3.5">
                  <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.tone}`}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-admin-text">{item.title}</p>
                    <p className="text-xs text-admin-text-secondary">{item.detail}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-admin-text-muted">
                      {new Date(item.at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                    {item.by && (
                      <p className="text-[11px] text-admin-text-muted">{item.by}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function buildTimeline(
  restocks: StockEntry[],
  priceChanges: PriceChange[],
  movements: StockMovement[],
  money: (n: number) => string,
): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const r of restocks) {
    items.push({
      key: `restock-${r.id}`,
      at: r.createdAt,
      icon: PackagePlus,
      tone: "bg-emerald-500/10 text-emerald-500",
      title: `Restocked +${r.quantity}${r.warehouseName ? ` · ${r.warehouseName}` : ""}`,
      detail: [
        r.unitCost != null ? `Unit cost ${money(r.unitCost)}` : null,
        r.note,
      ]
        .filter(Boolean)
        .join(" · ") || "Stock added",
      by: r.createdByEmail,
    });
  }

  for (const c of priceChanges) {
    items.push({
      key: `price-${c.id}`,
      at: c.createdAt,
      icon: Tag,
      tone: "bg-admin-accent/10 text-admin-accent",
      title: c.field === "price" ? "Selling price changed" : "Cost price changed",
      detail: `${c.oldValue != null ? money(c.oldValue) : "N/A"} → ${money(c.newValue)}`,
      by: c.createdByEmail,
    });
  }

  for (const m of movements) {
    if (m.type === "transfer") {
      items.push({
        key: `mv-${m.id}`,
        at: m.createdAt,
        icon: ArrowRight,
        tone: "bg-admin-accent/10 text-admin-accent",
        title: `Transferred ${m.quantity} units`,
        detail: `${m.fromWarehouseName ?? "N/A"} → ${m.toWarehouseName ?? "N/A"}${m.variantLabel ? ` · ${m.variantLabel}` : ""}`,
        by: m.createdByEmail,
      });
    } else if (m.type === "edit") {
      items.push({
        key: `mv-${m.id}`,
        at: m.createdAt,
        icon: Clock,
        tone: "bg-amber-500/10 text-amber-500",
        title: `Stock edited${m.warehouseName ? ` · ${m.warehouseName}` : ""}`,
        detail: `${m.oldValue} → ${m.newValue}${m.variantLabel ? ` · ${m.variantLabel}` : ""}`,
        by: m.createdByEmail,
      });
    } else {
      items.push({
        key: `mv-${m.id}`,
        at: m.createdAt,
        icon: Trash2,
        tone: "bg-admin-danger/10 text-admin-danger",
        title: "Product deleted",
        detail: `Last-known stock ${m.quantity ?? 0}`,
        by: m.createdByEmail,
      });
    }
  }

  return items.sort((a, b) => (a.at < b.at ? 1 : -1));
}
