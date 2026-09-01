import { timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { getNcmSettings } from "@/queries/ncm.query";
import { applyNcmStatus } from "@/lib/ncm/sync";
import type { OrderRow } from "@/types/order.types";

/**
 * NCM delivery-status webhook.
 *
 * NCM only supports a shared secret in the query string, so we compare it
 * (constant-time) against the app-level `ncm_settings.webhook_secret`. We always
 * return 200 for handled requests so NCM does not retry; auth failures return
 * 401. The webhook URL to register is:
 *   {APP_URL}/api/ncm/webhook?secret=<webhook_secret>
 */

function secretsMatch(provided: string | null, expected: string | null): boolean {
  if (!provided || !expected) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function GET() {
  // Liveness check (no secret required; reveals nothing).
  return Response.json({ ok: true, service: "ncm-webhook" });
}

export async function POST(request: NextRequest) {
  const provided = request.nextUrl.searchParams.get("secret");

  const settings = await getNcmSettings();
  if (!secretsMatch(provided, settings?.webhook_secret ?? null)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { order_id?: number | string; status?: string; test?: boolean };
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Acknowledge test pings without doing any work.
  if (payload.test) return Response.json({ ok: true, test: true });

  const ncmOrderId = payload.order_id;
  const status = payload.status;
  if (ncmOrderId === undefined || ncmOrderId === null || !status) {
    // Nothing actionable; ack anyway so NCM doesn't keep retrying.
    return Response.json({ ok: true, ignored: true });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("ncm_order_id", Number(ncmOrderId))
    .maybeSingle();

  const order = data as OrderRow | null;
  if (!order) {
    // Unknown order: ack so NCM stops retrying.
    return Response.json({ ok: true, unknownOrder: true });
  }

  const result = await applyNcmStatus(supabase, order, status);
  if (result.error) {
    console.error("[NCM webhook] failed to apply status:", result.error);
  }

  // Always 200 so NCM treats it as delivered.
  return Response.json({ ok: true });
}
