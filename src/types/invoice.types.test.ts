import { describe, it, expect } from "vitest";
import {
  formatInvoiceNumber,
  isBusinessProfileReady,
  type BusinessProfile,
} from "./invoice.types";

describe("formatInvoiceNumber", () => {
  it("zero-pads the counter to 4 digits with the prefix", () => {
    expect(formatInvoiceNumber("INV", 1)).toBe("INV-0001");
    expect(formatInvoiceNumber("INV", 42)).toBe("INV-0042");
  });
  it("does not truncate counters beyond 4 digits", () => {
    expect(formatInvoiceNumber("INV", 12345)).toBe("INV-12345");
  });
});

describe("isBusinessProfileReady", () => {
  const base = { shopName: "Shop" } as BusinessProfile;

  it("is false for a null profile", () => {
    expect(isBusinessProfileReady(null)).toBe(false);
  });
  it("is false when the shop name is missing or blank", () => {
    expect(isBusinessProfileReady({ ...base, shopName: null })).toBe(false);
    expect(isBusinessProfileReady({ ...base, shopName: "   " })).toBe(false);
  });
  it("is true once a non-blank shop name is set", () => {
    expect(isBusinessProfileReady({ ...base, shopName: "Binod Store" })).toBe(true);
  });
});
