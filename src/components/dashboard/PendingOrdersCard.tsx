"use client";

import Link from "next/link";
import { ArrowRight, ClipboardList, PackageCheck } from "lucide-react";
import { useOrders } from "@/hooks/orders/use-orders";
import type { Order, OrderStatus } from "@/types/order.types";

/** Open statuses that still need owner attention, in workflow order. */
const OPEN_STATUSES: { status: OrderStatus; label: string; chip: string }[] = [
  { status: "pending", label: "Pending", chip: "bg-amber-500/10 text-amber-600" },
  { status: "processing", label: "Processing", chip: "bg-indigo-500/10 text-indigo-600" },
  { status: "shipped", label: "Shipped", chip: "bg-cyan-500/10 text-cyan-600" },
];

interface PendingOrdersCardProps {
  initialOrders: Order[];
}

/** Live count of orders awaiting fulfilment, broken down by open status. */
export function PendingOrdersCard({ initialOrders }: PendingOrdersCardProps) {
  const { data: orders } = useOrders(initialOrders);

  const counts = OPEN_STATUSES.map((s) => ({
    ...s,
    count: orders.filter((o) => o.status === s.status).length,
  }));
  const totalOpen = counts.reduce((sum, c) => sum + c.count, 0);

  return (
    <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
      <div className="flex items-center justify-between border-b border-admin-border px-5 py-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">
          Orders to fulfil
        </p>
        <Link
          href="/dashboard/orders"
          className="inline-flex items-center gap-1 text-[11px] font-bold text-admin-accent transition-colors hover:underline"
        >
          All orders
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>

      {totalOpen === 0 ? (
        <div className="flex flex-col items-center justify-center px-5 py-10 text-center">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
            <PackageCheck className="h-5 w-5" strokeWidth={2} />
          </span>
          <p className="mt-3 text-sm font-semibold text-admin-text">All caught up</p>
          <p className="text-[11px] text-admin-text-muted">
            No open orders waiting.
          </p>
        </div>
      ) : (
        <div className="divide-y divide-admin-border">
          {counts.map((row) => (
            <div
              key={row.status}
              className="flex items-center justify-between gap-4 px-5 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${row.chip}`}
                >
                  <ClipboardList className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <p className="text-sm font-semibold text-admin-text">
                  {row.label}
                </p>
              </div>
              <span className="shrink-0 text-lg font-extrabold tracking-tight text-admin-text">
                {row.count}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
