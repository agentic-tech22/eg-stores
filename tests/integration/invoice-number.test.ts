import { describe, it, expect } from "vitest";
import { getServiceClient } from "../helpers/db";

/**
 * Invoice numbers must be unique and gap-free even under concurrency, so the
 * atomicity lives in the `claim_invoice_number()` RPC (UPDATE ... RETURNING on
 * the singleton business_profile row), not in JS. Duplicate invoice numbers
 * across tenants at scale would be a compliance/accounting problem.
 */
const db = getServiceClient();

async function currentCounter(): Promise<number> {
  const { data, error } = await db
    .from("business_profile")
    .select("next_invoice_number")
    .eq("id", true)
    .single();
  if (error) throw error;
  return data.next_invoice_number;
}

describe("claim_invoice_number RPC: atomic sequential allocation", () => {
  it("returns the pre-increment value and advances the counter by one", async () => {
    const before = await currentCounter();
    const { data, error } = await db.rpc("claim_invoice_number");
    expect(error).toBeNull();
    expect(data).toBe(before);
    expect(await currentCounter()).toBe(before + 1);
  });

  it("hands out unique numbers under concurrent claims (no duplicates)", async () => {
    const before = await currentCounter();
    const N = 20;
    const claims = await Promise.all(
      Array.from({ length: N }, () => db.rpc("claim_invoice_number")),
    );
    const numbers = claims.map((r) => r.data as number);

    expect(new Set(numbers).size).toBe(N); // all unique
    // They form the contiguous block [before, before + N)
    expect([...numbers].sort((a, b) => a - b)).toEqual(
      Array.from({ length: N }, (_, i) => before + i),
    );
    expect(await currentCounter()).toBe(before + N);
  });
});
