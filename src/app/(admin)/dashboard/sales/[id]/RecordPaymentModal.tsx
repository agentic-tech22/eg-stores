"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/molecules/admin";
import { Field, Select, TextInput, Textarea } from "@/components/molecules/form";
import { Modal } from "@/components/molecules/modal/Modal";
import { useRecordSalePayment } from "@/hooks/sales/use-sale-mutations";
import { notify } from "@/lib/toast";
import { validatePayment, type PaymentErrors } from "@/lib/pos/sale-payment";
import {
  PAYMENT_METHODS,
  type PaymentMethod,
} from "@/types/sale.types";
import { formatCurrency } from "@/utils/format-currency";
import { toLocalDateStr } from "@/utils/date-range";

interface RecordPaymentModalProps {
  open: boolean;
  saleId: string;
  /** Outstanding balance; caps the amount and prefills the field. */
  due: number;
  /** The sale's own method, used as the default for this collection. */
  defaultMethod: PaymentMethod;
  currency: { code: string; locale: string };
  onClose: () => void;
}

/**
 * Collects a payment against an outstanding sale balance: how much, on what
 * date, and how it came in. Who received it isn't asked: it's the signed-in
 * member, recorded server-side so it can't be misattributed.
 */
export function RecordPaymentModal({
  open,
  saleId,
  due,
  defaultMethod,
  currency,
  onClose,
}: RecordPaymentModalProps) {
  const recordPayment = useRecordSalePayment();
  const [amount, setAmount] = useState("");
  const [paidOn, setPaidOn] = useState("");
  const [method, setMethod] = useState<PaymentMethod>(defaultMethod);
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<PaymentErrors>({});

  // Re-seed on open: settling the whole due is the common case, so prefill it.
  useEffect(() => {
    if (!open) return;
    setAmount(due > 0 ? String(due) : "");
    setPaidOn(toLocalDateStr(new Date()));
    setMethod(defaultMethod);
    setNote("");
    setErrors({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleSubmit() {
    const { errors: found, value } = validatePayment({ amount, paidOn }, due);
    if (!value) {
      setErrors(found);
      return;
    }
    recordPayment.mutate(
      {
        saleId,
        input: {
          amount: value.amount,
          paidOn: value.paidOn,
          paymentMethod: method,
          note: note.trim() || null,
        },
      },
      {
        onSuccess: (result) => {
          notify.success(
            result.status === "paid"
              ? "Payment recorded. Sale fully settled."
              : "Payment recorded.",
          );
          onClose();
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title="Record a payment"
      description={`${formatCurrency(due, currency.code, currency.locale)} is still due on this sale.`}
      size="sm"
      footer={
        <>
          <Button
            variant="secondary"
            onClick={onClose}
            disabled={recordPayment.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            loading={recordPayment.isPending}
          >
            {recordPayment.isPending ? "Saving..." : "Record payment"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Field
            label={`Amount (${currency.code})`}
            required
            error={errors.amount}
          >
            {(p) => (
              <TextInput
                type="number"
                inputMode="decimal"
                step="0.01"
                min="0"
                max={due}
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  setErrors((prev) => ({ ...prev, amount: undefined }));
                }}
                hasError={Boolean(errors.amount)}
                autoFocus
                {...p}
              />
            )}
          </Field>
          <Field label="Received on" required error={errors.paidOn}>
            {(p) => (
              <TextInput
                type="date"
                value={paidOn}
                onChange={(e) => {
                  setPaidOn(e.target.value);
                  setErrors((prev) => ({ ...prev, paidOn: undefined }));
                }}
                hasError={Boolean(errors.paidOn)}
                {...p}
              />
            )}
          </Field>
        </div>

        <Field label="Payment method" required>
          {(p) => (
            <Select
              value={method}
              onChange={(e) => setMethod(e.target.value as PaymentMethod)}
              {...p}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Note">
          {(p) => (
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Optional, e.g. a receipt or cheque reference"
              {...p}
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
