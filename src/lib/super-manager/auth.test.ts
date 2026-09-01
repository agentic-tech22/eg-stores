import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { isValidPinShape, pinMatches } from "./auth";

describe("isValidPinShape", () => {
  it("accepts exactly 4 digits", () => {
    expect(isValidPinShape("0000")).toBe(true);
    expect(isValidPinShape("9137")).toBe(true);
  });
  it("rejects non-4-digit / non-numeric shapes", () => {
    expect(isValidPinShape("123")).toBe(false);
    expect(isValidPinShape("12345")).toBe(false);
    expect(isValidPinShape("12a4")).toBe(false);
    expect(isValidPinShape("")).toBe(false);
  });
});

describe("pinMatches", () => {
  const original = process.env.SUPER_MANAGER_PIN;
  afterEach(() => {
    process.env.SUPER_MANAGER_PIN = original;
  });

  it("returns false when no PIN is configured", () => {
    delete process.env.SUPER_MANAGER_PIN;
    expect(pinMatches("1234")).toBe(false);
  });

  describe("with a configured PIN", () => {
    beforeEach(() => {
      process.env.SUPER_MANAGER_PIN = "4271";
    });
    it("matches the exact PIN", () => {
      expect(pinMatches("4271")).toBe(true);
    });
    it("rejects a wrong or differently-shaped PIN", () => {
      expect(pinMatches("4270")).toBe(false);
      expect(pinMatches("42710")).toBe(false);
    });
  });
});
