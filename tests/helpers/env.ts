import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Minimal `.env.test` loader (no dependency). Populates `process.env` with any
 * keys not already set, so CI (which sets real env) wins over the local file.
 * Called by the integration globalSetup and the DB helper.
 */
export function loadTestEnv(): void {
  try {
    const raw = readFileSync(resolve(process.cwd(), ".env.test"), "utf-8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  } catch {
    // No .env.test: rely on real process.env (e.g. CI). globalSetup validates.
  }
}
