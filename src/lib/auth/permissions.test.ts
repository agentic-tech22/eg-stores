import { describe, it, expect } from "vitest";
import { sanitizePermissions, ALL_PERMISSION_IDS } from "./permissions";

describe("sanitizePermissions: defends against forged/stale grants", () => {
  it("keeps only ids present in the catalog", () => {
    const input = ["sales.view", "sales.create", "not.a.real.permission"];
    expect(sanitizePermissions(input)).toEqual(["sales.view", "sales.create"]);
  });

  it("drops non-string and malformed entries", () => {
    const input = ["products.view", 42, null, undefined, { id: "x" }, "products.view"];
    expect(sanitizePermissions(input)).toEqual(["products.view", "products.view"]);
  });

  it("returns [] for non-array input", () => {
    expect(sanitizePermissions("sales.view")).toEqual([]);
    expect(sanitizePermissions(null)).toEqual([]);
    expect(sanitizePermissions(undefined)).toEqual([]);
  });

  it("passes through the full catalog unchanged", () => {
    expect(sanitizePermissions([...ALL_PERMISSION_IDS])).toEqual(ALL_PERMISSION_IDS);
  });
});
