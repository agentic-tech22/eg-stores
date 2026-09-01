"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock } from "lucide-react";
import { updatePassword } from "@/services/auth.service";
import { cn } from "@/utils/cn";

const inputClasses =
  "w-full rounded-xl border-admin-border bg-admin-card border py-3 pl-11 pr-11 text-sm text-admin-text transition-all placeholder:text-admin-text-muted focus:border-admin-accent focus:ring-2 focus:ring-admin-accent/25 focus:outline-none";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await updatePassword(password);
      if (result.success) {
        router.push("/dashboard");
        router.refresh();
      } else {
        setError(result.error ?? "Could not update password.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-text-secondary">
          New password
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-text-muted" />
          <input
            type={show ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClasses}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-admin-text-muted transition-colors hover:text-admin-text"
            aria-label={show ? "Hide password" : "Show password"}
            aria-pressed={show}
            tabIndex={-1}
          >
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-text-secondary">
          Confirm password
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-text-muted" />
          <input
            type={show ? "text" : "password"}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={inputClasses}
            placeholder="Re-enter your password"
            autoComplete="new-password"
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
        {isPending ? "Updating..." : "Update password"}
      </button>
    </form>
  );
}
