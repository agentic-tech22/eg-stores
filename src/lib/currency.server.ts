import { cache } from "react";
import { getBusinessProfile } from "@/queries/invoice.query";
import {
  DEFAULT_CURRENCY_CODE,
  resolveCurrency,
  type CurrencyConfig,
} from "@/lib/currency";

/**
 * The active business currency, memoized per request. Reads the single
 * business_profile row with the service-role client (no auth), so it is safe to
 * call from public storefront pages as well as the dashboard.
 *
 * Server-only: importing this from a client component is a build error, which
 * keeps the Supabase server client out of the client bundle.
 */
export const getActiveCurrency = cache(async (): Promise<CurrencyConfig> => {
  try {
    const row = await getBusinessProfile();
    return resolveCurrency(row?.currency ?? DEFAULT_CURRENCY_CODE);
  } catch {
    return resolveCurrency(DEFAULT_CURRENCY_CODE);
  }
});
