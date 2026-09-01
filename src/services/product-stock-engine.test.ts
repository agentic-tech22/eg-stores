import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AuthContext } from "@/types/user.types";
import { planShapeChange, retireStock } from "./product-stock-engine";

describe("planShapeChange", () => {
  it("treats an absent hasVariants as leaving the shape alone", () => {
    // A price-only edit must never be read as "make this product simple", or it
    // would wipe every variant's stock as a side effect.
    expect(
      planShapeChange({ wasVariantProduct: true, nextHasVariants: undefined }),
    ).toEqual({
      becomesVariantProduct: true,
      convertingToVariants: false,
      convertingToSimple: false,
    });

    expect(
      planShapeChange({ wasVariantProduct: false, nextHasVariants: undefined }),
    ).toEqual({
      becomesVariantProduct: false,
      convertingToVariants: false,
      convertingToSimple: false,
    });
  });

  it("detects simple -> variants", () => {
    expect(
      planShapeChange({ wasVariantProduct: false, nextHasVariants: true }),
    ).toEqual({
      becomesVariantProduct: true,
      convertingToVariants: true,
      convertingToSimple: false,
    });
  });

  it("detects variants -> simple", () => {
    expect(
      planShapeChange({ wasVariantProduct: true, nextHasVariants: false }),
    ).toEqual({
      becomesVariantProduct: false,
      convertingToVariants: false,
      convertingToSimple: true,
    });
  });

  it("reports no conversion when the shape is resubmitted unchanged", () => {
    expect(
      planShapeChange({ wasVariantProduct: true, nextHasVariants: true }),
    ).toEqual({
      becomesVariantProduct: true,
      convertingToVariants: false,
      convertingToSimple: false,
    });
    expect(
      planShapeChange({ wasVariantProduct: false, nextHasVariants: false }),
    ).toEqual({
      becomesVariantProduct: false,
      convertingToVariants: false,
      convertingToSimple: false,
    });
  });
});

/* ------------------------------------------------------------------ */

interface StockRow {
  warehouse_id: string;
  variant_id: string | null;
  stock_quantity: number;
}

interface RpcCall {
  warehouseId: string;
  variantId: string | null;
  newQty: number;
}

/**
 * A stand-in for the Supabase client that records what `retireStock` asks it to
 * do. This covers the part the database cannot check for us: which rows get
 * selected, that EVERY stocked warehouse is swept rather than just the default,
 * and that each zeroing writes an audit row. The RPC's own atomicity is covered
 * by the integration suite.
 */
function fakeClient(rows: StockRow[]) {
  const rpcCalls: RpcCall[] = [];
  const auditRows: Record<string, unknown>[] = [];
  let gtApplied = false;

  const client = {
    from(table: string) {
      if (table === "stock_movements") {
        return {
          insert(row: Record<string, unknown>) {
            auditRows.push(row);
            return Promise.resolve({ error: null });
          },
        };
      }

      // warehouse_stock: a tiny chainable query builder over `rows`.
      let filtered = rows;
      let variantFilter: { applied: boolean; id: string | null } = {
        applied: false,
        id: null,
      };

      const builder = {
        select() {
          return builder;
        },
        eq(column: string, value: string) {
          if (column === "variant_id") variantFilter = { applied: true, id: value };
          if (column === "warehouse_id") {
            filtered = filtered.filter((r) => r.warehouse_id === value);
          }
          return builder;
        },
        is(column: string, value: null) {
          if (column === "variant_id" && value === null) {
            variantFilter = { applied: true, id: null };
          }
          return builder;
        },
        gt(column: string, value: number) {
          if (column === "stock_quantity") {
            gtApplied = true;
            filtered = filtered.filter((r) => r.stock_quantity > value);
          }
          return builder;
        },
        maybeSingle() {
          const match = resolve()[0] ?? null;
          return Promise.resolve({ data: match, error: null });
        },
        then(onFulfilled: (v: { data: StockRow[]; error: null }) => unknown) {
          return Promise.resolve({ data: resolve(), error: null }).then(
            onFulfilled,
          );
        },
      };

      function resolve(): StockRow[] {
        if (!variantFilter.applied) return filtered;
        return filtered.filter((r) => r.variant_id === variantFilter.id);
      }

      return builder;
    },

    rpc(_name: string, params: Record<string, unknown>) {
      rpcCalls.push({
        warehouseId: params.p_warehouse_id as string,
        variantId: params.p_variant_id as string | null,
        newQty: params.p_new_qty as number,
      });
      // Reflect the write so a later read sees the new value.
      for (const row of rows) {
        if (
          row.warehouse_id === params.p_warehouse_id &&
          row.variant_id === (params.p_variant_id as string | null)
        ) {
          row.stock_quantity = params.p_new_qty as number;
        }
      }
      return Promise.resolve({ data: null, error: null });
    },
  };

  return {
    client: client as unknown as SupabaseClient,
    rpcCalls,
    auditRows,
    sawStockFilter: () => gtApplied,
  };
}

