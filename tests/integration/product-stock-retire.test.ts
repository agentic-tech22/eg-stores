import { describe, it, expect, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getServiceClient,
  seedAcrossWarehouses,
  allStockRows,
  stockEditMovements,
  cleanupMultiWarehouse,
  type SeededMultiWarehouse,
} from "../helpers/db";
import { retireStock } from "@/services/product-stock-engine";
import type { AuthContext } from "@/types/user.types";

/**
 * Retiring stock is the irreversible half of changing a product's shape, and it
 * runs through the `set_warehouse_stock` RPC, which also rewrites the cached
 * row totals. Only a real database can prove that: these exercise the RPC and
 * the audit trail end to end.
 */
const db: SupabaseClient = getServiceClient();
let seed: SeededMultiWarehouse | null = null;

afterEach(async () => {
  if (seed) await cleanupMultiWarehouse(db, seed);
  seed = null;
});

const ctx = {
  userId: null,
  email: "integration@test.local",
} as unknown as AuthContext;

async function productTotal(productId: string): Promise<number> {
  const { data, error } = await db
    .from("products")
    .select("stock_quantity")
    .eq("id", productId)
    .single();
  if (error) throw error;
  return data.stock_quantity;
}

async function variantTotal(variantId: string): Promise<number> {
  const { data, error } = await db
    .from("product_variants")
    .select("stock_quantity")
    .eq("id", variantId)
    .single();
  if (error) throw error;
  return data.stock_quantity;
}

describe("retireStock: product-level stock (simple -> variants)", () => {
  it("zeroes every warehouse, not just one", async () => {
    seed = await seedAcrossWarehouses(db, {
      warehouses: 3,
      stockPerWarehouse: 4,
    });

    const swept = await retireStock(db, {
      productId: seed.productId,
      variantId: null,
      productTitle: "Product",
      variantLabel: null,
      ctx,
    });

    expect(swept.sort()).toEqual([...seed.warehouseIds].sort());
    const rows = await allStockRows(db, seed.productId);
    expect(rows.every((r) => r.stock === 0)).toBe(true);
  });

  it("brings the cached product total down with it", async () => {
    // The orphan bug's visible symptom: warehouse rows cleared but the product
    // still reporting units, or vice versa.
    seed = await seedAcrossWarehouses(db, {
      warehouses: 2,
      stockPerWarehouse: 5,
    });
    expect(await productTotal(seed.productId)).toBe(10);

    await retireStock(db, {
      productId: seed.productId,
      variantId: null,
      productTitle: "Product",
      variantLabel: null,
      ctx,
    });

    expect(await productTotal(seed.productId)).toBe(0);
  });

  it("records an audited edit per warehouse so the units appear in History", async () => {
    seed = await seedAcrossWarehouses(db, {
      warehouses: 2,
      stockPerWarehouse: 6,
    });

    await retireStock(db, {
      productId: seed.productId,
      variantId: null,
      productTitle: "Product",
      variantLabel: null,
      ctx,
    });

    const movements = await stockEditMovements(db, seed.productId);
    expect(movements).toHaveLength(2);
    expect(movements.every((m) => m.oldValue === 6 && m.newValue === 0)).toBe(
      true,
    );
  });

  it("is idempotent: retiring twice writes no second batch of audit rows", async () => {
    seed = await seedAcrossWarehouses(db, {
      warehouses: 2,
      stockPerWarehouse: 3,
    });

    await retireStock(db, {
      productId: seed.productId,
      variantId: null,
      productTitle: "Product",
      variantLabel: null,
      ctx,
    });
    const secondSweep = await retireStock(db, {
      productId: seed.productId,
      variantId: null,
      productTitle: "Product",
      variantLabel: null,
      ctx,
    });

    expect(secondSweep).toEqual([]);
    expect(await stockEditMovements(db, seed.productId)).toHaveLength(2);
  });
});

describe("retireStock: variant stock", () => {
  it("retires one variant across all warehouses and leaves its siblings alone", async () => {
    seed = await seedAcrossWarehouses(db, {
      warehouses: 2,
      stockPerWarehouse: 4,
      variants: ["Red / M", "Red / L"],
    });
    const [target, sibling] = seed.variantIds;

    await retireStock(db, {
      productId: seed.productId,
      variantId: target,
      productTitle: "Product",
      variantLabel: "Red / M",
      ctx,
    });

    const rows = await allStockRows(db, seed.productId);
    expect(
      rows.filter((r) => r.variantId === target).every((r) => r.stock === 0),
    ).toBe(true);
    expect(
      rows.filter((r) => r.variantId === sibling).every((r) => r.stock === 4),
    ).toBe(true);

    expect(await variantTotal(target)).toBe(0);
    expect(await variantTotal(sibling)).toBe(8);
  });

  it("clears every variant when the product converts back to simple", async () => {
    seed = await seedAcrossWarehouses(db, {
      warehouses: 2,
      stockPerWarehouse: 4,
      variants: ["Red / M", "Red / L"],
    });

    for (const variantId of seed.variantIds) {
      await retireStock(db, {
        productId: seed.productId,
        variantId,
        productTitle: "Product",
        variantLabel: "v",
        ctx,
      });
    }

    const rows = await allStockRows(db, seed.productId);
    expect(rows.every((r) => r.stock === 0)).toBe(true);
    for (const variantId of seed.variantIds) {
      expect(await variantTotal(variantId)).toBe(0);
    }
  });

  it("does not touch product-level rows while retiring a variant", async () => {
    seed = await seedAcrossWarehouses(db, {
      warehouses: 1,
      stockPerWarehouse: 4,
      variants: ["Red / M"],
    });
    // Add a stray product-level row alongside the variant rows.
    await db.from("warehouse_stock").insert({
      warehouse_id: seed.warehouseIds[0],
      product_id: seed.productId,
      variant_id: null,
      stock_quantity: 9,
      reserved_quantity: 0,
    });

    await retireStock(db, {
      productId: seed.productId,
      variantId: seed.variantIds[0],
      productTitle: "Product",
      variantLabel: "Red / M",
      ctx,
    });

    const rows = await allStockRows(db, seed.productId);
    expect(rows.find((r) => r.variantId === null)?.stock).toBe(9);
    expect(rows.find((r) => r.variantId !== null)?.stock).toBe(0);
  });
});
