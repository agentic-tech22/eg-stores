"use client";

import { useId } from "react";
import { cn } from "@/utils/cn";

interface CheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: React.ReactNode;
  description?: React.ReactNode;
}

/**
 * Admin-themed checkbox with an inline label (and optional description). Renders
 * as a clickable card-style row when a description is provided.
 */
export function Checkbox({
  label,
  description,
  className,
  id: idProp,
  ...props
}: CheckboxProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;

  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-2.5",
        description &&
          "rounded-xl border border-admin-border px-3 py-2.5 transition-colors hover:bg-admin-card/40 has-checked:border-admin-accent/50 has-checked:bg-admin-accent/5",
        className,
      )}
    >
      <input
        id={id}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-admin-border accent-admin-accent"
        {...props}
      />
      <span className="min-w-0">
        <span className="block text-sm font-medium text-admin-text">
          {label}
        </span>
        {description && (
          <span className="block text-[11px] text-admin-text-muted">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}
