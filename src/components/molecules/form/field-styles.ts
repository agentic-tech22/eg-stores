import { cn } from "@/utils/cn";

/**
 * Shared admin input styling, previously duplicated as an inline string inside
 * ProductManager/UserManager. Used by every form control in this folder.
 */
export const adminControlClasses =
  "w-full rounded-xl border border-admin-border bg-admin-card/50 px-3.5 py-2.5 text-sm text-admin-text transition-all placeholder:text-admin-text-muted focus:border-admin-accent focus:bg-admin-surface focus:ring-2 focus:ring-admin-accent/20 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60";

/** Adds the error ring/border when a field is invalid. */
export function controlClasses(hasError?: boolean, className?: string) {
  return cn(
    adminControlClasses,
    hasError &&
      "border-admin-danger focus:border-admin-danger focus:ring-admin-danger/20",
    className,
  );
}

export const fieldLabelClasses =
  "text-[11px] font-medium uppercase tracking-[0.1em] text-admin-text-muted";
