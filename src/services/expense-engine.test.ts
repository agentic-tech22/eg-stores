import { describe, it, expect } from "vitest";
import {
  byCategory,
  bySalaryEmployee,
  filterByRange,
  isInRange,
  knownCategories,
  salaryExpenseDelta,
  summarize,
  totalExpenses,
  totalSalaryExpense,
  UNCATEGORISED,
} from "./expense-engine";
import type { Expense, SalaryExpense } from "@/types/expense.types";

const expense = (over: Partial<Expense> = {}): Expense => ({
  id: "e1",
  title: "Shop rent",
  category: "Rent",
  amount: 20_000,
  expenseDate: "2026-08-10",
  paymentMethod: "cash",
  reference: null,
  notes: null,
  attachments: [],
  createdByEmail: null,
  createdAt: "2026-08-10T00:00:00Z",
  updatedAt: "2026-08-10T00:00:00Z",
  ...over,
});

const salary = (over: Partial<SalaryExpense> = {}): SalaryExpense => ({
  id: "s1",
  userId: "u1",
  employeeEmail: "ram@shop.test",
  type: "salary",
  amount: 30_000,
  effectiveDate: "2026-08-01",
  note: null,
  ...over,
});

describe("salaryExpenseDelta", () => {
  it("counts salary, bonus and advance as money paid out", () => {
    expect(salaryExpenseDelta({ type: "salary", amount: 100 })).toBe(100);
    expect(salaryExpenseDelta({ type: "bonus", amount: 50 })).toBe(50);
    expect(salaryExpenseDelta({ type: "advance", amount: 25 })).toBe(25);
  });

  it("subtracts a deduction, which is stored positive", () => {
    expect(salaryExpenseDelta({ type: "deduction", amount: 40 })).toBe(-40);
  });

  it("ignores a raise, which changes the pay rate rather than paying anything", () => {
    expect(salaryExpenseDelta({ type: "raise", amount: 5_000 })).toBe(0);
  });
});

describe("totalSalaryExpense", () => {
  it("nets the ledger out across every entry type", () => {
    expect(
      totalSalaryExpense([
        { type: "salary", amount: 30_000 },
        { type: "raise", amount: 35_000 },
        { type: "bonus", amount: 2_000 },
        { type: "deduction", amount: 500 },
      ]),
    ).toBe(31_500);
  });

  it("is zero for an empty payroll", () => {
    expect(totalSalaryExpense([])).toBe(0);
  });
});

describe("isInRange", () => {
  const range = { from: "2026-08-01", to: "2026-08-31" };

  it("includes both bounds", () => {
    expect(isInRange("2026-08-01", range)).toBe(true);
    expect(isInRange("2026-08-31", range)).toBe(true);
  });

  it("excludes dates outside the window", () => {
    expect(isInRange("2026-07-31", range)).toBe(false);
    expect(isInRange("2026-09-01", range)).toBe(false);
  });

  it("treats a null bound as unbounded on that side", () => {
    expect(isInRange("1999-01-01", { from: null, to: "2026-08-31" })).toBe(true);
    expect(isInRange("2099-01-01", { from: "2026-08-01", to: null })).toBe(true);
    expect(isInRange("2026-08-10", { from: null, to: null })).toBe(true);
  });

  it("compares only the date part of a longer timestamp", () => {
    expect(isInRange("2026-08-31T23:59:00Z", range)).toBe(true);
  });
});

describe("filterByRange", () => {
  it("keeps only the rows dated inside the window", () => {
    const rows = [
      expense({ id: "a", expenseDate: "2026-07-31" }),
      expense({ id: "b", expenseDate: "2026-08-15" }),
      expense({ id: "c", expenseDate: "2026-09-02" }),
    ];
    const kept = filterByRange(
      rows,
      { from: "2026-08-01", to: "2026-08-31" },
      (r) => r.expenseDate,
    );
    expect(kept.map((r) => r.id)).toEqual(["b"]);
  });
});

describe("byCategory", () => {
  it("totals per category, biggest first", () => {
    const rows = [
      expense({ category: "Rent", amount: 20_000 }),
      expense({ category: "Transport", amount: 1_500 }),
      expense({ category: "Rent", amount: 5_000 }),
    ];
    expect(byCategory(rows)).toEqual([
      { category: "Rent", total: 25_000, count: 2 },
      { category: "Transport", total: 1_500, count: 1 },
    ]);
  });

  it("folds differing case and padding into one line, keeping the first spelling", () => {
    const rows = [
      expense({ category: "Rent", amount: 100 }),
      expense({ category: " rent ", amount: 50 }),
    ];
    expect(byCategory(rows)).toEqual([
      { category: "Rent", total: 150, count: 2 },
    ]);
  });

  it("groups blank and missing categories under one bucket", () => {
    const rows = [
      expense({ category: null, amount: 100 }),
      expense({ category: "   ", amount: 20 }),
    ];
    expect(byCategory(rows)).toEqual([
      { category: UNCATEGORISED, total: 120, count: 2 },
    ]);
  });
});

describe("knownCategories", () => {
  it("lists distinct trimmed labels alphabetically, ignoring blanks", () => {
    expect(
      knownCategories([
        expense({ category: "Utilities" }),
        expense({ category: " rent " }),
        expense({ category: "Rent" }),
        expense({ category: null }),
      ]),
    ).toEqual(["rent", "Utilities"]);
  });
});

describe("bySalaryEmployee", () => {
  it("nets each employee's payroll and drops rate-change rows", () => {
    expect(
      bySalaryEmployee([
        salary({ userId: "u1", amount: 30_000 }),
        salary({ id: "s2", userId: "u1", type: "raise", amount: 40_000 }),
        salary({ id: "s3", userId: "u1", type: "deduction", amount: 1_000 }),
        salary({
          id: "s4",
          userId: "u2",
          employeeEmail: "sita@shop.test",
          amount: 45_000,
        }),
      ]),
    ).toEqual([
      { employeeEmail: "sita@shop.test", total: 45_000, count: 1 },
      { employeeEmail: "ram@shop.test", total: 29_000, count: 2 },
    ]);
  });

  it("labels entries whose profile is gone rather than dropping them", () => {
    expect(
      bySalaryEmployee([salary({ employeeEmail: null, amount: 10_000 })]),
    ).toEqual([{ employeeEmail: "Unknown employee", total: 10_000, count: 1 }]);
  });
});

describe("summarize", () => {
  it("reports payroll, other costs, and their sum", () => {
    expect(
      summarize(
        [expense({ amount: 20_000 }), expense({ id: "e2", amount: 1_500 })],
        [salary({ amount: 30_000 }), salary({ id: "s2", type: "bonus", amount: 2_000 })],
      ),
    ).toEqual({
      salaryTotal: 32_000,
      expenseTotal: 21_500,
      grandTotal: 53_500,
      expenseCount: 2,
    });
  });

  it("is all zeroes for an empty period", () => {
    expect(summarize([], [])).toEqual({
      salaryTotal: 0,
      expenseTotal: 0,
      grandTotal: 0,
      expenseCount: 0,
    });
  });
});

describe("totalExpenses", () => {
  it("sums amounts, treating a null amount as zero", () => {
    expect(
      totalExpenses([
        { amount: 100 },
        { amount: null as unknown as number },
        { amount: 50 },
      ]),
    ).toBe(150);
  });
});
