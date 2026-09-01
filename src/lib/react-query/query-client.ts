import { QueryClient } from "@tanstack/react-query";

/**
 * Creates a QueryClient with the project defaults. A fresh client is created
 * once per browser session (see `src/app/providers.tsx`).
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}
