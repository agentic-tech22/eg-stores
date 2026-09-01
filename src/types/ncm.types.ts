export type NcmEnvironment = "demo" | "production";

export type NcmDeliveryType = "Door2Door" | "Branch2Door" | "D2B" | "B2B";

/** Coarse lifecycle phase derived from NCM's free-text status strings. */
export type NcmPhase =
  | "created"
  | "in_transit"
  | "delivered"
  | "returned"
  | "failed"
  | "unknown";

/** Visual tone used to render a status pill with theme tokens. */
export type NcmTone = "success" | "error" | "warning" | "info" | "pending" | "neutral";

export interface NcmSettings {
  apiToken: string | null;
  environment: NcmEnvironment;
  defaultFromBranch: string | null;
  defaultDeliveryType: NcmDeliveryType;
  defaultCodCharge: number;
  webhookSecret: string | null;
  updatedAt: string;
}

export interface NcmSettingsRow {
  id: boolean;
  api_token: string | null;
  environment: NcmEnvironment;
  default_from_branch: string | null;
  default_delivery_type: string;
  default_cod_charge: number;
  webhook_secret: string | null;
  updated_at: string;
}

export interface NcmBranch {
  name: string;
  district: string | null;
  region: string | null;
  phone: string | null;
}

export interface NcmBranchRow {
  name: string;
  district: string | null;
  region: string | null;
  phone: string | null;
  raw: unknown;
  cached_at: string;
}

export interface NcmComment {
  comments: string;
  addedBy: string;
  addedTime: string;
}
