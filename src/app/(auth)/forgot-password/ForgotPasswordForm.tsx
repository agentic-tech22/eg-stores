"use client";

import { useState, useTransition } from "react";
import { ArrowLeft, CheckCircle2, Loader2, Mail } from "lucide-react";
import { requestPasswordReset } from "@/services/auth.service";
import { cn } from "@/utils/cn";

const inputClasses =
  "w-full rounded-xl border-admin-border bg-admin-card border py-3 pl-11 pr-4 text-sm text-admin-text transition-all placeholder:text-admin-text-muted focus:border-admin-accent focus:ring-2 focus:ring-admin-accent/25 focus:outline-none";

export function ForgotPasswordForm({ initialError }: { initialError: string | null }) {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(initialError);
  const [sent, setSent] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await requestPasswordReset(email.trim());
      if (result.success) {
        setSent(true);
      } else {
        setError(result.error ?? "Could not send reset link.");
      }
    });
  }

  if (sent) {
    return (
      <div className="space-y-5 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-admin-success" />
        <div>
          <p className="text-sm font-bold text-admin-text">Check your inbox</p>
          <p className="mt-1 text-sm text-admin-text-secondary">
            If an account exists for <span className="font-semibold">{email}</span>, a password
            reset link is on its way.
          </p>
        </div>
        <a
          href="/login"
          className="inline-flex items-center gap-2 text-sm font-semibold text-admin-accent transition-colors hover:text-admin-accent-hover"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to sign in
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-text-secondary">
          Email
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-text-muted" />
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClasses}
            placeholder="you@example.com"
            autoComplete="email"
            autoFocus
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-admin-danger/10 text-admin-danger border-admin-danger/25 border px-3 py-2.5 text-sm">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className={cn(
          "flex w-full items-center justify-center gap-2 rounded-xl bg-admin-accent px-6 py-3 text-sm font-bold text-white transition-all",
          "hover:bg-admin-accent-hover active:scale-[0.98] disabled:opacity-50",
        )}
      >
        {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {isPending ? "Sending..." : "Send reset link"}
      </button>

      <a
        href="/login"
        className="flex items-center justify-center gap-2 text-sm font-semibold text-admin-text-secondary transition-colors hover:text-admin-text"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </a>
    </form>
  );
}
