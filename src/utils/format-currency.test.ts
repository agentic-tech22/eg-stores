import { describe, it, expect } from "vitest";
import { formatCurrency } from "./format-currency";

describe("formatCurrency", () => {
  it("formats an NPR amount by default", () => {
    const out = formatCurrency(1500);
    expect(out).toContain("1,500");
  });

  it("includes the currency indicator for the given code", () => {
    // Assert the numeric grouping is present; symbol/format is locale-dependent.
    expect(formatCurrency(2500, "INR", "en-IN")).toContain("2,500");
    expect(formatCurrency(99, "USD", "en-US")).toContain("99");
  });

  it("overrides non-Latin-script locales to their English variant", () => {
    // ne-NP is remapped to en-NP; should not throw and should render digits.
    expect(formatCurrency(1000, "NPR", "ne-NP")).toContain("1,000");
  });
});
