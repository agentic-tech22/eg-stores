import { describe, expect, it } from "vitest";
import { pickAcrossCategories } from "./pick-across-categories";

const p = (id: string, categoryId: string | null) => ({ id, categoryId });

describe("pickAcrossCategories", () => {
  it("returns nothing for a zero or negative limit", () => {
    expect(pickAcrossCategories([p("a", "watch")], 0)).toEqual([]);
    expect(pickAcrossCategories([p("a", "watch")], -1)).toEqual([]);
  });

  it("does not show several of the same category", () => {
    // The first bug this exists for: five featured watches turned the hero
    // into a watch shop.
    const picked = pickAcrossCategories(
      [
        p("w1", "watch"),
        p("w2", "watch"),
        p("w3", "watch"),
        p("e1", "earbuds"),
        p("c1", "charger"),
      ],
      3,
    );
    expect(picked.map((item) => item.id)).toEqual(["w1", "e1", "c1"]);
  });

  it("spreads across the category list instead of taking the first few", () => {
    // The second bug: "Jens Watch" and "Ladies watch" are two categories
    // holding the same kind of thing, and they sit next to each other. Taking
    // the first three categories put both in the hero.
    const picked = pickAcrossCategories(
      [
        p("mens-watch", "watch-mens"),
        p("ladies-watch", "watch-ladies"),
        p("earbuds", "earbuds"),
        p("charger", "charger"),
        p("powerbank", "powerbank"),
        p("speaker", "speaker"),
        p("holder", "holder"),
      ],
      3,
    );
    expect(picked.map((item) => item.id)).toEqual([
      "mens-watch",
      "charger",
      "holder",
    ]);
    // The two adjacent watch categories never both make it.
    expect(
      picked.filter((item) => item.categoryId?.startsWith("watch")),
    ).toHaveLength(1);
  });

  it("always includes the first and last category", () => {
    const items = ["a", "b", "c", "d", "e", "f"].map((id) => p(id, id));
    const picked = pickAcrossCategories(items, 3);
    expect(picked[0].id).toBe("a");
    expect(picked[picked.length - 1].id).toBe("f");
  });

  it("returns exactly `limit` distinct items when there is room", () => {
    for (const limit of [1, 2, 3, 4, 5]) {
      const items = Array.from({ length: 9 }, (_, i) =>
        p(`p${i}`, `cat${i}`),
      );
      const picked = pickAcrossCategories(items, limit);
      expect(picked).toHaveLength(limit);
      expect(new Set(picked.map((item) => item.id)).size).toBe(limit);
    }
  });

  it("picks the best of a category without reordering the categories", () => {
    // Pre-sorting the input to surface the dearer watch would move the watch
    // categories apart in the list, and the even sampling would stop keeping
    // them out of the same hero. So the choice is a comparator instead.
    const items = [
      { id: "cheap-mens-watch", categoryId: "watch-mens", price: 1000 },
      { id: "dear-mens-watch", categoryId: "watch-mens", price: 20000 },
      { id: "ladies-watch", categoryId: "watch-ladies", price: 4000 },
      { id: "earbuds", categoryId: "earbuds", price: 5000 },
      { id: "charger", categoryId: "charger", price: 2000 },
      { id: "speaker", categoryId: "speaker", price: 3000 },
      { id: "holder", categoryId: "holder", price: 500 },
    ];
    const picked = pickAcrossCategories(items, 3, (a, b) => b.price - a.price);

    // The dear watch represents its category, not the cheap one that came first.
    expect(picked.map((item) => item.id)).toEqual([
      "dear-mens-watch",
      "charger",
      "holder",
    ]);
    // And the two watch categories still do not both appear.
    expect(
      picked.filter((item) => item.categoryId.startsWith("watch")),
    ).toHaveLength(1);
  });

  it("represents each category with the item the caller preferred", () => {
    // Caller order is preference order, so the featured charger wins its slot
    // over the one behind it.
    const picked = pickAcrossCategories(
      [p("c1", "charger"), p("w1", "watch"), p("c2", "charger")],
      2,
    );
    expect(picked.map((item) => item.id)).toEqual(["c1", "w1"]);
  });

  it("tops up from the leftovers when there are fewer categories than slots", () => {
    const picked = pickAcrossCategories(
      [p("w1", "watch"), p("w2", "watch"), p("e1", "earbuds")],
      3,
    );
    expect(picked.map((item) => item.id)).toEqual(["w1", "e1", "w2"]);
  });

  it("treats each uncategorised product as its own category", () => {
    const picked = pickAcrossCategories(
      [p("a", null), p("b", null), p("c", null)],
      3,
    );
    expect(picked.map((item) => item.id)).toEqual(["a", "b", "c"]);
  });

  it("never repeats a product that appears twice in the input", () => {
    // The home page concatenates the featured slice onto the full catalogue,
    // so duplicates are the normal case, not an edge one.
    const picked = pickAcrossCategories(
      [p("w1", "watch"), p("w1", "watch"), p("e1", "earbuds")],
      3,
    );
    expect(picked.map((item) => item.id)).toEqual(["w1", "e1"]);
  });

  it("returns everything it can when the catalogue is smaller than the limit", () => {
    expect(pickAcrossCategories([p("a", "x")], 4).map((i) => i.id)).toEqual([
      "a",
    ]);
    expect(pickAcrossCategories([], 4)).toEqual([]);
  });
});
