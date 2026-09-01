"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { signIn } from "@/services/auth.service";
import { cn } from "@/utils/cn";

const inputClasses =
  "w-full rounded-xl border-admin-border bg-admin-card border py-3 pl-11 pr-4 text-sm text-admin-text transition-all placeholder:text-admin-text-muted focus:border-admin-accent focus:ring-2 focus:ring-admin-accent/25 focus:outline-none";

interface LoginFormProps {
  redirectTo: string;
}

export function LoginForm({ redirectTo }: LoginFormProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await signIn(email.trim(), password);
      if (result.success) {
        router.push(redirectTo);
        router.refresh();
      } else {
        setError(result.error ?? "Invalid credentials.");
      }
    });
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

      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-semibold uppercase tracking-[0.1em] text-admin-text-secondary">
            Password
          </label>
          <a
            href="/forgot-password"
            className="text-[11px] font-semibold text-admin-accent transition-colors hover:text-admin-accent-hover"
          >
            Forgot password?
          </a>
        </div>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-admin-text-muted" />
          <input
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={cn(inputClasses, "pr-11")}
            placeholder="Enter your password"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-admin-text-muted transition-colors hover:text-admin-text"
            aria-label={showPassword ? "Hide password" : "Show password"}
            aria-pressed={showPassword}
            tabIndex={-1}
          >
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
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
        {isPending ? "Signing in..." : "Sign In"}
      </button>
    </form>
  );
}
