"use client";

import { useId } from "react";
import { fieldLabelClasses } from "./field-styles";
import { cn } from "@/utils/cn";

interface FieldProps {
  label?: React.ReactNode;
  /** Marks the label with a required asterisk. */
  required?: boolean;
  /** Helper text shown below the control. */
  hint?: React.ReactNode;
  /** Error message; when set it replaces the hint and is styled as an error. */
  error?: string | null;
  className?: string;
  /**
   * Render-prop receiving the generated id + aria props to spread onto the
   * control, so the label and error are correctly associated.
   */
  children: (props: {
    id: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }) => React.ReactNode;
}

/**
 * Wraps a single form control with a label, optional hint, and error message,
 * wiring up the accessibility associations between them.
 */
export function Field({
  label,
  required,
  hint,
  error,
  className,
  children,
}: FieldProps) {
  const id = useId();
  const describedById = `${id}-description`;
  const hasMessage = Boolean(error || hint);

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label htmlFor={id} className={fieldLabelClasses}>
          {label}
          {required && <span className="ml-0.5 text-admin-danger">*</span>}
        </label>
      )}
      {children({
        id,
        "aria-invalid": error ? true : undefined,
        "aria-describedby": hasMessage ? describedById : undefined,
      })}
      {hasMessage && (
        <p
          id={describedById}
          className={cn(
            "text-[11px]",
            error ? "text-admin-danger" : "text-admin-text-muted",
          )}
        >
          {error || hint}
        </p>
      )}
    </div>
  );
}
