import { describe, it, expect } from "vitest";
import {
  computeEarnedPoints,
  computeLoyaltyBalance,
  mapCustomerRow,
} from "./customer-engine";
import type { BusinessProfile } from "@/types/invoice.types";
import type { CustomerRow } from "@/types/customer.types";

type LoyaltyConfig = Pick<
  BusinessProfile,
  "loyaltyEnabled" | "loyaltyEarnMode" | "loyaltyEarnRate"
>;

const profile = (over: Partial<LoyaltyConfig>): LoyaltyConfig => ({
  loyaltyEnabled: true,
  loyaltyEarnMode: "percent",
  loyaltyEarnRate: 10,
  ...over,
});

describe("computeEarnedPoints", () => {
  it("returns 0 when loyalty is disabled", () => {
    expect(computeEarnedPoints(profile({ loyaltyEnabled: false }), 1000)).toBe(0);
  });

  it("returns 0 when the profile is null", () => {
    expect(computeEarnedPoints(null, 1000)).toBe(0);
  });

  it("returns 0 when the earn rate is zero or negative", () => {
    expect(computeEarnedPoints(profile({ loyaltyEarnRate: 0 }), 1000)).toBe(0);
    expect(computeEarnedPoints(profile({ loyaltyEarnRate: -5 }), 1000)).toBe(0);
  });

  it("percent mode grants floor(total * rate / 100)", () => {
    expect(computeEarnedPoints(profile({ loyaltyEarnRate: 10 }), 1999)).toBe(199);
  });

  it("flat mode grants a fixed round(rate) regardless of total", () => {
    const flat = profile({ loyaltyEarnMode: "flat", loyaltyEarnRate: 5.4 });
    expect(computeEarnedPoints(flat, 10)).toBe(5);
    expect(computeEarnedPoints(flat, 100000)).toBe(5);
  });
});

describe("computeLoyaltyBalance", () => {
  it("is the signed sum of the ledger (earn +, redeem -)", () => {
    expect(
      computeLoyaltyBalance([{ points: 100 }, { points: -30 }, { points: 5 }]),
    ).toBe(75);
  });

  it("treats null point rows as 0 and empty ledgers as 0", () => {
    expect(computeLoyaltyBalance([])).toBe(0);
    expect(
      computeLoyaltyBalance([
        { points: null as unknown as number },
        { points: 10 },
      ]),
    ).toBe(10);
  });
});

describe("mapCustomerRow: membership", () => {
  const row = (over: Partial<CustomerRow> = {}): CustomerRow => ({
    id: "c1",
    name: "Asha",
    phone: "9800000000",
    email: null,
    address: null,
    notes: null,
    is_active: true,
    is_member: false,
    dob: null,
    citizenship_number: null,
    citizenship_photo_path: null,
    sort_order: 0,
    created_by: null,
    created_by_email: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...over,
  });

  it("defaults a customer to a non-member", () => {
    expect(mapCustomerRow(row()).isMember).toBe(false);
  });

  it("carries the flag through when the customer has subscribed", () => {
    expect(mapCustomerRow(row({ is_member: true })).isMember).toBe(true);
  });

  it("treats a row written before the column existed as a non-member", () => {
    // Older rows come back without the key rather than with false.
    const legacy = row();
    delete (legacy as Partial<CustomerRow>).is_member;
    expect(mapCustomerRow(legacy).isMember).toBe(false);
  });
});
