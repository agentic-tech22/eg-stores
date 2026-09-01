// Pin the zone before anything constructs a Date: `isoDateTime` renders local
// time, and the whole point of these assertions is that a UTC timestamp lands
// on the shop's wall clock (Kathmandu is +05:45 — a 45-minute offset catches
// bugs that a whole-hour zone would hide).
process.env.TZ = "Asia/Kathmandu";

import { describe, expect, it } from "vitest";
import { buildExportFilename } from "./filename";
import {
  amount,
  attributes,
  bool,
  isoDate,
  isoDateTime,
  marginPercent,
  money,
  num,
} from "./format";

describe("isoDate", () => {
  it("passes a date-only string through", () => {
    expect(isoDate("2026-08-09")).toBe("2026-08-09");
  });

  it("truncates a timestamp to its date part", () => {
    expect(isoDate("2026-08-09T14:32:05.123Z")).toBe("2026-08-09");
  });

  it("returns empty for null, undefined and malformed input", () => {
    expect(isoDate(null)).toBe("");
    expect(isoDate(undefined)).toBe("");
    expect(isoDate("")).toBe("");
    expect(isoDate("not a date")).toBe("");
  });
});

describe("isoDateTime", () => {
  it("renders a UTC timestamp in local time, space-separated", () => {
    expect(isoDateTime("2026-08-09T00:00:00Z")).toBe("2026-08-09 05:45:00");
  });

  it("has no T separator and no zone suffix — Excel reads those as text", () => {
    const out = isoDateTime("2026-08-09T18:30:00Z");
    expect(out).not.toContain("T");
    expect(out).not.toContain("Z");
    expect(out).toBe("2026-08-10 00:15:00");
  });

  it("returns empty for null and unparseable input", () => {
    expect(isoDateTime(null)).toBe("");
    expect(isoDateTime("nonsense")).toBe("");
  });
});

describe("amount", () => {
  it("fixes float drift to two decimals", () => {
    expect(amount(1234.5600000000001)).toBe("1234.56");
  });

  it("keeps negatives negative and collapses -0", () => {
    expect(amount(-250)).toBe("-250.00");
    expect(amount(-0)).toBe("0.00");
  });

  it("emits no symbol or thousands separator", () => {
    expect(amount(1234567.5)).toBe("1234567.50");
  });

  it("returns empty for null and undefined", () => {
    expect(amount(null)).toBe("");
    expect(amount(undefined)).toBe("");
  });
});

describe("num / bool / money", () => {
  it("formats counts", () => {
    expect(num(12)).toBe("12");
    expect(num(null)).toBe("");
  });

  it("formats booleans readably", () => {
    expect(bool(true)).toBe("Yes");
    expect(bool(false)).toBe("No");
    expect(bool(null)).toBe("");
  });

  it("tags a money header with the currency code", () => {
    expect(money("Total", "NPR")).toBe("Total (NPR)");
  });
});

describe("attributes / marginPercent", () => {
  it("flattens a variant attribute map", () => {
    expect(attributes({ Color: "Red", Size: "M" })).toBe("Color=Red; Size=M");
    expect(attributes(null)).toBe("");
  });

  it("computes margin against price", () => {
    expect(marginPercent(1000, 600)).toBe("40.00");
    expect(marginPercent(0, 600)).toBe("");
    expect(marginPercent(1000, null)).toBe("");
  });
});

describe("buildExportFilename", () => {
  it("names a bounded export by its range", () => {
    expect(
      buildExportFilename("sales", { start: "2026-01-01", end: "2026-08-09" }),
    ).toBe("sales_2026-01-01_to_2026-08-09.csv");
  });

  it("stamps an unbounded export with the run date", () => {
    expect(buildExportFilename("customers", null, new Date(2026, 7, 9))).toBe(
      "customers_all-time_2026-08-09.csv",
    );
  });

  it("slugs the dataset key", () => {
    expect(
      buildExportFilename("Sale Line Items", null, new Date(2026, 7, 9)),
    ).toBe("sale-line-items_all-time_2026-08-09.csv");
  });
});
