"use client";

import Link from "next/link";
import { cn } from "@/utils/cn";

interface RowLinkProps {
  /** Detail page the record opens. */
  href: string;
  /**
   * Accessible name for the link. The visible content mixes an image, a title
   * and secondary text, so screen readers get an explicit label instead.
   */
  label: string;
  /** Layout classes for the cell, e.g. the row's `col-span-*`. */
  className?: string;
  children: React.ReactNode;
}

/**
 * The clickable identity cell of an admin table row: the image/name block that
 * opens the record's detail page. Centralized so every table gets the same
 * pointer cursor, hover affordance and focus ring.
 *
 * Marks itself as a `group`, so the title inside can react with
 * `group-hover:text-admin-accent`.
 */
export function RowLink({ href, label, className, children }: RowLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "group flex min-w-0 cursor-pointer items-center gap-3 rounded-lg outline-none transition-colors focus-visible:ring-2 focus-visible:ring-admin-accent",
        className,
      )}
    >
      {children}
    </Link>
  );
}
