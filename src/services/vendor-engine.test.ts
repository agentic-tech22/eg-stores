import { describe, it, expect } from "vitest";
import {
  balanceDelta,
  computeVendorBalance,
  describePayable,
} from "./vendor-engine";

describe("computeVendorBalance", () => {
  it("adds unpaid bills and subtracts payments, starting from the opening balance", () => {
    const txns = [
      { type: "bill" as const, amount: 1000, status: "unpaid" as const },
      { type: "payment" as const, amount: 400, status: null },
      { type: "bill" as const, amount: 250, status: "unpaid" as const },
    ];
    expect(computeVendorBalance(500, txns)).toBe(500 + 1000 - 400 + 250);
  });

  it("excludes a bill that was already paid when it was recorded", () => {
    const txns = [
      { type: "bill" as const, amount: 1000, status: "paid" as const },
      { type: "payment" as const, amount: 3000, status: null },
      { type: "bill" as const, amount: 5000, status: "unpaid" as const },
    ];
    expect(computeVendorBalance(0, txns)).toBe(5000 - 3000);
  });

  it("counts an unpaid bill in full, less any payments made against it", () => {
    expect(
      computeVendorBalance(0, [
        { type: "bill", amount: 800, status: "unpaid" },
        { type: "payment", amount: 300, status: null },
      ]),
    ).toBe(500);
  });

  it("defaults a null opening balance and null amounts to 0", () => {
    expect(
      computeVendorBalance(0, [
        { type: "bill", amount: null as unknown as number, status: "unpaid" },
      ]),
    ).toBe(0);
  });

  it("can go negative when payments exceed what is owed (advance)", () => {
    expect(
      computeVendorBalance(0, [{ type: "payment", amount: 300, status: null }]),
    ).toBe(-300);
  });
});

describe("balanceDelta", () => {
  it("returns zero for a settled bill", () => {
    expect(balanceDelta({ type: "bill", amount: 1000, status: "paid" })).toBe(0);
  });

  it("returns the negated amount for a payment", () => {
    expect(balanceDelta({ type: "payment", amount: 250, status: null })).toBe(
      -250,
    );
  });
});

describe("describePayable", () => {
  it("labels a positive balance as a Payable", () => {
    expect(describePayable(1200)).toEqual({
      isCredit: false,
      amount: 1200,
      label: "Payable",
    });
  });

  it("labels a negative balance as an Advance / Credit with a positive magnitude", () => {
    expect(describePayable(-300)).toEqual({
      isCredit: true,
      amount: 300,
      label: "Advance / Credit",
    });
  });

  it("treats zero as a (zero) Payable", () => {
    expect(describePayable(0)).toMatchObject({ isCredit: false, amount: 0 });
  });
});
