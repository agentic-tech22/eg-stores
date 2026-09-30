import { describe, expect, it } from "vitest";
import { SORT_OPTIONS, sortProducts, type SortValue } from "./product-sort";

const item = (
  title: string,
  price: number,
  createdAt: string,
  isFeatured = false,
  sortOrder = 0,
) => ({ title, price, createdAt, isFeatured, sortOrder });

const catalogue = [
  item("Charger", 2000, "2026-01-02T00:00:00Z"),
  item("Amplifier", 9000, "2026-03-01T00:00:00Z"),
  item("Bracket", 500, "2026-02-01T00:00:00Z"),
];

const titles = (sort: SortValue) =>
  sortProducts(catalogue, sort).map((p) => p.title);

describe("sortProducts", () => {
  it("orders by price, both ways", () => {
    expect(titles("price-low")).toEqual(["Bracket", "Charger", "Amplifier"]);
    expect(titles("price-high")).toEqual(["Amplifier", "Charger", "Bracket"]);
  });

  it("puts the most recent first for newest", () => {
    expect(titles("newest")).toEqual(["Amplifier", "Bracket", "Charger"]);
  });

  it("orders by name A to Z", () => {
    expect(titles("name")).toEqual(["Amplifier", "Bracket", "Charger"]);
  });

  it("puts flagged products first, then the shop's own order", () => {
    const products = [
      item("plain b", 100, "2026-01-01T00:00:00Z", false, 2),
      item("featured", 100, "2026-01-01T00:00:00Z", true, 9),
      item("plain a", 100, "2026-01-01T00:00:00Z", false, 1),
    ];
    expect(sortProducts(products, "featured").map((p) => p.title)).toEqual([
      "featured",
      "plain a",
      "plain b",
    ]);
  });

  it("never mutates the list it was given", () => {
    // The listing sorts the array it just filtered and still holds a reference
    // to it; an in-place sort would reorder that underneath it.
    const original = [...catalogue];
    sortProducts(catalogue, "price-high");
    expect(catalogue).toEqual(original);
  });

  it("handles every option the dropdown offers", () => {
    for (const option of SORT_OPTIONS) {
      expect(sortProducts(catalogue, option.value)).toHaveLength(
        catalogue.length,
      );
    }
  });

  it("copes with an empty or single-item list", () => {
    expect(sortProducts([], "price-low")).toEqual([]);
    expect(sortProducts([catalogue[0]], "name")).toEqual([catalogue[0]]);
  });
});
