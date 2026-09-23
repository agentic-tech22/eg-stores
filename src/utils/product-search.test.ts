import { describe, expect, it } from "vitest";
import {
  matchesSearch,
  productSearchText,
  searchTerms,
} from "./product-search";

const product = (
  title: string,
  description: string | null = null,
  sku = "SKU-00001",
) => ({ title, description, sku });

describe("searchTerms", () => {
  it("splits on any run of whitespace and lowercases", () => {
    expect(searchTerms("  Casio   WATCH ")).toEqual(["casio", "watch"]);
  });

  it("returns nothing for an empty or blank query", () => {
    expect(searchTerms("")).toEqual([]);
    expect(searchTerms("   ")).toEqual([]);
  });
});

describe("matchesSearch", () => {
  it("matches every term in any order", () => {
    // The reported bug: "casio" found products, "casio watch" found none,
    // because the title reads "casio belt watch 5361".
    const text = "casio belt watch 5361";
    expect(matchesSearch(text, searchTerms("casio watch"))).toBe(true);
    expect(matchesSearch(text, searchTerms("watch casio"))).toBe(true);
    expect(matchesSearch(text, searchTerms("casio"))).toBe(true);
  });

  it("requires all terms, not any of them", () => {
    expect(matchesSearch("casio belt watch", searchTerms("casio speaker"))).toBe(
      false,
    );
  });

  it("matches partial words, so a singular finds the plural", () => {
    expect(matchesSearch("soundcore R50i Earbuds", searchTerms("earbud"))).toBe(
      true,
    );
    expect(matchesSearch("Charger Adpter", searchTerms("charg"))).toBe(true);
  });

  it("ignores case on both sides", () => {
    expect(matchesSearch("OMEGA Automatic", searchTerms("omega"))).toBe(true);
    expect(matchesSearch("omega automatic", searchTerms("OMEGA"))).toBe(true);
  });

  it("matches everything when nothing was typed", () => {
    expect(matchesSearch("anything at all", [])).toBe(true);
  });
});

describe("productSearchText", () => {
  it("includes the category, so a product type finds its products", () => {
    // No speaker title contains the word "speaker"; the category is the only
    // place it appears.
    const text = productSearchText(product("Boombox X3"), "Speaker");
    expect(matchesSearch(text, searchTerms("speaker"))).toBe(true);
  });

  it("searches title, description and sku", () => {
    const text = productSearchText(
      product("Boombox X3", "Portable bluetooth", "SKU-00042"),
      "Speaker",
    );
    for (const query of ["boombox", "bluetooth", "sku-00042"]) {
      expect(matchesSearch(text, searchTerms(query))).toBe(true);
    }
  });

  it("copes with a missing description or category", () => {
    const text = productSearchText(product("Boombox X3", null), null);
    expect(text).toBe("Boombox X3 SKU-00001");
    expect(matchesSearch(text, searchTerms("boombox"))).toBe(true);
  });

  it("lets a category word and a title word combine", () => {
    const text = productSearchText(product("soundcore R50i"), "Earbuds");
    expect(matchesSearch(text, searchTerms("soundcore earbuds"))).toBe(true);
    expect(matchesSearch(text, searchTerms("jbl earbuds"))).toBe(false);
  });
});
