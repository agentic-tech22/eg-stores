import { createAdminClient } from "@/lib/supabase/server";
import type { NcmBranchRow, NcmSettingsRow } from "@/types/ncm.types";

/**
 * NCM config/branch reads use the service-role client (these tables have no
 * public RLS policy). The service layer gates access with `settings.ncm` /
 * `shipments.*` permissions.
 */

export async function getNcmSettings(): Promise<NcmSettingsRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ncm_settings")
    .select("*")
    .eq("id", true)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch NCM settings:", error.message);
    return null;
  }
  return data as NcmSettingsRow | null;
}

export async function getCachedBranches(): Promise<NcmBranchRow[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("ncm_branches")
    .select("*")
    .order("name", { ascending: true });

  if (error) {
    console.error("Failed to fetch NCM branches:", error.message);
    return [];
  }
  return (data ?? []) as NcmBranchRow[];
}
