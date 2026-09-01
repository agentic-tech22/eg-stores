"use client";

import { cn } from "@/utils/cn";

/** Animated placeholder block. Respects prefers-reduced-motion via Tailwind's motion-safe. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "motion-safe:animate-pulse rounded-lg bg-admin-card",
        className,
      )}
    />
  );
}

/** A few skeleton rows sized to match the admin list/table layout. */
export function TableRowsSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-admin-border" aria-hidden>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 px-5 py-4">
          <Skeleton className="h-12 w-12 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-8 w-20 rounded-lg" />
        </div>
      ))}
    </div>
  );
}
