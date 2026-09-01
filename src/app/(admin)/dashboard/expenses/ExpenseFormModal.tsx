"use client";

import { useId, useState } from "react";
import { Modal } from "@/components/molecules/modal/Modal";
import { Field, Select, TextInput, Textarea } from "@/components/molecules/form";
import { FileUploader } from "@/components/molecules/file-uploader/FileUploader";
import {
  useCreateExpense,
  useUpdateExpense,
} from "@/hooks/expenses/use-expenses";
import {
  deleteExpenseReceipt,
  uploadExpenseReceipt,
} from "@/services/upload.service";
import { notify } from "@/lib/toast";
import {
  EXPENSE_PAYMENT_METHODS,
  type Expense,
  type ExpenseAttachment,
  type ExpensePaymentMethod,
} from "@/types/expense.types";
import { formatCurrency } from "@/utils/format-currency";

interface ExpenseFormModalProps {
  open: boolean;
  onClose: () => void;
  /** When provided, edits this expense; otherwise creates a new one. */
  expense?: Expense | null;
  /** Categories already in use, offered as datalist suggestions. */
  categories: string[];
  currency: { code: string; locale: string };
}

/** Today in local time as YYYY-MM-DD, matching how expense dates are entered. */
function todayIso(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function ExpenseFormModal({
  open,
  onClose,
  expense,
  categories,
  currency,
}: ExpenseFormModalProps) {
  const isEdit = Boolean(expense);
  const categoryListId = useId();

  const createExpense = useCreateExpense();
  const updateExpense = useUpdateExpense();
  const pending = createExpense.isPending || updateExpense.isPending;

  const initialAttachments = expense?.attachments ?? [];

  const [title, setTitle] = useState(expense?.title ?? "");
  const [category, setCategory] = useState(expense?.category ?? "");
  const [amount, setAmount] = useState(
    expense ? String(expense.amount) : "",
  );
  const [expenseDate, setExpenseDate] = useState(
    expense?.expenseDate ?? todayIso(),
  );
  const [paymentMethod, setPaymentMethod] = useState<ExpensePaymentMethod>(
    expense?.paymentMethod ?? "cash",
  );
  const [reference, setReference] = useState(expense?.reference ?? "");
  const [notes, setNotes] = useState(expense?.notes ?? "");
  const [attachments, setAttachments] =
    useState<ExpenseAttachment[]>(initialAttachments);
  const [pendingDeletions, setPendingDeletions] = useState<string[]>([]);

  const parsedAmount = parseFloat(amount) || 0;
  const money = (n: number) => formatCurrency(n, currency.code, currency.locale);

  /** Uploaded this session and not part of the saved expense. */
  function sessionUploads(): string[] {
    return attachments
      .filter((a) => !initialAttachments.some((i) => i.url === a.url))
      .map((a) => a.url);
  }

  function handleAdd(att: ExpenseAttachment) {
    setAttachments((prev) => [...prev, att]);
  }

  function handleRemove(index: number) {
    const removed = attachments[index];
    if (removed) {
      const wasPersisted = initialAttachments.some((i) => i.url === removed.url);
      if (wasPersisted) {
        // Only delete from storage once the save succeeds, so cancelling leaves
        // the saved receipt intact.
        setPendingDeletions((prev) => [...prev, removed.url]);
      } else {
        void deleteExpenseReceipt(removed.url);
      }
    }
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCancel() {
    await Promise.all(sessionUploads().map((url) => deleteExpenseReceipt(url)));
    onClose();
  }

  function handleSubmit() {
    if (!title.trim()) {
      notify.error("Enter what the expense was for.");
      return;
    }
    if (!expenseDate) {
      notify.error("A date is required.");
      return;
    }
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      notify.error("Enter an amount greater than zero.");
      return;
    }

    const data = {
      title: title.trim(),
      category: category.trim() || null,
      amount: parsedAmount,
      expenseDate,
      paymentMethod,
      reference: reference.trim() || null,
      notes: notes.trim() || null,
      attachments,
    };

    const action =
      isEdit && expense
        ? updateExpense.mutateAsync({ id: expense.id, data })
        : createExpense.mutateAsync(data);

    action
      .then(async () => {
        await Promise.all(
          pendingDeletions.map((url) => deleteExpenseReceipt(url)),
        );
        notify.success(isEdit ? "Expense updated." : "Expense recorded.");
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
        if (!next && !pending) void handleCancel();
      }}
      size="lg"
      title={isEdit ? "Edit expense" : "Record expense"}
      description="Log a business cost such as rent, utilities, transport, or repairs, with an optional receipt."
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
            {pending ? "Saving..." : isEdit ? "Save changes" : "Record expense"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="What was it for" required className="sm:col-span-2">
          {(p) => (
            <TextInput
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Shop rent for Bhadra"
              {...p}
            />
          )}
        </Field>

        <Field label="Date" required>
          {(p) => (
            <TextInput
              type="date"
              value={expenseDate}
              onChange={(e) => setExpenseDate(e.target.value)}
              {...p}
            />
          )}
        </Field>

        <Field
          label="Category"
          hint="Type a new one or pick a category you have used before."
        >
          {(p) => (
            <>
              <TextInput
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Rent, Utilities, Transport..."
                list={categoryListId}
                {...p}
              />
              <datalist id={categoryListId}>
                {categories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </>
          )}
        </Field>

        <Field label={`Amount (${currency.code})`} required>
          {(p) => (
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              {...p}
            />
          )}
        </Field>

        <Field label="Paid by">
          {(p) => (
            <Select
              value={paymentMethod}
              onChange={(e) =>
                setPaymentMethod(e.target.value as ExpensePaymentMethod)
              }
              {...p}
            >
              {EXPENSE_PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        <Field label="Reference" className="sm:col-span-2">
          {(p) => (
            <TextInput
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Cheque / transaction no., or which wallet paid"
              {...p}
            />
          )}
        </Field>

        <div className="flex items-end sm:col-span-2">
          <div className="w-full rounded-xl bg-admin-card/40 px-4 py-2.5">
            <p className="text-[11px] text-admin-text-muted">Expense total</p>
            <p className="text-lg font-extrabold text-admin-text">
              {money(parsedAmount)}
            </p>
          </div>
        </div>

        <Field label="Notes" className="sm:col-span-2">
          {(p) => (
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any detail worth remembering about this expense"
              {...p}
            />
          )}
        </Field>

        <div className="sm:col-span-2">
          <FileUploader
            label="Receipts"
            description="Upload photos or PDFs of the receipt. Max 10MB each."
            attachments={attachments}
            onUpload={uploadExpenseReceipt}
            onAdd={handleAdd}
            onRemove={handleRemove}
          />
        </div>
      </div>
    </Modal>
  );
}
