import { createClient } from "@supabase/supabase-js";
import { loadTestEnv } from "../helpers/env";

/**
 * Fail fast (with an actionable message) if the local test DB isn't reachable,
 * so the integration suite never silently "passes" with zero DB tests run.
 */
export default async function setup() {
  loadTestEnv();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      [
        "Integration tests need a local Supabase.",
        "  1) Start it:  pnpm test:db:up",
        "  2) Ensure .env.test has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY",
        "     (copy .env.test.example). Then re-run pnpm test:integration.",
      ].join("\n"),
    );
  }

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  // A trivial read that also proves the schema is loaded (business_profile is
  // seeded by supabase-schema.sql).
  const { error } = await db.from("business_profile").select("id").limit(1);
  if (error) {
    throw new Error(
      `Could not query the test DB (${url}). Is it running and is the schema loaded? Run \`pnpm test:db:up\`.\nUnderlying error: ${error.message}`,
    );
  }
}
