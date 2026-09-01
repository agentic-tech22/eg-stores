import { describe, it, expect } from "vitest";
import { qrDataValidation, statusDataValidation, generatePrn } from "./index";

describe("qrDataValidation (HMAC-SHA512)", () => {
  const params = { amount: "500", prn: "S-abc-123", remarks1: "r1", remarks2: "r2" };

  it("is deterministic for identical params", () => {
    expect(qrDataValidation(params)).toBe(qrDataValidation(params));
  });

  it("produces a hex SHA-512 digest (128 hex chars)", () => {
    expect(qrDataValidation(params)).toMatch(/^[a-f0-9]{128}$/);
  });

  it("changes when any signed field changes (tamper detection)", () => {
    const base = qrDataValidation(params);
    expect(qrDataValidation({ ...params, amount: "501" })).not.toBe(base);
    expect(qrDataValidation({ ...params, prn: "S-abc-124" })).not.toBe(base);
  });
});

describe("statusDataValidation", () => {
  it("is deterministic and hex-encoded", () => {
    expect(statusDataValidation("S-x-1")).toBe(statusDataValidation("S-x-1"));
    expect(statusDataValidation("S-x-1")).toMatch(/^[a-f0-9]{128}$/);
  });
  it("differs per PRN", () => {
    expect(statusDataValidation("S-x-1")).not.toBe(statusDataValidation("S-x-2"));
  });
});

describe("generatePrn", () => {
  it("stays within Fonepay's 25-char cap and is uniquely shaped", () => {
    const prn = generatePrn();
    expect(prn.length).toBeLessThanOrEqual(25);
    expect(prn).toMatch(/^S-[a-z0-9]+-[a-f0-9]{6}$/);
  });
});
