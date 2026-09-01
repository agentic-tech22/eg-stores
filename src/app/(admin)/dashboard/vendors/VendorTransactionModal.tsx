"use client";

import { useState } from "react";
import { Modal } from "@/components/molecules/modal/Modal";
import { Field, Select, TextInput, Textarea } from "@/components/molecules/form";
import { FileUploader } from "@/components/molecules/file-uploader/FileUploader";
import {
  useCreateVendorTransaction,
  useUpdateVendorTransaction,
} from "@/hooks/vendors/use-vendors";
import { deleteVendorBill, uploadVendorBill } from "@/services/upload.service";
import { notify } from "@/lib/toast";
import {
  VENDOR_BILL_STATUS_LABELS,
  VENDOR_PAYMENT_METHODS,
  toVendorPaymentMethod,
  type VendorAttachment,
  type VendorBillStatus,
  type VendorPaymentMethod,
  type VendorTransaction,
  type VendorTransactionType,
} from "@/types/vendor.types";
import { formatCurrency } from "@/utils/format-currency";

interface VendorTransactionModalProps {
  open: boolean;
  onClose: () => void;
  vendorId: string;
  type: VendorTransactionType;
  /** When provided, edits this entry; otherwise creates a new one. */
  transaction?: VendorTransaction | null;
  currency: { code: string; locale: string };
}

