"use client";

import { useState } from "react";
import { Container } from "@/components/atoms/container/Container";
import { ScrollReveal } from "@/components/atoms/scroll-reveal/ScrollReveal";
import { Typography } from "@/components/atoms/typography";
import { SUPPORT_WHATSAPP_URL } from "@/config/contact";
import { ArrowRight, Check, Star, Store, Zap } from "./_icons";

type Billing = "monthly" | "yearly";

type Plan = {
  name: string;
  blurb: string;
  /** price per month, in NPR, for each billing cycle */
  monthly: number;
  /** effective price per month when billed yearly */
  yearlyPerMonth: number;
  /** full amount charged once per year */
  yearlyTotal: number;
  website: string;
  features: string[];
  highlight: boolean;
};

const PLANS: Plan[] = [
  {
    name: "Starter",
    blurb: "For a single shop going digital, one counter, one store.",
    monthly: 999,
    yearlyPerMonth: 833,
    yearlyTotal: 9990,
    website: "Website on demand",
    features: [
      "Online storefront + product catalog",
      "Counter POS: billing, returns, restock",
      "Real-time inventory (1 warehouse)",
      "Branded invoicing & custom numbering",
      "eSewa / Fonepay QR payments",
      "NCM courier + live delivery tracking",
      "Customer directory & history",
      "2 staff logins with permissions",
    ],
    highlight: false,
  },
  {
    name: "Business",
    blurb: "For a growing brand: store, counter, loyalty & delivery.",
    monthly: 1599,
    yearlyPerMonth: 1333,
    yearlyTotal: 15990,
    website: "Website included, free",
    features: [
      "Everything in Starter, plus:",
      "Loyalty points: earn & redeem",
      "Vendor & payables ledger",
      "Cost & profit reporting",
      "Multi-warehouse (up to 3) + transfers",
      "5 staff logins with permissions",
    ],
    highlight: true,
  },
  {
    name: "Pro",
    blurb: "For multi-location, high-volume businesses that need it all.",
    monthly: 2999,
    yearlyPerMonth: 2499,
    yearlyTotal: 29990,
    website: "Website + custom domain, free",
    features: [
      "Everything in Business, plus:",
      "Unlimited warehouses & staff",
      "Custom domain (yourbrand.com)",
      "Priority same-day support",
      "Multi-location ready",
      "Advanced onboarding & training",
    ],
    highlight: false,
  },
];

const npr = (n: number) => "Rs. " + n.toLocaleString("en-IN");

