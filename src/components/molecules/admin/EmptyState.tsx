"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/utils/cn";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  /** Optional call-to-action (e.g. a button). */
  action?: React.ReactNode;
  className?: string;
}

/** Friendly placeholder shown when a list/table has no items. */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-2xl border border-dashed border-admin-border bg-admin-surface px-6 py-16 text-center",
        className,
      )}
    >
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-admin-accent/10 text-admin-accent">
        <Icon className="h-6 w-6" strokeWidth={2} />
      </span>
      <p className="mt-4 text-base font-bold text-admin-text">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-sm text-admin-text-muted">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
