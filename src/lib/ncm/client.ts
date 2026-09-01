/**
 * Thin HTTP wrapper around the Nepal Can Move (NCM) vendor API.
 *
 * The auth header is literally `Authorization: Token <token>` (not "Bearer").
 * The base URL is selected per the app-level `ncm_settings.environment` value
 * (demo vs production) and passed explicitly into each call, so this module
 * holds no environment state of its own.
 */

import type { NcmDeliveryType, NcmEnvironment } from "@/types/ncm.types";

const BASE_URLS: Record<NcmEnvironment, string> = {
  demo: "https://demo.nepalcanmove.com",
  production: "https://portal.nepalcanmove.com",
};

export function ncmBaseUrl(environment: NcmEnvironment): string {
  return BASE_URLS[environment] ?? BASE_URLS.demo;
}

export class NcmApiError extends Error {
  constructor(
    public status: number,
    public body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "NcmApiError";
  }
}

export interface NcmConfig {
  token: string;
  baseUrl: string;
}

async function request<T>(
  config: NcmConfig,
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = `${config.baseUrl}${path}`;
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Token ${config.token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, cache: "no-store" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new NcmApiError(0, null, `Network error contacting NCM: ${message}`);
  }

  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // keep as text
  }

  if (!res.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body
        ? String((body as Record<string, unknown>).detail)
        : body && typeof body === "object" && "Error" in body
          ? JSON.stringify((body as Record<string, unknown>).Error)
          : `NCM API ${res.status} ${res.statusText} at ${url}`;
    throw new NcmApiError(res.status, body, detail);
  }

  return body as T;
}

export interface NcmCreateOrderInput {
  name: string;
  phone: string;
  phone2?: string;
  cod_charge: string | number;
  address: string;
  fbranch: string;
  branch: string;
  package?: string;
  vref_id?: string;
  instruction?: string;
  delivery_type?: NcmDeliveryType;
  weight?: string | number;
}

export interface NcmCreateOrderResponse {
  Message: string;
  orderid: number;
}

export interface NcmStatusEvent {
  orderid: number;
  status: string;
  added_time: string;
}

export interface NcmCommentEntry {
  orderid: number;
  comments: string;
  addedBy: string;
  added_time: string;
}

/** Shape of a raw branch object from the NCM API (loosely typed). */
export type NcmBranchRaw = Record<string, unknown>;

export async function createNcmOrder(
  config: NcmConfig,
  input: NcmCreateOrderInput,
): Promise<NcmCreateOrderResponse> {
  return request<NcmCreateOrderResponse>(config, "/api/v1/order/create", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function getNcmOrderStatus(
  config: NcmConfig,
  orderid: number | string,
): Promise<NcmStatusEvent[]> {
  return request<NcmStatusEvent[]>(
    config,
    `/api/v1/order/status?id=${encodeURIComponent(String(orderid))}`,
  );
}

export async function getNcmOrderComments(
  config: NcmConfig,
  orderid: number | string,
): Promise<NcmCommentEntry[]> {
  return request<NcmCommentEntry[]>(
    config,
    `/api/v1/order/comment?id=${encodeURIComponent(String(orderid))}`,
  );
}

export async function createNcmComment(
  config: NcmConfig,
  orderid: number | string,
  comments: string,
): Promise<{ message: string }> {
  return request<{ message: string }>(config, "/api/v1/comment", {
    method: "POST",
    body: JSON.stringify({ orderid: String(orderid), comments }),
  });
}

export async function listNcmBranches(
  config: NcmConfig,
): Promise<NcmBranchRaw[] | Record<string, NcmBranchRaw>> {
  return request<NcmBranchRaw[] | Record<string, NcmBranchRaw>>(
    config,
    "/api/v2/branches",
  );
}

export async function markNcmReturn(
  config: NcmConfig,
  pk: number | string,
  comment?: string,
): Promise<{ message: string }> {
  return request<{ message: string }>(config, "/api/v2/vendor/order/return", {
    method: "POST",
    body: JSON.stringify(comment ? { pk, comment } : { pk }),
  });
}
