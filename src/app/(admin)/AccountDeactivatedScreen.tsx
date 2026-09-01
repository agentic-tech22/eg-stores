import { Ban, MessageCircle, Phone } from "lucide-react";
import {
  SUPPORT_WHATSAPP_TEL,
  SUPPORT_WHATSAPP_URL,
} from "@/config/contact";

/**
 * Full-screen, non-dismissible lock rendered by the admin layout in place of the
 * dashboard when the signed-in user's account has been deactivated by an admin.
 * A user deactivated mid-session keeps a valid cookie until it expires, so this
 * guarantees they never see dashboard content (server actions are separately
 * blocked by `requireAuth`). Mirrors SubscriptionLockScreen.
 */
export function AccountDeactivatedScreen() {
  return (
    <div className="admin-root relative flex min-h-screen items-center justify-center overflow-hidden bg-admin-bg px-6 font-sans">
      {/* Decorative blurred backdrop (not the real dashboard). */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 blur-2xl"
      >
        <div className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-admin-accent/20" />
        <div className="absolute right-0 top-1/3 h-80 w-80 rounded-full bg-admin-glow/15" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-admin-accent/10" />
      </div>

      <div className="relative w-full max-w-md rounded-3xl border border-admin-border bg-admin-surface/95 p-8 text-center shadow-2xl backdrop-blur-sm">
        <span className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-admin-danger/10 text-admin-danger">
          <Ban className="h-7 w-7" strokeWidth={2.25} />
        </span>

        <p className="mb-1 text-[11px] font-bold uppercase tracking-[0.18em] text-admin-danger">
          Account deactivated
        </p>
        <h1 className="text-2xl font-extrabold tracking-tight text-admin-text">
          Access turned off
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-admin-text-muted">
          Your account has been deactivated by an admin. Please reach out to your
          admin to have your access restored.
        </p>

        <div className="mt-7 space-y-3">
          <a
            href={SUPPORT_WHATSAPP_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-admin-accent px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover"
          >
            <MessageCircle className="h-4.5 w-4.5" />
            Chat with support
          </a>
          <a
            href={`tel:${SUPPORT_WHATSAPP_TEL}`}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-admin-border bg-admin-card px-5 py-3 text-sm font-semibold text-admin-text transition-colors hover:bg-admin-bg"
          >
            <Phone className="h-4.5 w-4.5" />
            Call {SUPPORT_WHATSAPP_TEL}
          </a>
        </div>
      </div>
    </div>
  );
}
