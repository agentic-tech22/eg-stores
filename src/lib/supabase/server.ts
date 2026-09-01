import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Ignore - this is called from Server Components where
            // cookies cannot be set. The middleware will handle refresh.
          }
        },
      },
    },
  );
}

/**
 * Service-role client without any user session, exposing the Supabase Auth
 * Admin API (`.auth.admin.*`). Use this for user management (create/list/delete
 * accounts). Never expose this to the browser. All callers must gate access in
 * application code: this client bypasses Row Level Security.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}

// NOTE: Do not add a service-role client built on `createServerClient` (the
// @supabase/ssr cookie-bound client). Even when given the service-role key, it
// attaches the caller's session JWT as the auth bearer, so Postgres/Storage
// resolve the role as that user and RLS is still enforced, not a true bypass.
// For service-role work (incl. Storage uploads) use `createAdminClient()` above,
// which has no user session and genuinely runs as service_role.
