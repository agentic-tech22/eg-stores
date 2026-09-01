"use client";

import { cn } from "@/utils/cn";

interface PageHeaderProps {
  title: string;
  description?: string;
  /** Right-aligned actions (e.g. a primary button). */
  actions?: React.ReactNode;
  /** Small breadcrumb/eyebrow label shown above the title. */
  eyebrow?: string;
  className?: string;
}

/** Consistent page header: eyebrow + title + description on the left, actions on the right. */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
  className,
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] text-admin-accent">
            {eyebrow}
          </p>
        )}
        <h1 className="text-3xl font-extrabold tracking-tight text-admin-text sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm text-admin-text-muted">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}
