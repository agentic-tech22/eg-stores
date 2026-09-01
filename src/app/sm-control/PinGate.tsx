"use client";

import { useRef, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { notify } from "@/lib/toast";
import { unlockSuperManager } from "@/services/subscription.service";

/**
 * 4-digit PIN entry for the hidden control panel. On success the server sets the
 * session cookie and we reload so the page re-renders the panel. Intentionally
 * generic UI with no hint of what lies behind it.
 */
export function PinGate({ configured }: { configured: boolean }) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [submitting, setSubmitting] = useState(false);
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  function setDigit(index: number, value: string) {
    const clean = value.replace(/\D/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = clean;
      return next;
    });
    if (clean && index < 3) inputs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 4);
    if (!pasted) return;
    e.preventDefault();
    const next = ["", "", "", ""];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i];
    setDigits(next);
    inputs.current[Math.min(pasted.length, 3)]?.focus();
  }

  async function submit() {
    const pin = digits.join("");
    if (pin.length !== 4) {
      notify.error("Enter the 4-digit PIN.");
      return;
    }
    setSubmitting(true);
    const result = await unlockSuperManager(pin);
    if (result.success) {
      window.location.reload();
      return;
    }
    setSubmitting(false);
    setDigits(["", "", "", ""]);
    inputs.current[0]?.focus();
    notify.error(result.error ?? "Incorrect PIN.");
  }

  return (
    <div className="admin-root flex min-h-screen items-center justify-center bg-admin-bg px-6 font-sans">
      <div className="w-full max-w-sm rounded-2xl border border-admin-border bg-admin-surface p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-admin-accent/10 text-admin-accent">
            <ShieldCheck className="h-6 w-6" strokeWidth={2.25} />
          </span>
          <h1 className="text-lg font-bold text-admin-text">Enter PIN</h1>
          <p className="mt-1 text-sm text-admin-text-muted">
            {configured
              ? "This area is protected."
              : "Access has not been configured."}
          </p>
        </div>

        {configured && (
          <>
            <div className="flex justify-center gap-3" onPaste={handlePaste}>
              {digits.map((digit, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputs.current[i] = el;
                  }}
                  value={digit}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(i, e)}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                  inputMode="numeric"
                  autoComplete="off"
                  autoFocus={i === 0}
                  aria-label={`PIN digit ${i + 1}`}
                  className="h-14 w-12 rounded-xl border border-admin-border bg-admin-card text-center text-2xl font-bold text-admin-text outline-none focus:border-admin-accent focus:ring-2 focus:ring-admin-accent/30"
                  type="password"
                />
              ))}
            </div>

            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="mt-6 w-full rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover disabled:opacity-40"
            >
              {submitting ? "Verifying…" : "Continue"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
