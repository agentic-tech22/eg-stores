import { describe, it, expect } from "vitest";
import { resolveCurrency, DEFAULT_CURRENCY_CODE } from "./currency";

describe("resolveCurrency", () => {
  it("resolves a known code to its { code, locale }", () => {
    expect(resolveCurrency("INR")).toEqual({ code: "INR", locale: "en-IN" });
    expect(resolveCurrency("NPR")).toEqual({ code: "NPR", locale: "en-NP" });
  });

  it("falls back to the default currency for unknown / empty codes", () => {
    const fallback = resolveCurrency("XYZ");
    expect(fallback.code).toBe(DEFAULT_CURRENCY_CODE);
    expect(resolveCurrency(null).code).toBe(DEFAULT_CURRENCY_CODE);
    expect(resolveCurrency(undefined).code).toBe(DEFAULT_CURRENCY_CODE);
  });
});
