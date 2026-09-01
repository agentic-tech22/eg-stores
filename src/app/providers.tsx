"use client";

import { useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { ConfirmProvider } from "@/components/molecules/confirm-dialog/confirm-context";
import { GlobalLoaderProvider } from "@/components/molecules/global-loader/global-loader";
import { MutationLoaderBridge } from "@/components/molecules/global-loader/mutation-loader-bridge";
import { OfflineBanner } from "@/components/molecules/offline-banner/offline-banner";
import { makeQueryClient } from "@/lib/react-query/query-client";

/**
 * Client-side data providers, scoped to the admin dashboard. The QueryClient is
 * created once per browser session via lazy `useState` initializer so it is not
 * recreated on re-render.
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => makeQueryClient());

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalLoaderProvider>
        <MutationLoaderBridge />
        <OfflineBanner />
        <ConfirmProvider>{children}</ConfirmProvider>
      </GlobalLoaderProvider>
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