const waLink = (plan: string) =>
  `${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent(
    `Hi! I'm interested in the ${plan} plan for EG Stores. Can you help me get started?`,
  )}`;

export function PricingSection() {
  const [billing, setBilling] = useState<Billing>("yearly");
  const yearly = billing === "yearly";

  return (
    <section id="pricing" className="bg-surface py-24 lg:py-32">
      <Container>
        {/* Heading */}
        <ScrollReveal className="mx-auto mb-10 max-w-2xl text-center">
          <Typography variant="label" className="text-secondary">
            Simple, honest pricing
          </Typography>
          <Typography variant="h2" className="mt-3 text-text-primary">
            One system. One price. Everything to run your shop.
          </Typography>
          <Typography variant="bodyLarge" className="mt-4 text-text-secondary">
            Website <span className="font-semibold text-text-primary">+</span> POS{" "}
            <span className="font-semibold text-text-primary">+</span> inventory{" "}
            <span className="font-semibold text-text-primary">+</span> billing, built for
            Nepal. No per-transaction surprises. Switch or cancel anytime.
          </Typography>
        </ScrollReveal>

        {/* Billing toggle */}
        <ScrollReveal delay={80} className="mb-4 flex justify-center">
          <div className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background p-1 shadow-sm">
            <button
              type="button"
              onClick={() => setBilling("monthly")}
              className={
                "rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 " +
                (!yearly
                  ? "bg-primary text-white shadow"
                  : "text-text-secondary hover:text-text-primary")
              }
            >
              Monthly
            </button>
            <button
              type="button"
              onClick={() => setBilling("yearly")}
              className={
                "inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-all duration-200 " +
                (yearly
                  ? "bg-primary text-white shadow"
                  : "text-text-secondary hover:text-text-primary")
              }
            >
              Yearly
              <span
                className={
                  "rounded-full px-2 py-0.5 text-[11px] font-bold " +
                  (yearly ? "bg-white/20 text-white" : "bg-accent/15 text-accent")
                }
              >
                2 months free
              </span>
            </button>
          </div>
        </ScrollReveal>

        {/* Customization banner for every vendor */}
        <ScrollReveal delay={120} className="mx-auto mb-14 max-w-2xl">
          <div className="flex items-center justify-center gap-2 rounded-full border border-primary/15 bg-primary/[0.04] px-5 py-2.5 text-center text-sm text-text-secondary">
            <span>
              <span className="font-semibold text-text-primary">
                Free customization on every plan.
              </span>{" "}
              We tailor branding &amp; workflow to your shop, at no extra cost.
            </span>
          </div>
        </ScrollReveal>

        {/* Plan cards */}
        <div className="grid items-stretch gap-7 lg:grid-cols-3">
          {PLANS.map((plan, i) => (
            <ScrollReveal key={plan.name} delay={i * 90} className="h-full">
              <div
                className={
                  "group relative flex h-full flex-col rounded-3xl p-8 transition-all duration-300 " +
                  (plan.highlight
                    ? "border-2 border-primary/40 bg-background shadow-2xl shadow-primary/10 lg:-mt-4 lg:pb-12"
                    : "border border-border/70 bg-background hover:-translate-y-1 hover:border-primary/25 hover:shadow-xl hover:shadow-primary/5")
                }
              >
                {plan.highlight && (
                  <>
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -inset-px -z-10 rounded-3xl bg-linear-to-b from-primary/40 via-secondary/20 to-transparent opacity-70 blur-[1px]"
                    />
                    <span className="absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-linear-to-r from-primary to-secondary px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-primary/30">
                      <Star className="h-3.5 w-3.5 fill-current" />
                      Most popular
                    </span>
                  </>
                )}

                <Typography variant="h4" className="text-text-primary">
                  {plan.name}
                </Typography>
                <Typography
                  variant="bodySmall"
                  className="mt-1.5 min-h-10 text-text-secondary"
                >
                  {plan.blurb}
                </Typography>

                {/* Price */}
                <div className="mt-6">
                  <div className="flex items-end gap-1.5">
                    <span className="font-heading text-5xl font-bold tracking-tight text-text-primary">
                      {npr(yearly ? plan.yearlyPerMonth : plan.monthly)}
                    </span>
                    <span className="mb-2 text-sm text-text-secondary">/mo</span>
                  </div>
                  <p className="mt-2 min-h-5 text-sm text-text-secondary">
                    {yearly ? (
                      <>
                        Billed{" "}
                        <span className="font-semibold text-text-primary">
                          {npr(plan.yearlyTotal)}
                        </span>
                        /year ·{" "}
                        <span className="font-semibold text-accent">
                          save {npr(plan.monthly * 12 - plan.yearlyTotal)}
                        </span>
                      </>
                    ) : (
                      <>Billed monthly · switch to yearly to save 2 months</>
                    )}
                  </p>
                </div>

                {/* CTA */}
                <a
                  href={waLink(plan.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={
                    "mt-7 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full px-6 text-sm font-semibold transition-all duration-200 " +
                    (plan.highlight
                      ? "bg-linear-to-r from-primary to-secondary text-white shadow-lg shadow-primary/30 hover:shadow-primary/50"
                      : "border border-primary/25 text-primary hover:border-primary/40 hover:bg-primary/[0.03]")
                  }
                >
                  Get started
                  <ArrowRight className="h-4 w-4" />
                </a>

                {/* Website badge */}
                <div className="mt-6 inline-flex items-center gap-2 self-start rounded-full bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent">
                  <Store className="h-3.5 w-3.5" />
                  {plan.website}
                </div>

                {/* Features */}
                <ul className="mt-6 space-y-3">
                  {plan.features.map((f) => {
                    const isHeader = f.endsWith("plus:");
                    return (
                      <li key={f} className="flex items-start gap-3">
                        {isHeader ? (
                          <Zap className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        ) : (
                          <Check className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                        )}
                        <span
                          className={
                            isHeader
                              ? "text-sm font-semibold text-text-primary"
                              : "text-sm text-text-secondary"
                          }
                        >
                          {f}
                        </span>
                      </li>
                    );
                  })}
                  {/* Free customization, always highlighted last */}
                  <li className="flex items-start gap-3">
                    <Check className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    <span className="text-sm font-semibold text-text-primary">
                      Free customization on request
                    </span>
                  </li>
                </ul>
              </div>
            </ScrollReveal>
          ))}
        </div>

        {/* Footer note */}
        <ScrollReveal delay={120} className="mx-auto mt-12 max-w-3xl">
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border/70 bg-background px-6 py-6 text-center sm:flex-row sm:justify-center sm:gap-8 sm:text-left">
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-text-secondary">
              <span className="inline-flex items-center gap-2">
                <Check className="h-4 w-4 text-secondary" /> We set it all up for you
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="h-4 w-4 text-secondary" /> Data import &amp; staff training
              </span>
              <span className="inline-flex items-center gap-2">
                <Check className="h-4 w-4 text-secondary" /> No hidden transaction fees
              </span>
            </div>
          </div>
          <p className="mt-4 text-center text-xs text-text-muted">
            One-time setup fee of Rs. 3,000-5,000 covers data import, branding, staff training and
            go-live. Prices in NPR.
          </p>
        </ScrollReveal>
      </Container>
    </section>
  );
}
