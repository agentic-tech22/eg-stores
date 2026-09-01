"use client";

import { useState } from "react";
import { Typography } from "@/components/atoms/typography";
import { SUPPORT_WHATSAPP_URL } from "@/config/contact";
import {
  ArrowRight,
  Check,
  Compass,
  Copy,
  LogIn,
  MessageCircle,
  Store,
  WhatsApp,
} from "./_icons";

// Public demo account: read-only exploration of a sample store.
const DEMO_EMAIL = "demo@gmail.com";
const DEMO_PASSWORD = "Nepal@123";

const chatHref = `${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent(
  "Hi! I tried the demo account and I'd like to discuss my requirements.",
)}`;

const steps = [
  {
    icon: LogIn,
    title: "Open the demo login",
    body: "Head to the sign-in page. No registration required to look around.",
    action: { label: "Open login", href: "/login?redirect=/dashboard" },
  },
  {
    icon: Copy,
    title: "Sign in with the demo account",
    body: "Use the credentials below. Copy them with one tap and paste into the form.",
  },
  {
    icon: Compass,
    title: "Explore the dashboard",
    body: "Try the POS, inventory, orders, staff roles and live analytics on real sample data.",
  },
  {
    icon: Store,
    title: "Browse the storefront",
    body: "See how products published from the dashboard appear in the live storefront.",
    action: { label: "View storefront", href: "/products" },
  },
  {
    icon: MessageCircle,
    title: "Chat with us about your needs",
    body: "Like what you see? Message us on WhatsApp and we'll set up your own store.",
    action: { label: "Chat on WhatsApp", href: chatHref, external: true },
  },
];

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // clipboard unavailable: user can still select the text manually
    }
  };

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-background px-4 py-3">
      <div className="min-w-0">
        <p className="text-[11px] font-medium uppercase tracking-widest text-text-secondary">
          {label}
        </p>
        <p className="truncate font-heading text-base font-semibold text-text-primary">
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Copy ${label.toLowerCase()}`}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-primary/20 px-3 text-xs font-semibold text-primary transition-colors hover:bg-primary/[0.04]"
      >
        {copied ? (
          <>
            <Check className="h-4 w-4 text-secondary" /> Copied
          </>
        ) : (
          <>
            <Copy className="h-4 w-4" /> Copy
          </>
        )}
      </button>
    </div>
  );
}

export function DemoGuide() {
  return (
    <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.1fr]">
      {/* Credentials card */}
      <div className="lg:sticky lg:top-28">
        <div className="rounded-3xl border border-border/70 bg-surface p-8 shadow-sm">
          <span className="inline-flex items-center gap-2 rounded-full border border-secondary/30 bg-secondary/10 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-secondary">
            Live demo account
          </span>
          <Typography variant="h3" className="mt-4 text-text-primary">
            Try it yourself, no sign-up
          </Typography>
          <Typography variant="body" className="mt-2 text-text-secondary">
            Sign in with the shared demo account to explore a fully-loaded sample store.
          </Typography>

          <div className="mt-6 space-y-3">
            <CopyField label="Email" value={DEMO_EMAIL} />
            <CopyField label="Password" value={DEMO_PASSWORD} />
          </div>

          <a
            href="/login?redirect=/dashboard"
            className="mt-6 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-linear-to-r from-primary to-secondary px-6 text-sm font-semibold text-white shadow-lg shadow-primary/25 transition-all hover:shadow-primary/40"
          >
            <LogIn className="h-4 w-4" />
            Sign in to the demo
          </a>

          <p className="mt-4 text-center text-xs text-text-secondary/70">
            It's a shared sandbox. Please don't store any real data here.
          </p>
        </div>
      </div>

      {/* Stepper */}
      <ol className="relative space-y-8">
        {/* connecting line */}
        <span
          className="pointer-events-none absolute left-5 top-4 bottom-4 w-px bg-border"
          aria-hidden="true"
        />
        {steps.map((step, i) => {
          const Icon = step.icon;
          return (
            <li key={step.title} className="relative flex gap-5">
              <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/20 bg-background text-primary shadow-sm">
                <Icon className="h-5 w-5" />
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                  {i + 1}
                </span>
              </div>
              <div className="pt-1">
                <Typography variant="h4" className="text-text-primary">
                  {step.title}
                </Typography>
                <Typography variant="body" className="mt-1 text-text-secondary">
                  {step.body}
                </Typography>
                {step.action && (
                  <a
                    href={step.action.href}
                    {...(step.action.external
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-primary transition-colors hover:text-secondary"
                  >
                    {step.action.external && <WhatsApp className="h-4 w-4" />}
                    {step.action.label}
                    <ArrowRight className="h-4 w-4" />
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
