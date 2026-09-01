import { vi } from "vitest";

/**
 * Unit-test setup. Some "pure" functions under test live in files that also
 * import Next server runtime APIs at module load (e.g. `next/headers` via the
 * Supabase server client). Those APIs throw outside a request context, so we
 * stub them globally. Tests that need real behaviour can still `vi.mock` per file.
 */
vi.mock("next/headers", () => ({
  cookies: () => ({
    get: () => undefined,
    getAll: () => [],
    set: () => {},
    delete: () => {},
  }),
  headers: () => new Map(),
}));

vi.mock("next/navigation", () => ({
  redirect: () => {
    throw new Error("redirect() called in a unit test");
  },
  notFound: () => {
    throw new Error("notFound() called in a unit test");
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath: () => {},
  revalidateTag: () => {},
  unstable_cache: (fn: unknown) => fn,
}));
