"use client";

import { ArrowDownRight, ArrowUpRight, type LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon: LucideIcon;
  /** Optional small caption under the value (e.g. "of 24 total"). */
  hint?: string;
  /**
   * Optional period-over-period change, as a signed percent. Renders a colored
   * ▲/▼ badge. `null` means "no baseline to compare against" (shown muted).
   * Omit the prop entirely to render no badge.
   */
  trend?: number | null;
  /** Tints the icon chip; defaults to the admin accent. */
  tone?: "accent" | "emerald" | "amber" | "indigo";
  className?: string;
}

const toneChip: Record<NonNullable<StatCardProps["tone"]>, string> = {
  accent: "bg-admin-accent/10 text-admin-accent",
  emerald: "bg-emerald-500/10 text-emerald-600",
  amber: "bg-amber-500/10 text-amber-600",
  indigo: "bg-indigo-500/10 text-indigo-600",
};

/** Colored ▲/▼ pill showing a signed percent change vs. the previous period. */
function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) {
    return (
      <span className="text-[11px] font-bold text-admin-text-muted">
        vs. last period
      </span>
    );
  }
  const up = pct >= 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-bold",
        up ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600",
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={2.5} />
      {Math.abs(pct).toFixed(0)}%
    </span>
  );
}

/** Dashboard stat tile: an icon chip with a label and prominent value. */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  trend,
  tone = "accent",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-admin-border bg-admin-surface p-5 transition-shadow hover:shadow-sm",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">
          {label}
        </p>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            toneChip[tone],
          )}
        >
          <Icon className="h-4.5 w-4.5" strokeWidth={2.25} />
        </span>
      </div>
      <p className="mt-3 truncate text-2xl font-extrabold tracking-tight text-admin-text sm:text-3xl">
        {value}
      </p>
      {hint && <p className="mt-1 text-[11px] text-admin-text-muted">{hint}</p>}
      {trend !== undefined && (
        <div className="mt-2">
          <TrendBadge pct={trend} />
        </div>
      )}
    </div>
  );
}
