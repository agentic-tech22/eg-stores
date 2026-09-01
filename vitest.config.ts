import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

/**
 * Two projects share one runner:
 *   - `unit`        : pure logic, no DB, no Next runtime. Fast; runs in CI on
 *                     every push. `vitest.setup.ts` stubs `next/*` server APIs so
 *                     functions living in server-adjacent files import cleanly.
 *   - `integration` : exercises the real Postgres RPCs (stock, invoice numbers)
 *                     against a local Supabase. Guarded by a globalSetup that
 *                     fails fast if the DB is unreachable (run `pnpm test:db:up`).
 */
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    projects: [
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "unit",
          environment: "node",
          include: ["src/**/*.test.ts"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
      {
        plugins: [tsconfigPaths()],
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          // Reuse the next/* stubs so importing engine modules (which pull in
          // the Supabase server client at load) resolves without a request ctx.
          setupFiles: ["./vitest.setup.ts"],
          globalSetup: ["./tests/integration/globalSetup.ts"],
          // DB tests mutate shared rows; keep them serial for deterministic state.
          fileParallelism: false,
          testTimeout: 20_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
