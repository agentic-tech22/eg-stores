"use client";

import { useState } from "react";
import { Copy, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/molecules/admin";
import { Field, Select, TextInput } from "@/components/molecules/form";
import {
  useNcmBranches,
} from "@/hooks/ncm/use-ncm-shipment";
import {
  useNcmSettings,
  useRefreshNcmBranches,
  useUpdateNcmSettings,
} from "@/hooks/ncm/use-ncm-settings";
import { notify } from "@/lib/toast";
import type { NcmDeliveryType, NcmEnvironment } from "@/types/ncm.types";

const DELIVERY_TYPES: NcmDeliveryType[] = [
  "Door2Door",
  "Branch2Door",
  "D2B",
  "B2B",
];

interface NcmSettingsFormProps {
  initialSettings: Awaited<
    ReturnType<typeof import("@/services/ncm.service").getNcmSettingsForAdmin>
  >;
  appUrl: string;
}

export function NcmSettingsForm({ initialSettings, appUrl }: NcmSettingsFormProps) {
  const { data: settings } = useNcmSettings(initialSettings);
  const updateSettings = useUpdateNcmSettings();
  const refreshBranches = useRefreshNcmBranches();
  const { data: branches = [] } = useNcmBranches(true);

  const [apiToken, setApiToken] = useState("");
  const [environment, setEnvironment] = useState<NcmEnvironment>(
    settings.environment,
  );
  const [fromBranch, setFromBranch] = useState(settings.defaultFromBranch ?? "");
  const [deliveryType, setDeliveryType] = useState<NcmDeliveryType>(
    settings.defaultDeliveryType,
  );
  const [codCharge, setCodCharge] = useState(String(settings.defaultCodCharge));

  const webhookUrl = settings.webhookSecret
    ? `${appUrl}/api/ncm/webhook?secret=${settings.webhookSecret}`
    : null;

  function handleSave() {
    updateSettings.mutate({
      apiToken: apiToken.trim() || undefined,
      environment,
      defaultFromBranch: fromBranch || null,
      defaultDeliveryType: deliveryType,
      defaultCodCharge: parseFloat(codCharge) || 0,
    });
    setApiToken("");
  }

  function copyWebhook() {
    if (!webhookUrl) return;
    void navigator.clipboard.writeText(webhookUrl);
    notify.success("Webhook URL copied.");
  }

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="NCM Integration"
        description="Connect Nepal Can Move to dispatch and track orders."
      />

      <div className="max-w-2xl space-y-6">
        <div className="rounded-2xl border border-admin-border bg-admin-surface p-5">
          <h2 className="mb-4 text-sm font-bold text-admin-text">Credentials</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field
              label="API token"
              hint={
                settings.hasToken
                  ? `A token is set (${settings.tokenHint}). Leave blank to keep it.`
                  : "Paste your NCM API token."
              }
              className="sm:col-span-2"
            >
              {(p) => (
                <TextInput
                  type="password"
                  value={apiToken}
                  onChange={(e) => setApiToken(e.target.value)}
                  placeholder={settings.hasToken ? "••••••••" : "NCM API token"}
                  autoComplete="off"
                  {...p}
                />
              )}
            </Field>
            <Field label="Environment">
              {(p) => (
                <Select
                  value={environment}
                  onChange={(e) =>
                    setEnvironment(e.target.value as NcmEnvironment)
                  }
                  {...p}
                >
                  <option value="demo">Demo (testing)</option>
                  <option value="production">Production</option>
                </Select>
              )}
            </Field>
          </div>
        </div>

        <div className="rounded-2xl border border-admin-border bg-admin-surface p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-bold text-admin-text">Shipping defaults</h2>
            <button
              type="button"
              onClick={() => refreshBranches.mutate()}
              disabled={refreshBranches.isPending}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-admin-accent transition-colors hover:bg-admin-accent/10 disabled:opacity-40"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${refreshBranches.isPending ? "animate-spin" : ""}`}
              />
              Refresh branches ({branches.length})
            </button>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Default pickup branch">
              {(p) => (
                <Select
                  value={fromBranch}
                  onChange={(e) => setFromBranch(e.target.value)}
                  {...p}
                >
                  <option value="">None</option>
                  {branches.map((b) => (
                    <option key={b.name} value={b.name}>
                      {b.name}
                      {b.district ? `, ${b.district}` : ""}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Default delivery type">
              {(p) => (
                <Select
                  value={deliveryType}
                  onChange={(e) =>
                    setDeliveryType(e.target.value as NcmDeliveryType)
                  }
                  {...p}
                >
                  {DELIVERY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label="Default COD charge">
              {(p) => (
                <TextInput
                  type="number"
                  step="0.01"
                  min="0"
                  value={codCharge}
                  onChange={(e) => setCodCharge(e.target.value)}
                  {...p}
                />
              )}
            </Field>
          </div>
        </div>

        {webhookUrl && (
          <div className="rounded-2xl border border-admin-border bg-admin-surface p-5">
            <h2 className="mb-2 text-sm font-bold text-admin-text">Webhook URL</h2>
            <p className="mb-3 text-xs text-admin-text-muted">
              Register this URL in the NCM portal to receive automatic status
              updates. Keep the secret private.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 truncate rounded-lg bg-admin-card px-3 py-2 text-xs text-admin-text">
                {webhookUrl}
              </code>
              <button
                type="button"
                onClick={copyWebhook}
                className="flex items-center gap-1.5 rounded-lg border border-admin-border px-3 py-2 text-xs font-bold text-admin-text transition-colors hover:bg-admin-card"
              >
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={updateSettings.isPending}
            className="rounded-xl bg-admin-accent px-6 py-2.5 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover disabled:opacity-40"
          >
            {updateSettings.isPending ? "Saving..." : "Save settings"}
          </button>
        </div>
      </div>
    </div>
  );
}
