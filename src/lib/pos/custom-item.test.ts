import { describe, it, expect } from "vitest";
import {
  CUSTOM_ITEM_PRICE_MAX,
  CUSTOM_ITEM_QTY_MAX,
  CUSTOM_ITEM_TITLE_MAX,
  firstCustomItemError,
  validateCustomItem,
} from "./custom-item";

const valid = { title: "Repair charge", unitPrice: "250.50", quantity: "2" };

describe("validateCustomItem", () => {
  it("accepts a well-formed item and returns the normalized value", () => {
    expect(validateCustomItem(valid)).toEqual({
      errors: {},
      value: { title: "Repair charge", unitPrice: 250.5, quantity: 2 },
    });
  });

  it("accepts raw numbers as well as form strings", () => {
    const { value } = validateCustomItem({
      title: "Gift wrap",
      unitPrice: 40,
      quantity: 1,
    });
    expect(value).toEqual({ title: "Gift wrap", unitPrice: 40, quantity: 1 });
  });

  it("trims the title and collapses runs of whitespace", () => {
    const { value } = validateCustomItem({ ...valid, title: "  Repair   charge \n" });
    expect(value?.title).toBe("Repair charge");
  });

  it("rounds the unit price to the 2 decimals the money columns store", () => {
    const { value } = validateCustomItem({ ...valid, unitPrice: "10.567" });
    expect(value?.unitPrice).toBe(10.57);
  });

  it("rejects a blank or whitespace-only title", () => {
    for (const title of ["", "   "]) {
      const { errors, value } = validateCustomItem({ ...valid, title });
      expect(value).toBeNull();
      expect(errors.title).toBeTruthy();
    }
  });

  it("rejects a title over the length cap", () => {
    const { errors } = validateCustomItem({
      ...valid,
      title: "x".repeat(CUSTOM_ITEM_TITLE_MAX + 1),
    });
    expect(errors.title).toBeTruthy();
  });

  it("rejects a missing, non-numeric, zero or negative price", () => {
    for (const unitPrice of ["", "  ", "abc", "0", "-5"]) {
      const { errors, value } = validateCustomItem({ ...valid, unitPrice });
      expect(value, `price ${JSON.stringify(unitPrice)}`).toBeNull();
      expect(errors.unitPrice).toBeTruthy();
    }
  });

  it("rejects a price above the cap", () => {
    const { errors } = validateCustomItem({
      ...valid,
      unitPrice: CUSTOM_ITEM_PRICE_MAX + 1,
    });
    expect(errors.unitPrice).toBeTruthy();
  });

  it("rejects a missing, fractional, zero or negative quantity", () => {
    for (const quantity of ["", "abc", "1.5", "0", "-2"]) {
      const { errors, value } = validateCustomItem({ ...valid, quantity });
      expect(value, `qty ${JSON.stringify(quantity)}`).toBeNull();
      expect(errors.quantity).toBeTruthy();
    }
  });

  it("rejects a quantity above the cap", () => {
    const { errors } = validateCustomItem({
      ...valid,
      quantity: CUSTOM_ITEM_QTY_MAX + 1,
    });
    expect(errors.quantity).toBeTruthy();
  });

  it("rejects a line whose total overflows, even when both fields are in range", () => {
    const { errors, value } = validateCustomItem({
      title: "Bulk",
      unitPrice: CUSTOM_ITEM_PRICE_MAX,
      quantity: CUSTOM_ITEM_QTY_MAX,
    });
    expect(value).toBeNull();
    expect(errors.unitPrice).toBeUndefined();
    expect(errors.quantity).toBeTruthy();
  });

  it("reports every bad field at once", () => {
    const { errors } = validateCustomItem({
      title: "",
      unitPrice: "0",
      quantity: "0",
    });
    expect(Object.keys(errors).sort()).toEqual(["quantity", "title", "unitPrice"]);
  });

  it("tolerates untrusted non-string input (server boundary)", () => {
    const { value } = validateCustomItem({
      title: null as unknown as string,
      unitPrice: {} as unknown as number,
      quantity: undefined as unknown as number,
    });
    expect(value).toBeNull();
  });
});

describe("firstCustomItemError", () => {
  it("prefers the title error, then price, then quantity", () => {
    expect(
      firstCustomItemError({ title: "t", unitPrice: "p", quantity: "q" }),
    ).toBe("t");
    expect(firstCustomItemError({ unitPrice: "p", quantity: "q" })).toBe("p");
    expect(firstCustomItemError({ quantity: "q" })).toBe("q");
  });

  it("is null when nothing failed", () => {
    expect(firstCustomItemError({})).toBeNull();
  });
});
