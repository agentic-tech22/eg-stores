"use client";

import { Loader2 } from "lucide-react";
import { cn } from "@/utils/cn";

export type AdminButtonVariant =
  | "primary"
  | "secondary"
  | "danger"
  | "danger-outline"
  | "ghost";
export type AdminButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: AdminButtonVariant;
  size?: AdminButtonSize;
  /** Shows a spinner and disables the button. */
  loading?: boolean;
  /** Icon rendered before the label (e.g. a lucide icon element). */
  leadingIcon?: React.ReactNode;
}

const variantClasses: Record<AdminButtonVariant, string> = {
  primary:
    "bg-admin-accent text-white hover:bg-admin-accent-hover",
  secondary:
    "border border-admin-border text-admin-text-secondary hover:bg-admin-card",
  danger: "bg-admin-danger text-white hover:bg-admin-danger/90",
  "danger-outline":
    "border border-admin-danger/30 text-admin-danger hover:bg-admin-danger/10",
  ghost: "text-admin-text-secondary hover:bg-admin-card",
};

const sizeClasses: Record<AdminButtonSize, string> = {
  sm: "gap-1.5 px-3 py-1.5 text-xs",
  md: "gap-2 px-4 py-2 text-sm",
  lg: "gap-2 px-5 py-2.5 text-sm",
};

/**
 * The admin dashboard's standard button: consolidates the repeated
 * `rounded-xl … bg-admin-accent … font-bold` markup used across dashboard forms
 * and managers. Renders a real `<button>`; pass `type="submit"` where needed.
 */
export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  leadingIcon,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={cn(
        "inline-flex cursor-pointer items-center justify-center rounded-xl font-bold transition-colors focus-visible:ring-2 focus-visible:ring-admin-accent/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      ) : (
        leadingIcon
      )}
      {children}
    </button>
  );
}
