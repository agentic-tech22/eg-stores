import { redirect } from "next/navigation";
import { MessageCircle, Phone } from "lucide-react";
import { PageHeader } from "@/components/molecules/admin";
import { getAuthContext } from "@/lib/auth/session";
import {
  SUPPORT_WHATSAPP_NUMBER,
  SUPPORT_WHATSAPP_TEL,
  SUPPORT_WHATSAPP_URL,
} from "@/config/contact";

export default async function SupportPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  return (
    <>
      <PageHeader
        eyebrow="Help"
        title="Support"
        description="Need a hand? Reach our team directly on WhatsApp or give us a call."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        {/* WhatsApp */}
        <a
          href={SUPPORT_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex flex-col gap-4 rounded-2xl border border-admin-border bg-admin-card p-6 transition-colors hover:border-admin-accent/40"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-admin-accent/10 text-admin-accent">
            <MessageCircle className="h-6 w-6" strokeWidth={2.25} />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">
              WhatsApp
            </p>
            <p className="mt-1 text-lg font-bold text-admin-text">
              {SUPPORT_WHATSAPP_NUMBER}
            </p>
            <p className="mt-1 text-sm text-admin-text-muted">
              Chat with us, the fastest way to get help.
            </p>
          </div>
          <span className="mt-auto inline-flex w-fit items-center gap-2 rounded-full bg-admin-accent px-4 py-2 text-xs font-bold text-white transition-transform group-hover:scale-[1.02]">
            Open WhatsApp
          </span>
        </a>

        {/* Call */}
        <a
          href={`tel:${SUPPORT_WHATSAPP_TEL}`}
          className="group flex flex-col gap-4 rounded-2xl border border-admin-border bg-admin-card p-6 transition-colors hover:border-admin-accent/40"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-admin-accent/10 text-admin-accent">
            <Phone className="h-6 w-6" strokeWidth={2.25} />
          </span>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">
              Call us
            </p>
            <p className="mt-1 text-lg font-bold text-admin-text">
              {SUPPORT_WHATSAPP_NUMBER}
            </p>
            <p className="mt-1 text-sm text-admin-text-muted">
              Prefer to talk? Tap to call our support line.
            </p>
          </div>
          <span className="mt-auto inline-flex w-fit items-center gap-2 rounded-full border border-admin-border px-4 py-2 text-xs font-bold text-admin-text transition-transform group-hover:scale-[1.02]">
            Call now
          </span>
        </a>
      </div>
    </>
  );
}
