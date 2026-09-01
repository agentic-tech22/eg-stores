"use client";

import { useMemo, useState } from "react";
import {
  FileText,
  ImageIcon,
  Pencil,
  Plus,
  Receipt,
  Search,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import {
  useDeleteExpense,
  useExpenses,
  useSalaryExpenses,
} from "@/hooks/expenses/use-expenses";
import { useConfirm } from "@/components/molecules/confirm-dialog/confirm-context";
import {
  ActionMenu,
  type ActionMenuItem,
} from "@/components/molecules/action-menu/ActionMenu";
import {
  EmptyState,
  PageHeader,
  Pagination,
  StatCard,
} from "@/components/molecules/admin";
import { Select } from "@/components/molecules/form";
import { notify } from "@/lib/toast";
import {
  byCategory,
  bySalaryEmployee,
  filterByRange,
  knownCategories,
  summarize,
  UNCATEGORISED,
  type ExpenseRange,
} from "@/services/expense-engine";
import {
  expensePaymentMethodLabel,
  type Expense,
  type SalaryExpense,
} from "@/types/expense.types";
import { cn } from "@/utils/cn";
import { DATE_PRESETS, getPresetRange, type DatePreset } from "@/utils/date-range";
import { formatCurrency } from "@/utils/format-currency";
import { ExpenseFormModal } from "./ExpenseFormModal";

const ITEMS_PER_PAGE = 10;

interface ExpensesManagerProps {
  initialExpenses: Expense[];
  initialSalaries: SalaryExpense[];
  currency: { code: string; locale: string };
  /** Payroll is part of the admin-only personnel file. */
  canViewSalaries: boolean;
  can: { create: boolean; edit: boolean; delete: boolean };
}

export function ExpensesManager({
  initialExpenses,
  initialSalaries,
  currency,
  canViewSalaries,
  can,
}: ExpensesManagerProps) {
  const { data: expenses } = useExpenses(initialExpenses);
  const { data: salaries } = useSalaryExpenses(initialSalaries);
  const deleteExpense = useDeleteExpense();
  const confirm = useConfirm();

  const [preset, setPreset] = useState<DatePreset>("this_month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [filterText, setFilterText] = useState("");
  const [category, setCategory] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);

  const money = (n: number) => formatCurrency(n, currency.code, currency.locale);

  // A custom from/to overrides the preset pills, exactly as on Analytics. Both
  // sides are optional, so a one-sided bound still works.
  const usingCustom = Boolean(customFrom || customTo);
  const range: ExpenseRange = useMemo(() => {
    if (usingCustom) return { from: customFrom || null, to: customTo || null };
    const presetRange = getPresetRange(preset);
    return presetRange
      ? { from: presetRange.start, to: presetRange.end }
      : { from: null, to: null };
  }, [usingCustom, customFrom, customTo, preset]);

  const rangedExpenses = useMemo(
    () => filterByRange(expenses, range, (e) => e.expenseDate),
    [expenses, range],
  );
  const rangedSalaries = useMemo(
    () => filterByRange(salaries, range, (s) => s.effectiveDate),
    [salaries, range],
  );

  const summary = useMemo(
    () => summarize(rangedExpenses, rangedSalaries),
    [rangedExpenses, rangedSalaries],
  );
  const categories = useMemo(() => knownCategories(expenses), [expenses]);
  const categoryTotals = useMemo(
    () => byCategory(rangedExpenses),
    [rangedExpenses],
  );
  const employeeTotals = useMemo(
    () => bySalaryEmployee(rangedSalaries),
    [rangedSalaries],
  );

  const query = filterText.toLowerCase();
  const visible = rangedExpenses.filter((e) => {
    const matchesCategory =
      !category ||
      (category === UNCATEGORISED
        ? !e.category?.trim()
        : e.category?.trim().toLowerCase() === category.toLowerCase());
    const matchesText =
      !query ||
      e.title.toLowerCase().includes(query) ||
      (e.category ?? "").toLowerCase().includes(query) ||
      (e.reference ?? "").toLowerCase().includes(query) ||
      (e.notes ?? "").toLowerCase().includes(query);
    return matchesCategory && matchesText;
  });

  const totalPages = Math.max(1, Math.ceil(visible.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = visible.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(expense: Expense) {
    setEditing(expense);
    setFormOpen(true);
  }

  async function handleDelete(expense: Expense) {
    const ok = await confirm({
      title: "Delete expense",
      description: (
        <>
          Delete{" "}
          <span className="font-semibold text-admin-text">{expense.title}</span>?
          This removes the entry and any attached receipts. This cannot be
          undone.
        </>
      ),
      confirmLabel: "Delete expense",
      destructive: true,
    });
    if (!ok) return;
    deleteExpense.mutate(expense.id, {
      onSuccess: () => notify.success("Expense deleted."),
    });
  }

  const rangeLabel = usingCustom
    ? "Selected dates"
    : (DATE_PRESETS.find((p) => p.value === preset)?.label ?? "");

  return (
    <div>
      <PageHeader
        eyebrow="Money out"
        title="Expenses"
        description="Employee salary plus every other cost the business pays, over a date range. Stock bought from suppliers stays in the vendor ledger."
        actions={
          can.create && (
            <button
              type="button"
              onClick={openCreate}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-admin-accent-hover"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add Expense
            </button>
          )
        }
      />

      {/* Date range controls */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          {DATE_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => {
                setPreset(p.value);
                setCustomFrom("");
                setCustomTo("");
                setCurrentPage(1);
              }}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors",
                !usingCustom && preset === p.value
                  ? "bg-admin-accent text-white"
                  : "bg-admin-surface text-admin-text-muted ring-1 ring-admin-border hover:text-admin-text",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={customFrom}
            aria-label="From date"
            onChange={(e) => {
              setCustomFrom(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-xl border border-admin-border bg-admin-surface px-3 py-2.5 text-sm text-admin-text focus:outline-none"
          />
          <span className="text-xs text-admin-text-muted">to</span>
          <input
            type="date"
            value={customTo}
            aria-label="To date"
            onChange={(e) => {
              setCustomTo(e.target.value);
              setCurrentPage(1);
            }}
            className="rounded-xl border border-admin-border bg-admin-surface px-3 py-2.5 text-sm text-admin-text focus:outline-none"
          />
          {usingCustom && (
            <button
              type="button"
              onClick={() => {
                setCustomFrom("");
                setCustomTo("");
              }}
              className="rounded-lg px-3 py-1.5 text-xs font-bold text-admin-accent transition-colors hover:bg-admin-accent/10"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div
        className={cn(
          "mb-6 grid grid-cols-1 gap-4",
          canViewSalaries ? "sm:grid-cols-3" : "sm:grid-cols-2",
        )}
      >
        {canViewSalaries && (
          <StatCard
            label="Employee Salary"
            value={money(summary.salaryTotal)}
            icon={Users}
            tone="indigo"
            hint={`Payroll dated in ${rangeLabel.toLowerCase()}`}
          />
        )}
        <StatCard
          label="Other Expenses"
          value={money(summary.expenseTotal)}
          icon={Receipt}
          tone="amber"
          hint={`${summary.expenseCount} ${summary.expenseCount === 1 ? "entry" : "entries"}`}
        />
        <StatCard
          label="Total Expenses"
          value={money(canViewSalaries ? summary.grandTotal : summary.expenseTotal)}
          icon={Wallet}
          hint={canViewSalaries ? "Salary + other costs" : "Recorded costs"}
        />
      </div>

      {(categoryTotals.length > 0 || employeeTotals.length > 0) && (
        <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {categoryTotals.length > 0 && (
            <BreakdownPanel
              title="By category"
              rows={categoryTotals.map((c) => ({
                label: c.category,
                caption: `${c.count} ${c.count === 1 ? "entry" : "entries"}`,
                value: money(c.total),
              }))}
            />
          )}
          {canViewSalaries && employeeTotals.length > 0 && (
            <BreakdownPanel
              title="Salary by employee"
              rows={employeeTotals.map((e) => ({
                label: e.employeeEmail,
                caption: `${e.count} ${e.count === 1 ? "record" : "records"}`,
                value: money(e.total),
              }))}
            />
          )}
        </div>
      )}

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex h-11 flex-1 items-center gap-2 rounded-xl border border-admin-border bg-admin-surface px-3.5">
          <Search className="h-4 w-4 shrink-0 text-admin-text-muted" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => {
              setFilterText(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search expenses by title, category, reference, or notes..."
            aria-label="Filter expenses"
            className="h-full w-full bg-transparent text-sm text-admin-text placeholder:text-admin-text-muted focus:outline-none"
          />
        </div>
        <div className="sm:w-52">
          <Select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setCurrentPage(1);
            }}
            aria-label="Filter by category"
            className="h-11 font-semibold"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
            <option value={UNCATEGORISED}>{UNCATEGORISED}</option>
          </Select>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={Receipt}
          title={
            expenses.length === 0
              ? "No expenses yet"
              : "No expenses in this range"
          }
          description={
            expenses.length === 0
              ? "Record your first business expense to start tracking what the shop spends."
              : "Try a wider date range, or clear the search and category filters."
          }
          action={
            can.create &&
            expenses.length === 0 && (
              <button
                type="button"
                onClick={openCreate}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Add Expense
              </button>
            )
          }
        />
      ) : (
        <>
          <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
            <div className="hidden border-b border-admin-border bg-admin-card/40 px-5 py-3 sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
              <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Date</p>
              <p className="col-span-4 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Expense</p>
              <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Paid by</p>
              <p className="col-span-2 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Amount</p>
              <p className="col-span-1 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Files</p>
              <p className="col-span-1 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Actions</p>
            </div>

            <div className="divide-y divide-admin-border">
              {paginated.map((expense) => {
                const attachmentIcons =
                  expense.attachments.length > 0 ? (
                    expense.attachments.slice(0, 3).map((att) => (
                      <a
                        key={att.url}
                        href={att.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={att.name}
                        className="text-admin-text-muted transition-colors hover:text-admin-accent"
                      >
                        {att.type.startsWith("image/") ? (
                          <ImageIcon className="h-4 w-4" />
                        ) : (
                          <FileText className="h-4 w-4" />
                        )}
                      </a>
                    ))
                  ) : (
                    <span className="text-[11px] text-admin-text-muted">
                      N/A
                    </span>
                  );

                const actions =
                  can.edit || can.delete ? (
                    <ActionMenu
                      label="Actions for this expense"
                      items={[
                        {
                          key: "edit",
                          label: "Edit expense",
                          icon: Pencil,
                          onSelect: () => openEdit(expense),
                          hidden: !can.edit,
                        },
                        {
                          key: "delete",
                          label: "Delete expense",
                          icon: Trash2,
                          onSelect: () => handleDelete(expense),
                          disabled: deleteExpense.isPending,
                          destructive: true,
                          hidden: !can.delete,
                        },
                      ] satisfies ActionMenuItem[]}
                    />
                  ) : (
                    <span className="text-[11px] italic text-admin-text-muted">
                      View only
                    </span>
                  );

                const meta = [
                  expense.category?.trim() || null,
                  expense.reference ? `Ref ${expense.reference}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ");

                return (
                  <div
                    key={expense.id}
                    className="px-5 py-3.5 transition-colors hover:bg-admin-card/30"
                  >
                    {/* Mobile: stacked card */}
                    <div className="sm:hidden">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-bold text-admin-text">
                            {expense.title}
                          </p>
                          <p className="mt-0.5 truncate text-[11px] text-admin-text-muted">
                            {expense.expenseDate}
                            {meta ? ` · ${meta}` : ""}
                          </p>
                        </div>
                        <div className="shrink-0">{actions}</div>
                      </div>
                      <div className="mt-3 flex items-end justify-between gap-3 border-t border-admin-border pt-3">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-admin-text-muted">
                            Paid by
                          </p>
                          <p className="text-sm text-admin-text">
                            {expensePaymentMethodLabel(expense.paymentMethod)}
                          </p>
                        </div>
                        <p className="text-sm font-bold text-admin-danger">
                          {money(expense.amount)}
                        </p>
                      </div>
                      {expense.notes && (
                        <p className="mt-2 text-[11px] text-admin-text-muted">
                          {expense.notes}
                        </p>
                      )}
                    </div>

                    {/* Desktop: 12-col table row */}
                    <div className="hidden sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
                      <div className="col-span-2 text-sm text-admin-text">
                        {expense.expenseDate}
                      </div>
                      <div className="col-span-4 min-w-0">
                        <p className="truncate text-sm font-bold text-admin-text">
                          {expense.title}
                        </p>
                        {(meta || expense.notes) && (
                          <p className="mt-0.5 truncate text-[11px] text-admin-text-muted">
                            {meta}
                            {meta && expense.notes ? " · " : ""}
                            {expense.notes}
                          </p>
                        )}
                      </div>
                      <div className="col-span-2 text-sm text-admin-text-muted">
                        {expensePaymentMethodLabel(expense.paymentMethod)}
                      </div>
                      <div className="col-span-2 text-right text-sm font-bold text-admin-danger">
                        {money(expense.amount)}
                      </div>
                      <div className="col-span-1 flex items-center gap-1.5">
                        {attachmentIcons}
                      </div>
                      <div className="col-span-1 flex items-center justify-end">
                        {actions}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Pagination
            page={safePage}
            totalPages={totalPages}
            totalItems={visible.length}
            pageSize={ITEMS_PER_PAGE}
            itemLabel="expenses"
            onPageChange={setCurrentPage}
          />
        </>
      )}

      {formOpen && (
        <ExpenseFormModal
          key={editing?.id ?? "new"}
          open
          expense={editing}
          categories={categories}
          currency={currency}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}

interface BreakdownPanelProps {
  title: string;
  rows: { label: string; caption: string; value: string }[];
}

/** A simple label / caption / amount list, shared by the two summary panels. */
function BreakdownPanel({ title, rows }: BreakdownPanelProps) {
  return (
    <div className="rounded-2xl border border-admin-border bg-admin-surface p-5">
      <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">
        {title}
      </p>
      <ul className="divide-y divide-admin-border">
        {rows.map((row) => (
          <li
            key={row.label}
            className="flex items-center justify-between gap-4 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-admin-text">
                {row.label}
              </p>
              <p className="text-[11px] text-admin-text-muted">{row.caption}</p>
            </div>
            <p className="shrink-0 text-sm font-bold text-admin-text">
              {row.value}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
