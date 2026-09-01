"use client";

/* eslint-disable @next/next/no-img-element -- the QR is a runtime-generated
   data: URL, which next/image cannot optimize. */

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Copy, Loader2, Printer } from "lucide-react";
import { Modal } from "@/components/molecules/modal/Modal";
import { generateMembershipQr } from "@/services/membership.service";
import { notify } from "@/lib/toast";

interface MembershipQrModalProps {
  open: boolean;
  onClose: () => void;
  /** Shown on the printed card so members know who they are joining. */
  shopName: string | null;
}

/**
 * Shows the QR code for the public membership signup page, so it can be
 * printed and placed at the counter. The QR is generated server-side (the
 * `qrcode` package already used for Fonepay) from NEXT_PUBLIC_SITE_URL,
 * falling back to the origin the dashboard is open on.
 */
export function MembershipQrModal({
  open,
  onClose,
  shopName,
}: MembershipQrModalProps) {
  const [copied, setCopied] = useState(false);

  const qrQuery = useQuery({
    queryKey: ["membership-qr"],
    // The query function only ever runs in the browser, so window.location is
    // safe to read here — no SSR guard or effect needed.
    queryFn: async () => {
      const r = await generateMembershipQr(window.location.origin);
      if (!r.success) throw new Error(r.error ?? "Could not generate the QR.");
      return { url: r.url!, qrDataUrl: r.qrDataUrl! };
    },
    enabled: open,
    staleTime: Infinity,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const url = qrQuery.data?.url ?? "";

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      notify.error("Could not copy the link.");
    }
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      size="md"
      title="Membership signup QR"
      description="Print this and place it at the counter. Customers scan it to register for the membership program themselves."
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-text-secondary transition-colors hover:bg-admin-card"
          >
            Close
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!qrQuery.data}
            className="flex items-center gap-2 rounded-xl bg-admin-accent px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover disabled:opacity-40"
          >
            <Printer className="h-4 w-4" strokeWidth={2.5} />
            Print
          </button>
        </>
      }
    >
      <div className="flex flex-col items-center gap-5 py-2">
        {qrQuery.isPending ? (
          <div className="flex h-70 items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-admin-text-muted" />
          </div>
        ) : qrQuery.isError ? (
          <p className="py-16 text-center text-sm text-admin-danger">
            {qrQuery.error instanceof Error
              ? qrQuery.error.message
              : "Could not generate the QR code."}
          </p>
        ) : (
          <>
            {/* The printed card: `membership-print-card` is the only element
                kept visible by the print rules in globals.css. */}
            <div className="membership-print-card paper flex flex-col items-center gap-3 rounded-2xl border border-admin-border p-6">
              <p className="text-center text-lg font-extrabold tracking-tight">
                {shopName ? `Join ${shopName}` : "Join our membership"}
              </p>
              <img
                src={qrQuery.data.qrDataUrl}
                alt="QR code linking to the membership signup form"
                width={240}
                height={240}
                className="h-60 w-60"
              />
              <p className="paper-muted max-w-60 text-center text-xs font-semibold">
                Scan to register and start collecting loyalty points on every
                purchase.
              </p>
            </div>

            <div className="flex w-full items-center gap-2 rounded-xl border border-admin-border bg-admin-card/40 px-3 py-2">
              <span className="min-w-0 flex-1 truncate text-xs text-admin-text-secondary">
                {url}
              </span>
              <button
                type="button"
                onClick={handleCopy}
                aria-label="Copy the membership link"
                className="flex shrink-0 cursor-pointer items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-bold text-admin-text-muted transition-colors hover:bg-admin-card hover:text-admin-text"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-admin-success" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
