"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/utils/cn";

type ModalSize = "sm" | "md" | "lg" | "xl";

const sizeClasses: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  /** Optional footer area (e.g. action buttons), rendered below the body. */
  footer?: React.ReactNode;
  size?: ModalSize;
  className?: string;
  children: React.ReactNode;
}

/**
 * Admin-themed modal built on the shadcn `Dialog`. Overrides the dialog's
 * site-theme surface/border with the static `admin-*` tokens, and provides
 * title/description/footer slots with a scrollable body.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  footer,
  size = "md",
  className,
  children,
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          "max-h-[90vh] gap-0 overflow-hidden border-admin-border bg-admin-surface p-0 text-admin-text",
          sizeClasses[size],
          className,
        )}
      >
        {(title || description) && (
          <DialogHeader className="space-y-1.5 border-b border-admin-border px-6 py-5 text-left">
            {title && (
              <DialogTitle className="text-lg font-bold tracking-tight text-admin-text">
                {title}
              </DialogTitle>
            )}
            {description && (
              <DialogDescription className="text-sm text-admin-text-muted">
                {description}
              </DialogDescription>
            )}
          </DialogHeader>
        )}

        <div className="max-h-[60vh] overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-admin-border bg-admin-card/40 px-6 py-4">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
