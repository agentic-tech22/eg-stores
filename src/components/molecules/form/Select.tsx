"use client";

import { ChevronDown } from "lucide-react";
import { controlClasses } from "./field-styles";
import { cn } from "@/utils/cn";

interface SelectProps
  extends React.SelectHTMLAttributes<HTMLSelectElement> {
  hasError?: boolean;
}

/**
 * Admin-themed native select. Kept as a plain `<select>` (not the Radix shadcn
 * Select) so it composes with `Field` and native form behavior; pass `<option>`
 * children. Pair with `Field` for labels and error messages.
 *
 * The native dropdown arrow is suppressed (`appearance-none`) and replaced with
 * a consistently positioned lucide chevron so it matches the rest of the UI
 * across browsers/platforms.
 */
export function Select({
  hasError,
  className,
  disabled,
  children,
  ...props
}: SelectProps) {
  return (
    <div className="relative">
      <select
        disabled={disabled}
        className={controlClasses(hasError, cn("appearance-none pr-10", className))}
        {...props}
      >
        {children}
      </select>
      <ChevronDown
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-admin-text-muted",
          disabled && "opacity-60",
        )}
      />
    </div>
  );
}
