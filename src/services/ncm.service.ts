"use server";

import { randomBytes } from "crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { getCachedBranches, getNcmSettings } from "@/queries/ncm.query";
import { getOrderById } from "@/queries/order.query";
import { applyNcmStatus } from "@/lib/ncm/sync";
import {
  createNcmComment,
  createNcmOrder,
  getNcmOrderComments,
  getNcmOrderStatus,
  listNcmBranches,
  markNcmReturn,
  ncmBaseUrl,
  type NcmBranchRaw,
  type NcmConfig,
} from "@/lib/ncm/client";
import type {
  NcmBranch,
  NcmComment,
  NcmDeliveryType,
  NcmEnvironment,
  NcmSettings,
  NcmSettingsRow,
} from "@/types/ncm.types";

function mapSettingsRow(row: NcmSettingsRow): NcmSettings {
  return {
    apiToken: row.api_token,
    environment: row.environment,
    defaultFromBranch: row.default_from_branch,
    defaultDeliveryType: (row.default_delivery_type as NcmDeliveryType) ?? "Door2Door",
    defaultCodCharge: row.default_cod_charge,
    webhookSecret: row.webhook_secret,
    updatedAt: row.updated_at,
  };
}

/**
 * NCM only accepts a bare 10-digit Nepali mobile number. Strip spaces, dashes,
 * and any leading country code (+977 / 977) and keep the last 10 digits.
 * Returns null if the result isn't a valid 10-digit number.
 */
function sanitizeNcmPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("977")) digits = digits.slice(3);
  if (digits.length > 10) digits = digits.slice(-10);
  return digits.length === 10 ? digits : null;
}

/** Build the NCM client config from the stored settings, or throw if unconfigured. */
async function loadNcmConfig(): Promise<NcmConfig> {
  const row = await getNcmSettings();
  if (!row?.api_token) {
    throw new Error("NCM is not configured. Add an API token in Settings.");
  }
  return { token: row.api_token, baseUrl: ncmBaseUrl(row.environment) };
}

/**
 * Settings for the admin form. The API token is masked (never returned in full)
 * so it isn't exposed to the client; `hasToken` tells the UI whether one is set.
 */
export async function getNcmSettingsForAdmin(): Promise<
  Omit<NcmSettings, "apiToken"> & { hasToken: boolean; tokenHint: string | null }
> {
  await requirePermission("settings.ncm");
  const row = await getNcmSettings();
  const settings = row
    ? mapSettingsRow(row)
    : {
        apiToken: null,
        environment: "demo" as NcmEnvironment,
        defaultFromBranch: null,
        defaultDeliveryType: "Door2Door" as NcmDeliveryType,
        defaultCodCharge: 0,
        webhookSecret: null,
        updatedAt: new Date().toISOString(),
      };

  const token = settings.apiToken;
  return {
    environment: settings.environment,
    defaultFromBranch: settings.defaultFromBranch,
    defaultDeliveryType: settings.defaultDeliveryType,
    defaultCodCharge: settings.defaultCodCharge,
    webhookSecret: settings.webhookSecret,
    updatedAt: settings.updatedAt,
    hasToken: Boolean(token),
    tokenHint: token ? `••••${token.slice(-4)}` : null,
  };
}

