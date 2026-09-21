import { describe, it, expect } from "vitest";
import {
  amountDue,
  hasCustomerIdentity,
  leavesDue,
  paymentStatusFor,
  roundMoney,
  sumPayments,
  validatePayment,
  clampDiscount,
} from "./sale-payment";

describe("sumPayments", () => {
  it("adds the ledger up, rounded to the stored precision", () => {
    expect(sumPayments([{ amount: 10.1 }, { amount: 20.2 }])).toBe(30.3);
  });
  it("is 0 for an empty ledger", () => {
    expect(sumPayments([])).toBe(0);
  });
});

describe("amountDue", () => {
  it("is the shortfall between total and paid", () => {
    expect(amountDue(1000, 400)).toBe(600);
  });
  it("is 0 when settled exactly", () => {
    expect(amountDue(1000, 1000)).toBe(0);
  });
  it("never goes negative on an overpayment", () => {
    expect(amountDue(1000, 1200)).toBe(0);
  });
});

describe("paymentStatusFor", () => {
  it("is 'pending' when nothing has been collected", () => {
    expect(paymentStatusFor(1000, 0)).toBe("pending");
  });
  it("is 'partial' while some of the total is still due", () => {
    expect(paymentStatusFor(1000, 250)).toBe("partial");
  });
  it("is 'paid' once the ledger covers the total", () => {
    expect(paymentStatusFor(1000, 1000)).toBe("paid");
    expect(paymentStatusFor(1000, 1500)).toBe("paid");
  });
  it("treats a sub-cent shortfall as paid, not partial", () => {
    // 0.1 + 0.2 = 0.30000000000000004 in float; that must not read as a due.
    expect(paymentStatusFor(0.1 + 0.2, 0.3)).toBe("paid");
  });
  it("is 'paid' for a zero-total sale with nothing collected", () => {
    expect(paymentStatusFor(0, 0)).toBe("paid");
  });
});

describe("leavesDue", () => {
  it("is true only when money is genuinely still owed", () => {
    expect(leavesDue(1000, 999)).toBe(true);
    expect(leavesDue(1000, 1000)).toBe(false);
    expect(leavesDue(1000, 999.999)).toBe(false); // within rounding tolerance
  });
});

describe("hasCustomerIdentity", () => {
  it("requires both a name and a 10-digit phone", () => {
    expect(hasCustomerIdentity({ name: "Asha", phone: "9812345678" })).toBe(true);
  });
  it("rejects a missing or blank name", () => {
    expect(hasCustomerIdentity({ name: "  ", phone: "9812345678" })).toBe(false);
    expect(hasCustomerIdentity({ phone: "9812345678" })).toBe(false);
  });
  it("rejects a short or missing phone", () => {
    expect(hasCustomerIdentity({ name: "Asha", phone: "98123" })).toBe(false);
    expect(hasCustomerIdentity({ name: "Asha" })).toBe(false);
  });
  it("counts digits only, ignoring separators", () => {
    expect(hasCustomerIdentity({ name: "Asha", phone: "+977 981-234-5678" })).toBe(
      true,
    );
  });
});

describe("roundMoney", () => {
  it("rounds to the 2 decimals the money columns store", () => {
    expect(roundMoney(10.567)).toBe(10.57);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });
});

describe("validatePayment", () => {
  const due = 500;

  it("accepts an amount within the due and returns it normalized", () => {
    const { value } = validatePayment({ amount: "250.456", paidOn: "2026-08-06" }, due);
    expect(value).toEqual({ amount: 250.46, paidOn: "2026-08-06" });
  });

  it("accepts settling the exact remaining balance", () => {
    expect(validatePayment({ amount: due, paidOn: "2026-08-06" }, due).value)
      .toEqual({ amount: 500, paidOn: "2026-08-06" });
  });

  it("rejects a blank, non-numeric, zero or negative amount", () => {
    for (const amount of ["", "  ", "abc", "0", "-10"]) {
      const { errors, value } = validatePayment({ amount }, due);
      expect(value, `amount ${JSON.stringify(amount)}`).toBeNull();
      expect(errors.amount).toBeTruthy();
    }
  });

  it("rejects an amount above the outstanding due", () => {
    const { errors, value } = validatePayment({ amount: due + 1 }, due);
    expect(value).toBeNull();
    expect(errors.amount).toBeTruthy();
  });

  it("rejects any payment once the sale is fully settled", () => {
    const { errors, value } = validatePayment({ amount: 1 }, 0);
    expect(value).toBeNull();
    expect(errors.amount).toBeTruthy();
  });

  it("defaults a missing date to today rather than failing", () => {
    const { value } = validatePayment({ amount: 100 }, due);
    expect(value?.paidOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("rejects a malformed date", () => {
    const { errors, value } = validatePayment(
      { amount: 100, paidOn: "06/08/2026" },
      due,
    );
    expect(value).toBeNull();
    expect(errors.paidOn).toBeTruthy();
  });
});

describe("clampDiscount", () => {
  it("passes a normal discount through", () => {
    expect(clampDiscount(150, 1000)).toBe(150);
  });

  it("caps a discount at the subtotal so the total never goes negative", () => {
    expect(clampDiscount(5000, 1000)).toBe(1000);
  });

  it("allows a discount exactly equal to the subtotal (a free item)", () => {
    expect(clampDiscount(1000, 1000)).toBe(1000);
  });

  it("treats a negative discount as none rather than inflating the total", () => {
    expect(clampDiscount(-250, 1000)).toBe(0);
  });

  it("reads blanks and junk from a form field as no discount", () => {
    expect(clampDiscount("", 1000)).toBe(0);
    expect(clampDiscount("abc", 1000)).toBe(0);
    expect(clampDiscount(null, 1000)).toBe(0);
    expect(clampDiscount(undefined, 1000)).toBe(0);
    expect(clampDiscount(NaN, 1000)).toBe(0);
  });

  it("parses a numeric string, as a form submits it", () => {
    expect(clampDiscount("99.5", 1000)).toBe(99.5);
  });

  it("rounds to the 2 decimals the money columns store", () => {
    expect(clampDiscount(10.005, 1000)).toBe(10.01);
    expect(clampDiscount(33.333333, 1000)).toBe(33.33);
  });

  it("yields nothing when there is no subtotal to discount", () => {
    expect(clampDiscount(50, 0)).toBe(0);
  });
});
