"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";

interface PaginationProps {
  /** Current 1-based page. */
  page: number;
  /** Total number of pages (>= 1). */
  totalPages: number;
  /** Total number of items across all pages (for the "Showing X to Y of Z" caption). */
  totalItems: number;
  /** Items per page (for the caption math). */
  pageSize: number;
  /** Plural noun for the caption, e.g. "products", "orders". */
  itemLabel: string;
  onPageChange: (page: number) => void;
}

/**
 * Shared table footer pager: a "Showing X to Y of Z {label}" caption plus
 * prev / numbered / next controls. Renders nothing when everything fits on a
 * single page. The markup mirrors the original per-manager inline pagination
 * so existing tables look unchanged.
 */
export function Pagination({
  page,
  totalPages,
  totalItems,
  pageSize,
  itemLabel,
  onPageChange,
}: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between border-t border-admin-border px-5 py-3">
      <p className="text-xs text-admin-text-muted">
        Showing {(page - 1) * pageSize + 1} to{" "}
        {Math.min(page * pageSize, totalItems)} of {totalItems} {itemLabel}
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-label="Previous page"
          className="cursor-pointer rounded-lg p-1.5 text-admin-text-muted transition-colors hover:bg-admin-card hover:text-admin-text disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPageChange(p)}
            aria-label={`Page ${p}`}
            aria-current={p === page ? "page" : undefined}
            className={cn(
              "flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-xs font-bold transition-colors",
              p === page
                ? "bg-admin-accent text-white"
                : "text-admin-text-muted hover:bg-admin-card hover:text-admin-text",
            )}
          >
            {p}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          aria-label="Next page"
          className="cursor-pointer rounded-lg p-1.5 text-admin-text-muted transition-colors hover:bg-admin-card hover:text-admin-text disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