export async function updateNcmSettings(input: {
  apiToken?: string;
  environment?: NcmEnvironment;
  defaultFromBranch?: string | null;
  defaultDeliveryType?: NcmDeliveryType;
  defaultCodCharge?: number;
  regenerateWebhookSecret?: boolean;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("settings.ncm");
    const supabase = createAdminClient();

    const updates: Record<string, unknown> = {
      id: true,
      updated_at: new Date().toISOString(),
    };
    // Only overwrite the token when a non-empty value is provided.
    if (input.apiToken && input.apiToken.trim()) {
      updates.api_token = input.apiToken.trim();
    }
    if (input.environment) updates.environment = input.environment;
    if (input.defaultFromBranch !== undefined)
      updates.default_from_branch = input.defaultFromBranch || null;
    if (input.defaultDeliveryType)
      updates.default_delivery_type = input.defaultDeliveryType;
    if (input.defaultCodCharge !== undefined)
      updates.default_cod_charge = Math.max(0, input.defaultCodCharge);

    // Ensure a webhook secret exists; regenerate on request.
    const existing = await getNcmSettings();
    if (input.regenerateWebhookSecret || !existing?.webhook_secret) {
      updates.webhook_secret = randomBytes(24).toString("hex");
    }

    const { error } = await supabase
      .from("ncm_settings")
      .upsert(updates, { onConflict: "id" });

    return error ? { success: false, error: error.message } : { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function shipToNcm(
  orderId: string,
  opts: {
    fromBranch: string;
    toBranch: string;
    deliveryType: NcmDeliveryType;
    codCharge: number;
    weight: number;
    instruction?: string;
    packageLabel?: string;
  },
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("shipments.ship");
    const supabase = createAdminClient();

    const order = await getOrderById(orderId);
    if (!order) return { success: false, error: "Order not found." };
    if (order.ncm_order_id) {
      return { success: false, error: "This order has already been shipped." };
    }

    const phone = sanitizeNcmPhone(order.customer_phone);
    if (!phone) {
      return {
        success: false,
        error: `NCM needs a valid 10-digit phone number. The order's phone ("${order.customer_phone}") isn't valid. Fix it and try again.`,
      };
    }
    const phone2 = sanitizeNcmPhone(order.customer_phone2) ?? undefined;

    const config = await loadNcmConfig();
    const response = await createNcmOrder(config, {
      name: order.customer_name,
      phone,
      phone2,
      address: order.customer_address,
      cod_charge: opts.codCharge,
      fbranch: opts.fromBranch,
      branch: opts.toBranch,
      delivery_type: opts.deliveryType,
      weight: opts.weight,
      vref_id: String(order.order_number),
      instruction: opts.instruction,
      package: opts.packageLabel,
    });

    const { error } = await supabase
      .from("orders")
      .update({
        ncm_order_id: response.orderid,
        ncm_status: response.Message || "Pickup Order Created",
        ncm_from_branch: opts.fromBranch,
        ncm_to_branch: opts.toBranch,
        ncm_delivery_type: opts.deliveryType,
        ncm_shipped_at: new Date().toISOString(),
        ncm_synced_at: new Date().toISOString(),
        cod_charge: opts.codCharge,
        total: order.subtotal + opts.codCharge,
        status: "shipped",
        updated_at: new Date().toISOString(),
      })
      .eq("id", orderId);

    return error ? { success: false, error: error.message } : { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export interface BulkShipItem {
  orderId: string;
  toBranch: string;
  codCharge: number;
}

export interface BulkShipResult {
  success: boolean;
  error?: string;
  results?: { orderId: string; success: boolean; error?: string }[];
  shipped?: number;
  failed?: number;
}

/**
 * Ship several orders to NCM in one call. Pickup branch, delivery type, weight,
 * and instruction are shared; the destination branch and COD amount are per
 * order. Each order is dispatched through the same `shipToNcm` path as the
 * single-order flow, so its guards (already shipped, invalid phone, etc.) apply.
 * A failure on one order never aborts the rest: every outcome is reported back
 * in `results` so the caller can show a per-order summary.
 */
export async function bulkShipToNcm(
  items: BulkShipItem[],
  shared: {
    fromBranch: string;
    deliveryType: NcmDeliveryType;
    weight: number;
    instruction?: string;
  },
): Promise<BulkShipResult> {
  try {
    await requirePermission("shipments.ship");
    if (items.length === 0) {
      return { success: false, error: "No orders selected." };
    }

    const results: { orderId: string; success: boolean; error?: string }[] = [];
    for (const item of items) {
      const res = await shipToNcm(item.orderId, {
        fromBranch: shared.fromBranch,
        toBranch: item.toBranch,
        deliveryType: shared.deliveryType,
        codCharge: item.codCharge,
        weight: shared.weight,
        instruction: shared.instruction,
      });
      results.push({
        orderId: item.orderId,
        success: res.success,
        error: res.error,
      });
    }

    const shipped = results.filter((r) => r.success).length;
    return { success: true, results, shipped, failed: results.length - shipped };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function syncNcmStatus(
  orderId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("shipments.ship");
    const supabase = createAdminClient();

    const order = await getOrderById(orderId);
    if (!order) return { success: false, error: "Order not found." };
    if (!order.ncm_order_id) {
      return { success: false, error: "This order has not been shipped via NCM." };
    }

    const config = await loadNcmConfig();
    const events = await getNcmOrderStatus(config, order.ncm_order_id);
    const latest = events[events.length - 1];
    if (!latest) return { success: true }; // nothing new

    const result = await applyNcmStatus(supabase, order, latest.status);
    return result.error
      ? { success: false, error: result.error }
      : { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function addNcmComment(
  orderId: string,
  comment: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("shipments.manage");
    if (!comment.trim()) return { success: false, error: "Comment is empty." };

    const order = await getOrderById(orderId);
    if (!order?.ncm_order_id) {
      return { success: false, error: "This order has not been shipped via NCM." };
    }
    const config = await loadNcmConfig();
    await createNcmComment(config, order.ncm_order_id, comment.trim());
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function listNcmComments(orderId: string): Promise<NcmComment[]> {
  await requirePermission("shipments.ship");
  const order = await getOrderById(orderId);
  if (!order?.ncm_order_id) return [];
  try {
    const config = await loadNcmConfig();
    const entries = await getNcmOrderComments(config, order.ncm_order_id);
    return entries.map((e) => ({
      comments: e.comments,
      addedBy: e.addedBy,
      addedTime: e.added_time,
    }));
  } catch {
    return [];
  }
}

export async function returnNcmOrder(
  orderId: string,
  comment?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("shipments.manage");
    const supabase = createAdminClient();

    const order = await getOrderById(orderId);
    if (!order?.ncm_order_id) {
      return { success: false, error: "This order has not been shipped via NCM." };
    }

    const config = await loadNcmConfig();
    await markNcmReturn(config, order.ncm_order_id, comment);
    const result = await applyNcmStatus(supabase, order, "Returned");
    return result.error
      ? { success: false, error: result.error }
      : { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

function toStr(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeBranches(
  raw: NcmBranchRaw[] | Record<string, NcmBranchRaw>,
): NcmBranch[] {
  const list = Array.isArray(raw) ? raw : Object.values(raw);
  const branches: NcmBranch[] = [];
  for (const b of list) {
    const name = toStr(b.name) ?? toStr(b.branch);
    if (!name) continue;
    branches.push({
      name,
      district: toStr(b.district),
      region: toStr(b.region),
      phone: toStr(b.phone),
    });
  }
  return branches;
}

export async function refreshNcmBranches(): Promise<{
  success: boolean;
  error?: string;
  count?: number;
}> {
  try {
    await requirePermission("shipments.manage");
    const supabase = createAdminClient();
    const config = await loadNcmConfig();

    const raw = await listNcmBranches(config);
    const branches = normalizeBranches(raw);
    const rawList = Array.isArray(raw) ? raw : Object.values(raw);

    await supabase.from("ncm_branches").delete().neq("name", "");
    if (branches.length > 0) {
      const { error } = await supabase.from("ncm_branches").insert(
        branches.map((b, i) => ({
          name: b.name,
          district: b.district,
          region: b.region,
          phone: b.phone,
          raw: rawList[i] ?? null,
        })),
      );
      if (error) return { success: false, error: error.message };
    }

    return { success: true, count: branches.length };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function fetchNcmBranches(): Promise<NcmBranch[]> {
  await requirePermission("shipments.ship");
  const rows = await getCachedBranches();
  return rows.map((r) => ({
    name: r.name,
    district: r.district,
    region: r.region,
    phone: r.phone,
  }));
}
