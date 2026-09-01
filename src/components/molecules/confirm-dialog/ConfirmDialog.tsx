"use client";

import { Modal } from "@/components/molecules/modal/Modal";
import { cn } from "@/utils/cn";

export interface ConfirmOptions {
  title: string;
  description?: React.ReactNode;
  /** Label for the confirm button. Defaults to "Confirm". */
  confirmLabel?: string;
  /** Label for the cancel button. Defaults to "Cancel". */
  cancelLabel?: string;
  /** Styles the confirm button as destructive (red). */
  destructive?: boolean;
}

interface ConfirmDialogProps extends ConfirmOptions {
  open: boolean;
  /** True while the confirm action is running; disables the buttons. */
  pending?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Presentational confirm modal. For imperative use, prefer `useConfirm()` from
 * `confirm-context`, which renders this and resolves a promise.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  destructive,
  pending,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onCancel();
      }}
      size="sm"
      title={title}
      footer={
        <>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-text-secondary transition-colors hover:bg-admin-card disabled:opacity-40"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className={cn(
              "rounded-xl px-4 py-2 text-sm font-bold text-white transition-colors disabled:opacity-40",
              destructive
                ? "bg-admin-danger hover:bg-admin-danger/90"
                : "bg-admin-accent hover:bg-admin-accent-hover",
            )}
          >
            {pending ? "Working..." : confirmLabel}
          </button>
        </>
      }
    >
      <div className="text-sm text-admin-text-secondary">
        {description ?? "Are you sure you want to continue?"}
      </div>
    </Modal>
  );
}
