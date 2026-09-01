import { describe, it, expect, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getServiceClient,
  seedProductWithStock,
  warehouseStock,
  cleanupSeed,
  type SeededProduct,
} from "../helpers/db";
import { deductLines, type ResolvedLine } from "@/services/sale-engine";

/**
 * The oversell guard is the #1 correctness risk when scaling: it lives inside
 * the Postgres `deduct_stock` RPC (atomic check-and-decrement), NOT in JS. These
 * tests exercise the real RPC + the sale-engine orchestration against a local DB.
 */
const db: SupabaseClient = getServiceClient();
let seed: SeededProduct | null = null;

afterEach(async () => {
  if (seed) await cleanupSeed(db, seed);
  seed = null;
});

const line = (productId: string, quantity: number): ResolvedLine => ({
  productId,
  productVariantId: null,
  productTitle: "Product",
  variantLabel: null,
  sku: null,
  quantity,
  unitPrice: 100,
  costAtSale: 40,
  lineTotal: 100 * quantity,
});

describe("deduct_stock RPC: atomic oversell guard", () => {
  it("decrements when enough stock is available", async () => {
    seed = await seedProductWithStock(db, { stock: 5 });
    const { data } = await db.rpc("deduct_stock", {
      p_warehouse_id: seed.warehouseId,
      p_product_id: seed.productId,
      p_qty: 3,
    });
    expect(data).toBe(true);
    expect((await warehouseStock(db, seed)).stock).toBe(2);
  });

  it("refuses to deduct below available (stock - reserved)", async () => {
    seed = await seedProductWithStock(db, { stock: 5, reserved: 4 });
    const { data } = await db.rpc("deduct_stock", {
      p_warehouse_id: seed.warehouseId,
      p_product_id: seed.productId,
      p_qty: 3, // only 1 is truly available
    });
    expect(data).toBe(false);
    expect((await warehouseStock(db, seed)).stock).toBe(5); // untouched
  });

  it("two concurrent deductions cannot both succeed (no oversell)", async () => {
    seed = await seedProductWithStock(db, { stock: 5 });
    const both = await Promise.all([
      db.rpc("deduct_stock", {
        p_warehouse_id: seed.warehouseId,
        p_product_id: seed.productId,
        p_qty: 3,
      }),
      db.rpc("deduct_stock", {
        p_warehouse_id: seed.warehouseId,
        p_product_id: seed.productId,
        p_qty: 3,
      }),
    ]);
    const successes = both.filter((r) => r.data === true).length;
    expect(successes).toBe(1); // exactly one wins
    expect((await warehouseStock(db, seed)).stock).toBe(2);
  });
});

describe("sale-engine deductLines: no partial deduction on failure", () => {
  it("restores earlier lines when a later line lacks stock", async () => {
    seed = await seedProductWithStock(db, { stock: 5 });
    // Two lines on the same product totalling 7 > 5: the second must fail and
    // the first must be rolled back, leaving stock untouched.
    const result = await deductLines(
      db as unknown as Parameters<typeof deductLines>[0],
      [line(seed.productId, 4), line(seed.productId, 3)],
      seed.warehouseId,
    );
    expect(result.error).toBeTruthy();
    expect((await warehouseStock(db, seed)).stock).toBe(5); // fully restored
  });
});
