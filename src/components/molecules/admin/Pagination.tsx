"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";
import { GAP, pageWindow } from "./page-window";

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
 * single page.
 *
 * The numbers are windowed (1 … 4 5 6 … 44) rather than listed in full: one
 * button per page ran a 348-product table past the edge of the screen and
 * pushed the next arrow out of reach.
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
    <div className="flex flex-col items-center gap-3 border-t border-admin-border px-5 py-3 sm:flex-row sm:justify-between">
      <p className="whitespace-nowrap text-xs text-admin-text-muted">
        Showing {(page - 1) * pageSize + 1} to{" "}
        {Math.min(page * pageSize, totalItems)} of {totalItems} {itemLabel}
      </p>
      <nav aria-label="Pagination" className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page === 1}
          aria-label="Previous page"
          className="cursor-pointer rounded-lg p-1.5 text-admin-text-muted transition-colors hover:bg-admin-card hover:text-admin-text disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
        </button>
        {pageWindow(page, totalPages).map((slot, i) =>
          slot === GAP ? (
            <span
              // Two gaps can appear, so the index keeps their keys apart.
              key={`gap-${i}`}
              aria-hidden="true"
              className="flex h-8 w-6 items-center justify-center text-xs text-admin-text-muted"
            >
              …
            </span>
          ) : (
            <button
              key={slot}
              type="button"
              onClick={() => onPageChange(slot)}
              aria-label={`Page ${slot}`}
              aria-current={slot === page ? "page" : undefined}
              className={cn(
                "flex h-8 min-w-8 cursor-pointer items-center justify-center rounded-lg px-1.5 text-xs font-bold tabular-nums transition-colors",
                slot === page
                  ? "bg-admin-accent text-white"
                  : "text-admin-text-muted hover:bg-admin-card hover:text-admin-text",
              )}
            >
              {slot}
            </button>
          ),
        )}
        <button
          type="button"
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          aria-label="Next page"
          className="cursor-pointer rounded-lg p-1.5 text-admin-text-muted transition-colors hover:bg-admin-card hover:text-admin-text disabled:cursor-not-allowed disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" strokeWidth={2} />
        </button>
      </nav>
    </div>
  );
}
