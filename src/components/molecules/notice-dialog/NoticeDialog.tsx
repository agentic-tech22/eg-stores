"use client";

import { AlertTriangle, Info, XCircle, type LucideIcon } from "lucide-react";
import { Modal } from "@/components/molecules/modal/Modal";
import { cn } from "@/utils/cn";

export type NoticeTone = "info" | "warning" | "danger";

export interface NoticeDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: React.ReactNode;
  /** Visual tone; picks a default icon + accent color. Defaults to "info". */
  tone?: NoticeTone;
  /** Override the tone's default icon. */
  icon?: LucideIcon;
  /** Dismiss button label. Defaults to "Got it". */
  actionLabel?: string;
}

const TONES: Record<NoticeTone, { icon: LucideIcon; wrap: string }> = {
  info: { icon: Info, wrap: "bg-admin-accent/10 text-admin-accent" },
  warning: { icon: AlertTriangle, wrap: "bg-amber-500/10 text-amber-500" },
  danger: { icon: XCircle, wrap: "bg-admin-danger/10 text-admin-danger" },
};

/**
 * A single-action alert modal (icon + title + message + dismiss). Use for
 * blocking feedback that a toast is too transient for, e.g. a barcode scan
 * that resolves to a product not stocked in the selected warehouse. For yes/no
 * decisions use `useConfirm()` instead.
 */
export function NoticeDialog({
  open,
  onClose,
  title,
  description,
  tone = "info",
  icon,
  actionLabel = "Got it",
}: NoticeDialogProps) {
  const preset = TONES[tone];
  const Icon = icon ?? preset.icon;

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="sm"
      footer={
        <button
          type="button"
          onClick={onClose}
          className="rounded-xl bg-admin-accent px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover"
        >
          {actionLabel}
        </button>
      }
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            preset.wrap,
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-bold text-admin-text">{title}</p>
          {description && (
            <p className="mt-1 text-sm text-admin-text-secondary">{description}</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
