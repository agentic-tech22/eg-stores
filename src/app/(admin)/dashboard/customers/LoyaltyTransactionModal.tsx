"use client";

import { useState } from "react";
import { Modal } from "@/components/molecules/modal/Modal";
import { Field, Select, TextInput, Textarea } from "@/components/molecules/form";
import {
  useCreateLoyaltyTransaction,
  useUpdateLoyaltyTransaction,
} from "@/hooks/customers/use-customers";
import { notify } from "@/lib/toast";
import {
  LOYALTY_TRANSACTION_TYPES,
  type LoyaltyTransaction,
  type LoyaltyTransactionType,
} from "@/types/customer.types";

interface LoyaltyTransactionModalProps {
  open: boolean;
  onClose: () => void;
  customerId: string;
  /** When provided, edits this entry; otherwise creates a new one. */
  transaction?: LoyaltyTransaction | null;
}

/** Today's date (YYYY-MM-DD) for prefilling new entries. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function LoyaltyTransactionModal({
  open,
  onClose,
  customerId,
  transaction,
}: LoyaltyTransactionModalProps) {
  const isEdit = Boolean(transaction);

  const createTxn = useCreateLoyaltyTransaction();
  const updateTxn = useUpdateLoyaltyTransaction();
  const pending = createTxn.isPending || updateTxn.isPending;

  const [type, setType] = useState<LoyaltyTransactionType>(
    transaction?.type ?? "earn",
  );
  const [points, setPoints] = useState(
    transaction ? String(Math.abs(transaction.points)) : "",
  );
  const [txnDate, setTxnDate] = useState(transaction?.txnDate ?? todayIso());
  const [note, setNote] = useState(transaction?.note ?? "");

  const isAdjust = type === "adjust";

  function handleSubmit() {
    const parsed = parseFloat(points);
    if (!txnDate) {
      notify.error("A date is required.");
      return;
    }
    if (!Number.isFinite(parsed) || parsed === 0) {
      notify.error("Enter a non-zero number of points.");
      return;
    }
    if (!isAdjust && parsed < 0) {
      notify.error("Points must be a positive number.");
      return;
    }

    const data = {
      customerId,
      type,
      points: parsed,
      txnDate,
      note: note.trim() || null,
    };

    const action =
      isEdit && transaction
        ? updateTxn.mutateAsync({ id: transaction.id, data })
        : createTxn.mutateAsync(data);

    action
      .then(() => {
        notify.success(isEdit ? "Entry updated." : "Entry recorded.");
        onClose();
      })
      .catch(() => {
        // Error toast handled by the mutation's onError; keep the form open.
      });
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
      size="md"
      title={isEdit ? "Edit loyalty entry" : "Record loyalty entry"}
      description="Earn adds points, redeem subtracts them, and an adjustment can go either way (use a negative number to remove points)."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-text-secondary transition-colors hover:bg-admin-card disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className="rounded-xl bg-admin-accent px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover disabled:opacity-40"
          >
            {pending ? "Saving..." : isEdit ? "Save changes" : "Record entry"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Type">
          {(p) => (
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as LoyaltyTransactionType)}
              {...p}
            >
              {LOYALTY_TRANSACTION_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field
          label="Points"
          hint={
            isAdjust
              ? "Use a negative number to remove points."
              : type === "redeem"
                ? "Points to subtract."
                : "Points to add."
          }
        >
          {(p) => (
            <TextInput
              type="number"
              step="1"
              value={points}
              onChange={(e) => setPoints(e.target.value)}
              placeholder="0"
              {...p}
            />
          )}
        </Field>

        <Field label="Date" required>
          {(p) => (
            <TextInput
              type="date"
              value={txnDate}
              onChange={(e) => setTxnDate(e.target.value)}
              {...p}
            />
          )}
        </Field>

        <Field label="Note" className="sm:col-span-2">
          {(p) => (
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Reason for this entry (optional)"
              {...p}
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
