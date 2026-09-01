import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// session.ts imports the Supabase server client at module load; stub it so the
// pure helpers below can be imported without a Next request / real Supabase.
vi.mock("@/lib/supabase/server", () => ({
  createAdminClient: vi.fn(),
  createServerSupabaseClient: vi.fn(),
}));

import { ctxHasPermission, isSuperAdminEmail } from "./session";
import type { AuthContext } from "@/types/user.types";

const ctx = (over: Partial<AuthContext>): AuthContext =>
  ({
    userId: "u1",
    email: "staff@shop.np",
    role: "member",
    permissions: [],
    defaultWarehouseId: null,
    isActive: true,
    isAdmin: false,
    isSuperAdmin: false,
    ...over,
  }) as AuthContext;

describe("ctxHasPermission", () => {
  it("denies everything for a null context", () => {
    expect(ctxHasPermission(null, "sales.create")).toBe(false);
  });

  it("grants any permission to an admin implicitly", () => {
    expect(ctxHasPermission(ctx({ isAdmin: true }), "sales.delete")).toBe(true);
  });

  it("grants a member only their explicitly listed permissions", () => {
    const member = ctx({ permissions: ["sales.view"] });
    expect(ctxHasPermission(member, "sales.view")).toBe(true);
    expect(ctxHasPermission(member, "sales.create")).toBe(false);
  });
});

describe("isSuperAdminEmail", () => {
  const original = process.env.SUPER_ADMIN_EMAILS;
  beforeEach(() => {
    process.env.SUPER_ADMIN_EMAILS = "owner@biz.com, Boss@Biz.com";
  });
  afterEach(() => {
    process.env.SUPER_ADMIN_EMAILS = original;
  });

  it("matches case-insensitively against the allowlist", () => {
    expect(isSuperAdminEmail("owner@biz.com")).toBe(true);
    expect(isSuperAdminEmail("BOSS@biz.com")).toBe(true);
  });

  it("rejects non-listed and empty emails", () => {
    expect(isSuperAdminEmail("someone@else.com")).toBe(false);
    expect(isSuperAdminEmail(null)).toBe(false);
    expect(isSuperAdminEmail(undefined)).toBe(false);
  });
});
