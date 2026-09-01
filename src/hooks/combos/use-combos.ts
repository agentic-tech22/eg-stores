"use client";

import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/react-query/keys";
import { fetchCombos } from "@/services/combo.service";
import type { ComboWithItems } from "@/types/product.types";

/**
 * Reads the combo list. Seeded with the server-fetched `initialData` so the
 * admin table paints immediately, then stays in sync via cache invalidation.
 */
export function useCombos(initialData: ComboWithItems[]) {
  return useQuery({
    queryKey: queryKeys.combos.list(),
    queryFn: fetchCombos,
    initialData,
  });
}