/** Today's date (YYYY-MM-DD) for prefilling new entries. */
function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function VendorTransactionModal({
  open,
  onClose,
  vendorId,
  type,
  transaction,
  currency,
}: VendorTransactionModalProps) {
  const isEdit = Boolean(transaction);
  const isBill = type === "bill";

  const createTxn = useCreateVendorTransaction();
  const updateTxn = useUpdateVendorTransaction();
  const pending = createTxn.isPending || updateTxn.isPending;

  const initialAttachments = transaction?.attachments ?? [];

  const [txnDate, setTxnDate] = useState(transaction?.txnDate ?? todayIso());
  const [billNumber, setBillNumber] = useState(transaction?.billNumber ?? "");
  const [reference, setReference] = useState(transaction?.reference ?? "");
  const [subtotal, setSubtotal] = useState(
    transaction && isBill ? String(transaction.subtotal) : "",
  );
  const [taxAmount, setTaxAmount] = useState(
    transaction && isBill ? String(transaction.taxAmount) : "",
  );
  const [paymentAmount, setPaymentAmount] = useState(
    transaction && !isBill ? String(transaction.amount) : "",
  );
  // Narrowed on open: an entry recorded before the list shrank to cash/online
  // (eSewa, Khalti, bank…) opens as "online" rather than on a missing option.
  const [paymentMethod, setPaymentMethod] = useState<VendorPaymentMethod>(
    toVendorPaymentMethod(transaction?.paymentMethod),
  );
  const [status, setStatus] = useState<VendorBillStatus>(
    transaction?.status ?? "unpaid",
  );
  const [paidAt, setPaidAt] = useState(transaction?.paidAt ?? "");
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [attachments, setAttachments] =
    useState<VendorAttachment[]>(initialAttachments);
  const [pendingDeletions, setPendingDeletions] = useState<string[]>([]);

  const parsedSubtotal = parseFloat(subtotal) || 0;
  const parsedTax = parseFloat(taxAmount) || 0;
  const billTotal = parsedSubtotal + parsedTax;
  const amount = isBill ? billTotal : parseFloat(paymentAmount) || 0;

  const money = (n: number) => formatCurrency(n, currency.code, currency.locale);

  /** Uploaded this session and not part of the saved transaction. */
  function sessionUploads(): string[] {
    return attachments
      .filter((a) => !initialAttachments.some((i) => i.url === a.url))
      .map((a) => a.url);
  }

  function handleAdd(att: VendorAttachment) {
    setAttachments((prev) => [...prev, att]);
  }

  function handleRemove(index: number) {
    const removed = attachments[index];
    if (removed) {
      const wasPersisted = initialAttachments.some((i) => i.url === removed.url);
      if (wasPersisted) {
        setPendingDeletions((prev) => [...prev, removed.url]);
      } else {
        void deleteVendorBill(removed.url);
      }
    }
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCancel() {
    await Promise.all(sessionUploads().map((url) => deleteVendorBill(url)));
    onClose();
  }

  function handleSubmit() {
    if (!txnDate) {
      notify.error("A date is required.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      notify.error(
        isBill
          ? "Enter a subtotal and/or VAT so the total is greater than zero."
          : "Enter a payment amount greater than zero.",
      );
      return;
    }

    const data = {
      vendorId,
      type,
      txnDate,
      billNumber: isBill ? billNumber.trim() || null : null,
      reference: reference.trim() || null,
      subtotal: isBill ? parsedSubtotal : 0,
      taxAmount: isBill ? parsedTax : 0,
      amount,
      paymentMethod: isBill ? null : paymentMethod,
      status: isBill ? status : null,
      paidAt: isBill && status === "paid" ? paidAt || txnDate : null,
      attachments,
      notes: notes.trim() || null,
    };

    const action =
      isEdit && transaction
        ? updateTxn.mutateAsync({ id: transaction.id, data })
        : createTxn.mutateAsync(data);

    action
      .then(async () => {
        await Promise.all(pendingDeletions.map((url) => deleteVendorBill(url)));
        notify.success(
          isEdit
            ? "Entry updated."
            : isBill
              ? "Bill recorded."
              : "Payment recorded.",
        );
        onClose();
      })
      .catch(() => {
        // Error toast handled by the mutation's onError; keep the form open.
      });
  }

  const noun = isBill ? "bill" : "payment";

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) void handleCancel();
      }}
      size="lg"
      title={isEdit ? `Edit ${noun}` : isBill ? "Record bill" : "Record payment"}
      description={
        isBill
          ? "Log a bill received from this vendor, with optional attachments."
          : "Log a payment made to this vendor."
      }
      footer={
        <>
          <button
            type="button"
            onClick={() => void handleCancel()}
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
            {pending ? "Saving..." : isEdit ? "Save changes" : `Record ${noun}`}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

        {isBill ? (
          <Field label="Bill number">
            {(p) => (
              <TextInput
                type="text"
                value={billNumber}
                onChange={(e) => setBillNumber(e.target.value)}
                placeholder="Supplier's bill / invoice no."
                {...p}
              />
            )}
          </Field>
        ) : (
          <Field label="Reference">
            {(p) => (
              <TextInput
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder="Cheque / transaction no."
                {...p}
              />
            )}
          </Field>
        )}

        {isBill ? (
          <>
            <Field label={`Subtotal (${currency.code})`}>
              {(p) => (
                <TextInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={subtotal}
                  onChange={(e) => setSubtotal(e.target.value)}
                  placeholder="0.00"
                  {...p}
                />
              )}
            </Field>
            <Field label={`VAT / tax (${currency.code})`}>
              {(p) => (
                <TextInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={taxAmount}
                  onChange={(e) => setTaxAmount(e.target.value)}
                  placeholder="0.00"
                  {...p}
                />
              )}
            </Field>
            <Field
              label="Status"
              hint={
                status === "paid"
                  ? "Settled on receipt — excluded from the outstanding payable."
                  : "Counts toward the outstanding payable until it is paid."
              }
            >
              {(p) => (
                <Select
                  value={status}
                  onChange={(e) => {
                    const next = e.target.value as VendorBillStatus;
                    setStatus(next);
                    // Prefill the settlement date with the bill's own date the
                    // first time it is marked paid.
                    if (next === "paid" && !paidAt) setPaidAt(txnDate);
                  }}
                  {...p}
                >
                  {(
                    Object.keys(VENDOR_BILL_STATUS_LABELS) as VendorBillStatus[]
                  ).map((s) => (
                    <option key={s} value={s}>
                      {VENDOR_BILL_STATUS_LABELS[s]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {status === "paid" && (
              <Field label="Paid at" hint="When this bill was settled.">
                {(p) => (
                  <TextInput
                    type="date"
                    value={paidAt}
                    onChange={(e) => setPaidAt(e.target.value)}
                    {...p}
                  />
                )}
              </Field>
            )}

            <div className="flex items-end">
              <div className="w-full rounded-xl bg-admin-card/40 px-4 py-2.5">
                <p className="text-[11px] text-admin-text-muted">Bill total</p>
                <p className="text-lg font-extrabold text-admin-text">
                  {money(billTotal)}
                </p>
              </div>
            </div>
          </>
        ) : (
          <>
            <Field label={`Amount paid (${currency.code})`} required>
              {(p) => (
                <TextInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  placeholder="0.00"
                  {...p}
                />
              )}
            </Field>
            <Field
              label="Payment method"
              hint="Note the wallet, bank or cheque number in Reference."
            >
              {(p) => (
                <Select
                  value={paymentMethod}
                  onChange={(e) =>
                    setPaymentMethod(e.target.value as VendorPaymentMethod)
                  }
                  {...p}
                >
                  {VENDOR_PAYMENT_METHODS.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </>
        )}

        <Field label="Notes" className="sm:col-span-2">
          {(p) => (
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any notes about this entry"
              {...p}
            />
          )}
        </Field>

        <div className="sm:col-span-2">
          <FileUploader
            label={isBill ? "Bill attachments" : "Receipt attachments"}
            attachments={attachments}
            onUpload={uploadVendorBill}
            onAdd={handleAdd}
            onRemove={handleRemove}
          />
        </div>
      </div>
    </Modal>
  );
}
