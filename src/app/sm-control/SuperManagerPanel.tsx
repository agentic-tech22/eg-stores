"use client";

import { useState } from "react";
import { LockKeyhole, LogOut } from "lucide-react";
import { PageHeader } from "@/components/molecules/admin";
import { Checkbox, Field, TextInput, Textarea } from "@/components/molecules/form";
import { notify } from "@/lib/toast";
import {
  lockSuperManager,
  updateSubscription,
} from "@/services/subscription.service";
import type { AppSubscription } from "@/types/subscription.types";

/** ISO instant → value for a `datetime-local` input, in the browser's local TZ. */
function isoToLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`;
}

/** `datetime-local` value → absolute ISO instant (resolved in the local TZ). */
function localInputToIso(local: string): string | null {
  if (!local.trim()) return null;
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function formatExpiry(iso: string | null): string {
  if (!iso) return "No expiry, active indefinitely";
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function SuperManagerPanel({ initial }: { initial: AppSubscription }) {
  const [expiresLocal, setExpiresLocal] = useState(
    isoToLocalInput(initial.expiresAt),
  );
  const [disabled, setDisabled] = useState(initial.disabled);
  const [lockedMessage, setLockedMessage] = useState(
    initial.lockedMessage ?? "",
  );
  const [saving, setSaving] = useState(false);
  // Captured once on mount so the render stays pure (no Date.now() in render).
  const [mountNow] = useState(() => Date.now());

  const expiresIso = localInputToIso(expiresLocal);
  const isExpired = Boolean(
    expiresIso && new Date(expiresIso).getTime() <= mountNow,
  );
  const isLocked = disabled || isExpired;

  async function handleSave() {
    setSaving(true);
    const result = await updateSubscription({
      expiresAt: expiresIso,
      disabled,
      lockedMessage: lockedMessage.trim() || null,
    });
    setSaving(false);
    if (result.success) {
      notify.success("Subscription updated.");
    } else {
      notify.error(result.error ?? "Could not save.");
    }
  }

  async function handleLock() {
    await lockSuperManager();
    window.location.reload();
  }

  return (
    <div className="admin-root min-h-screen bg-admin-bg px-5 py-10 font-sans lg:px-8">
      <div className="mx-auto max-w-2xl">
        <PageHeader
          eyebrow="Control"
          title="Subscription"
          description="Set when the customer's dashboard access ends. When the date passes (or the kill-switch is on), their dashboard is locked behind a renewal notice."
          actions={
            <button
              type="button"
              onClick={handleLock}
              className="flex items-center gap-2 rounded-xl border border-admin-border bg-admin-surface px-4 py-2 text-sm font-semibold text-admin-text-muted transition-colors hover:bg-admin-card"
            >
              <LogOut className="h-4 w-4" />
              Lock &amp; exit
            </button>
          }
        />

        {/* Live status banner */}
        <div
          className={
            "mb-6 flex items-center gap-3 rounded-2xl border p-4 " +
            (isLocked
              ? "border-admin-danger/30 bg-admin-danger/5"
              : "border-emerald-500/30 bg-emerald-500/5")
          }
        >
          <span
            className={
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg " +
              (isLocked
                ? "bg-admin-danger/10 text-admin-danger"
                : "bg-emerald-500/10 text-emerald-600")
            }
          >
            <LockKeyhole className="h-4.5 w-4.5" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-admin-text">
              {isLocked ? "Dashboard is LOCKED" : "Dashboard is active"}
            </p>
            <p className="text-xs text-admin-text-muted">
              {disabled
                ? "Kill-switch is on."
                : `Expiry: ${formatExpiry(expiresIso)}`}
            </p>
          </div>
        </div>

        <div className="space-y-5 rounded-2xl border border-admin-border bg-admin-surface p-6">
          <Field
            label="Access expires on"
            hint="Leave empty for no expiry. The dashboard locks automatically once this moment passes."
          >
            {(p) => (
              <div className="flex items-center gap-2">
                <TextInput
                  type="datetime-local"
                  value={expiresLocal}
                  onChange={(e) => setExpiresLocal(e.target.value)}
                  {...p}
                />
                {expiresLocal && (
                  <button
                    type="button"
                    onClick={() => setExpiresLocal("")}
                    className="shrink-0 rounded-lg border border-admin-border px-3 py-2 text-xs font-semibold text-admin-text-muted hover:bg-admin-card"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}
          </Field>

          <Checkbox
            label="Lock immediately (kill-switch)"
            description="Locks the dashboard right now, regardless of the expiry date. Turn off to restore access (subject to the date above)."
            checked={disabled}
            onChange={(e) => setDisabled(e.target.checked)}
          />

          <Field
            label="Lock screen message"
            hint="Optional. Shown to the customer when locked. Leave blank to use the default renewal notice."
          >
            {(p) => (
              <Textarea
                value={lockedMessage}
                onChange={(e) => setLockedMessage(e.target.value)}
                rows={3}
                placeholder="Your subscription has ended. Please contact support to renew."
                {...p}
              />
            )}
          </Field>

          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover disabled:opacity-40"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