const ctx = {
  userId: "u1",
  email: "cashier@shop.test",
} as unknown as AuthContext;

describe("retireStock", () => {
  it("zeroes the product-level row in every warehouse holding stock", async () => {
    const fake = fakeClient([
      { warehouse_id: "w1", variant_id: null, stock_quantity: 4 },
      { warehouse_id: "w2", variant_id: null, stock_quantity: 7 },
      { warehouse_id: "w3", variant_id: null, stock_quantity: 2 },
    ]);

    const swept = await retireStock(fake.client, {
      productId: "p1",
      variantId: null,
      productTitle: "T-Shirt",
      variantLabel: null,
      ctx,
    });

    // The original bug retired only the default warehouse; w2 and w3 must go too.
    expect(swept).toEqual(["w1", "w2", "w3"]);
    expect(fake.rpcCalls).toEqual([
      { warehouseId: "w1", variantId: null, newQty: 0 },
      { warehouseId: "w2", variantId: null, newQty: 0 },
      { warehouseId: "w3", variantId: null, newQty: 0 },
    ]);
  });

  it("leaves variant rows alone when retiring product-level stock", async () => {
    const fake = fakeClient([
      { warehouse_id: "w1", variant_id: null, stock_quantity: 4 },
      { warehouse_id: "w1", variant_id: "v1", stock_quantity: 9 },
    ]);

    await retireStock(fake.client, {
      productId: "p1",
      variantId: null,
      productTitle: "T-Shirt",
      variantLabel: null,
      ctx,
    });

    expect(fake.rpcCalls).toEqual([
      { warehouseId: "w1", variantId: null, newQty: 0 },
    ]);
  });

  it("retires only the named variant, not its siblings", async () => {
    const fake = fakeClient([
      { warehouse_id: "w1", variant_id: "v1", stock_quantity: 3 },
      { warehouse_id: "w2", variant_id: "v1", stock_quantity: 6 },
      { warehouse_id: "w1", variant_id: "v2", stock_quantity: 5 },
    ]);

    const swept = await retireStock(fake.client, {
      productId: "p1",
      variantId: "v1",
      productTitle: "T-Shirt",
      variantLabel: "Red / M",
      ctx,
    });

    expect(swept).toEqual(["w1", "w2"]);
    expect(fake.rpcCalls).toEqual([
      { warehouseId: "w1", variantId: "v1", newQty: 0 },
      { warehouseId: "w2", variantId: "v1", newQty: 0 },
    ]);
  });

  it("skips warehouses already at zero so no empty audit rows are written", async () => {
    const fake = fakeClient([
      { warehouse_id: "w1", variant_id: null, stock_quantity: 0 },
      { warehouse_id: "w2", variant_id: null, stock_quantity: 5 },
    ]);

    const swept = await retireStock(fake.client, {
      productId: "p1",
      variantId: null,
      productTitle: "T-Shirt",
      variantLabel: null,
      ctx,
    });

    expect(fake.sawStockFilter()).toBe(true);
    expect(swept).toEqual(["w2"]);
    expect(fake.auditRows).toHaveLength(1);
  });

  it("does nothing at all when the product holds no stock anywhere", async () => {
    const fake = fakeClient([]);

    const swept = await retireStock(fake.client, {
      productId: "p1",
      variantId: null,
      productTitle: "T-Shirt",
      variantLabel: null,
      ctx,
    });

    expect(swept).toEqual([]);
    expect(fake.rpcCalls).toEqual([]);
    expect(fake.auditRows).toEqual([]);
  });

  it("audits each retirement so the units show up in the product's history", async () => {
    const fake = fakeClient([
      { warehouse_id: "w1", variant_id: "v1", stock_quantity: 4 },
    ]);

    await retireStock(fake.client, {
      productId: "p1",
      variantId: "v1",
      productTitle: "T-Shirt",
      variantLabel: "Red / M",
      ctx,
    });

    expect(fake.auditRows).toHaveLength(1);
    expect(fake.auditRows[0]).toMatchObject({
      type: "edit",
      product_id: "p1",
      variant_id: "v1",
      product_title: "T-Shirt",
      variant_label: "Red / M",
      warehouse_id: "w1",
      old_value: 4,
      new_value: 0,
      created_by_email: "cashier@shop.test",
    });
  });
});
