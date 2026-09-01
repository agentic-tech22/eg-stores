import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/atoms/button/Button";
import { Container } from "@/components/atoms/container/Container";
import { CountUp } from "@/components/atoms/count-up/CountUp";
import { ScrollReveal } from "@/components/atoms/scroll-reveal/ScrollReveal";
import { Typography } from "@/components/atoms/typography";
import { FooterAesthetic } from "@/components/organisms/footer";
import { NavbarAesthetic } from "@/components/organisms/navbar";
import { siteConfig } from "@/config/site";
import { SUPPORT_WHATSAPP_NUMBER, SUPPORT_WHATSAPP_URL } from "@/config/contact";
import { fetchProducts } from "@/services/product.service";
import { getActiveCurrency } from "@/lib/currency.server";
import type { FooterConfig, NavbarConfig } from "@/types/layout.types";
import type { Product } from "@/types/product.types";
import { formatCurrency } from "@/utils/format-currency";
import {
  ArrowRight,
  BarChart,
  Boxes,
  Check,
  CreditCard,
  Globe,
  MessageCircle,
  ShieldCheck,
  Star,
  Store,
  Users,
  WhatsApp,
  Zap,
} from "./_icons";
import { DemoGuide } from "./_DemoGuide";
import { PricingSection } from "./_PricingSection";
import { WatchProductModal } from "./_WatchProductModal";

const siteTitle = siteConfig.defaultSiteName;
const tagline = "Run your whole business from one place";
const siteDescription =
  "POS, inventory, staff management and a customizable online storefront, one platform that keeps every part of your business in sync.";

const navLinks = [
  { label: "Features", href: "/#features" },
  { label: "Showcase", href: "/#showcase" },
  { label: "Pricing", href: "/#pricing" },
  { label: "Products", href: "/products" },
  { label: "Try demo", href: "/#demo" },
  { label: "Chat", href: "/#chat" },
];

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  openGraph: { title: siteTitle, description: siteDescription, type: "website" },
  twitter: { card: "summary_large_image", title: siteTitle, description: siteDescription },
};

const features = [
  {
    icon: CreditCard,
    title: "Point of Sale",
    body: "Fast, intuitive checkout on any device. Split payments, discounts, refunds and printed or digital receipts, online or off.",
  },
  {
    icon: Boxes,
    title: "Inventory Management",
    body: "Real-time stock across every location with low-stock alerts and automatic reordering, so you never sell what you can't fulfill.",
  },
  {
    icon: Users,
    title: "Staff & Roles",
    body: "Role-based access for owners, managers, cashiers and staff. Track shifts, set permissions and keep sensitive data locked down.",
  },
  {
    icon: Store,
    title: "Online Storefront",
    body: "A beautiful, customizable storefront that's live in minutes. Match your brand with themes, fonts and colors. No code required.",
  },
  {
    icon: Globe,
    title: "Marketplace Sync",
    body: "Add a product once in the dashboard and publish it everywhere. Your storefront and marketplace update instantly, in sync.",
  },
  {
    icon: BarChart,
    title: "Analytics & Reports",
    body: "Live dashboards for revenue, best-sellers and staff performance. Make confident decisions backed by real numbers.",
  },
];

const stats = [
  { to: 12000, suffix: "+", label: "Businesses powered" },
  { to: 2.4, prefix: "$", suffix: "B", decimals: 1, label: "Processed yearly" },
  { to: 99.9, suffix: "%", decimals: 1, label: "Uptime SLA" },
  { to: 4.9, suffix: "/5", decimals: 1, label: "Average rating" },
];

const steps = [
  {
    icon: Boxes,
    title: "Add it once",
    body: "Create a product in your dashboard with price, photos, stock and variants.",
  },
  {
    icon: Zap,
    title: "Toggle where it sells",
    body: "Flip it live on your storefront and marketplace with a single switch.",
  },
  {
    icon: Store,
    title: "Sell everywhere",
    body: "POS, storefront and marketplace all read from one source of truth.",
  },
];

const testimonials = [
  {
    quote:
      "We replaced four different tools with EG Stores. Our cafe's checkout, stock and online orders finally live in one place.",
    name: "Maya Fernandes",
    role: "Owner, Bloom Coffee",
    img: "https://i.pravatar.cc/96?img=47",
  },
  {
    quote:
      "Role-based access was the deal-maker. My managers see what they need, cashiers don't, and I sleep at night.",
    name: "Daniel Osei",
    role: "Founder, North Street Retail",
    img: "https://i.pravatar.cc/96?img=12",
  },
  {
    quote:
      "I add a product in the morning and it's selling on our storefront before lunch. The sync just works.",
    name: "Priya Nair",
    role: "Director, Saffron Living",
    img: "https://i.pravatar.cc/96?img=32",
  },
];

export default async function HomePage() {
  // EG Stores runs as a POS first: "/" is the dashboard's front door, not a
  // marketing page. Unauthenticated visitors bounce on from /dashboard to
  // /login (see the (admin) layout's auth gate).
  //
  // The landing page below is left fully intact and still builds — drop this
  // one line to put the public site back on "/", or point a route at it.
  // `redirect` throws, so nothing after it runs.
  redirect("/dashboard");

  let products: Product[] = [];
  try {
    products = await fetchProducts();
  } catch {
    // graceful fallback: section renders a styled placeholder
  }
  const featured = products.slice(0, 3);
  const currency = await getActiveCurrency();

  const navbarConfig: NavbarConfig = {
    siteName: siteTitle,
    links: navLinks,
    ctaText: "View demo",
    ctaHref: "/login?redirect=/dashboard",
  };

  const footerConfig: FooterConfig = {
    siteName: siteTitle,
    description: siteDescription,
    links: [
      {
        group: "Navigate",
        items: [{ label: "Home", href: "/" }, ...navLinks],
      },
      {
        group: "Support",
        items: [{ label: "WhatsApp Support", href: SUPPORT_WHATSAPP_URL }],
      },
    ],
  };

  return (
    <>
      <NavbarAesthetic config={navbarConfig} />

      <main className="flex-1">
        {/* ============================ HERO ============================ */}
        <section
          className="relative -mt-24 overflow-hidden pt-24 text-white"
          style={{
            background:
              "radial-gradient(120% 110% at 50% 0%, #1b1740 0%, #0c0a1e 58%, #07060f 100%)",
          }}
        >
          {/* aurora */}
          <div className="pointer-events-none absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full bg-primary/40 blur-[120px] animate-aurora" />
          <div className="pointer-events-none absolute -top-20 right-0 h-[26rem] w-[26rem] rounded-full bg-secondary/30 blur-[120px] animate-aurora" style={{ animationDelay: "-6s" }} />
          <div className="pointer-events-none absolute top-1/2 left-1/2 h-[24rem] w-[24rem] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px] animate-aurora" style={{ animationDelay: "-12s" }} />
          {/* grid mask */}
          <div
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
              backgroundSize: "56px 56px",
              maskImage: "radial-gradient(110% 80% at 50% 25%, #000 35%, transparent 78%)",
              WebkitMaskImage: "radial-gradient(110% 80% at 50% 25%, #000 35%, transparent 78%)",
            }}
          />

          <Container className="relative z-10 pt-16 pb-12 lg:pt-24">
            <div className="mx-auto flex max-w-3xl flex-col items-center gap-7 text-center">
              <ScrollReveal className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 py-1.5 backdrop-blur-sm">
                <span className="text-xs font-medium uppercase tracking-[0.18em] text-white/75">
                  All-in-one business platform
                </span>
              </ScrollReveal>

              <ScrollReveal delay={80}>
                <Typography variant="display" className="text-white">
                  Run your whole business{" "}
                  <span className="bg-linear-to-r from-[#22d3ee] via-[#a78bfa] to-[#818cf8] bg-clip-text text-transparent">
                    from one place
                  </span>
                </Typography>
              </ScrollReveal>

              <ScrollReveal delay={160}>
                <Typography variant="bodyLarge" className="mx-auto max-w-2xl text-white/70">
                  {siteDescription}
                </Typography>
              </ScrollReveal>

              <ScrollReveal delay={240} className="flex flex-col items-center gap-4 sm:flex-row">
                <Button
                  href="#demo"
                  size="lg"
                  className="rounded-full bg-linear-to-r from-primary to-secondary px-8 shadow-lg shadow-primary/30 hover:shadow-primary/50"
                >
                  View demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <WatchProductModal />
              </ScrollReveal>

              <ScrollReveal delay={320} className="flex items-center gap-2 text-xs text-white/55">
                <ShieldCheck className="h-4 w-4 text-accent" />
                No credit card required · Free 14-day trial · Cancel anytime
              </ScrollReveal>
            </div>

            {/* Product showcase video in a browser frame */}
            <ScrollReveal delay={120} className="relative mx-auto mt-14 max-w-5xl" id="showcase">
              <div className="pointer-events-none absolute -inset-x-10 -bottom-10 top-10 rounded-[2rem] bg-linear-to-r from-primary/30 via-secondary/20 to-accent/30 blur-3xl" />
              <div className="relative overflow-hidden rounded-2xl border border-white/12 bg-[#0c0a1e]/80 shadow-2xl ring-1 ring-white/5 backdrop-blur">
                <div className="flex items-center gap-2 border-b border-white/10 px-4 py-3">
                  <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                  <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                  <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                  <span className="mx-auto flex items-center gap-2 rounded-md bg-white/5 px-3 py-1 text-[11px] text-white/50">
                    <Globe className="h-3 w-3" /> app.digitalmanager.io/dashboard
                  </span>
                </div>
                <video
                  className="block aspect-video w-full"
                  autoPlay
                  muted
                  loop
                  playsInline
                  poster="/assets/video/hero-poster.jpg"
                  aria-label="Animated preview of the EG Stores dashboard showing revenue, orders, inventory and staff on shift"
                >
                  <source src="/assets/video/hero.webm" type="video/webm" />
                  <source src="/assets/video/hero.mp4" type="video/mp4" />
                </video>
              </div>
            </ScrollReveal>
          </Container>
        </section>

        {/* ========================== FEATURES ========================== */}
        <section id="features" className="py-24 lg:py-32">
          <Container>
            <ScrollReveal className="mx-auto mb-16 max-w-2xl text-center">
              <Typography variant="label" className="text-secondary">
                Everything you need
              </Typography>
              <Typography variant="h2" className="mt-3 text-text-primary">
                One platform. Every part of your business.
              </Typography>
              <Typography variant="bodyLarge" className="mt-4 text-text-secondary">
                Stop stitching together half a dozen apps. EG Stores brings selling,
                stock, staff and storefront under one roof.
              </Typography>
            </ScrollReveal>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature, i) => {
                const Icon = feature.icon;
                return (
                  <ScrollReveal key={feature.title} delay={i * 70}>
                    <div className="group h-full rounded-2xl border border-border/70 bg-background p-7 transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5">
                      <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-primary to-secondary text-white shadow-lg shadow-primary/20 transition-transform duration-300 group-hover:scale-110">
                        <Icon className="h-6 w-6" />
                      </div>
                      <Typography variant="h4" className="mb-2 text-text-primary">
                        {feature.title}
                      </Typography>
                      <Typography variant="body" className="text-text-secondary">
                        {feature.body}
                      </Typography>
                    </div>
                  </ScrollReveal>
                );
              })}
            </div>
          </Container>
        </section>

        {/* =========================== STATS ============================ */}
        <section className="relative overflow-hidden py-20 text-white" style={{ background: "radial-gradient(120% 140% at 50% 0%, #312e81 0%, #1b1740 55%, #0c0a1e 100%)" }}>
          <div className="pointer-events-none absolute -bottom-24 left-1/3 h-72 w-72 rounded-full bg-accent/20 blur-[120px] animate-aurora" />
          <Container>
            <div className="grid grid-cols-2 gap-10 lg:grid-cols-4">
              {stats.map((stat, i) => (
                <ScrollReveal key={stat.label} delay={i * 80} className="text-center">
                  <div className="font-heading text-4xl font-bold tracking-tight lg:text-5xl">
                    <CountUp
                      to={stat.to}
                      prefix={stat.prefix}
                      suffix={stat.suffix}
                      decimals={stat.decimals ?? 0}
                    />
                  </div>
                  <p className="mt-2 text-sm text-white/60">{stat.label}</p>
                </ScrollReveal>
              ))}
            </div>
          </Container>
        </section>

        {/* ===================== MARKETPLACE / SYNC ===================== */}
        <section className="py-24 lg:py-32">
          <Container>
            <div className="grid items-center gap-14 lg:grid-cols-2">
              <ScrollReveal>
                <Typography variant="label" className="text-secondary">
                  Sell everywhere
                </Typography>
                <Typography variant="h2" className="mt-3 text-text-primary">
                  Add a product once. Sell it everywhere.
                </Typography>
                <Typography variant="bodyLarge" className="mt-4 text-text-secondary">
                  Create a product in your dashboard and decide where it shows up. Your
                  storefront and marketplace stay perfectly in sync with your stock. No
                  double entry, no mismatched prices, no overselling.
                </Typography>

                <div className="mt-8 space-y-5">
                  {steps.map((step, i) => {
                    const Icon = step.icon;
                    return (
                      <ScrollReveal key={step.title} delay={i * 90} className="flex gap-4">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <Typography variant="h4" className="text-text-primary">
                            {step.title}
                          </Typography>
                          <Typography variant="body" className="text-text-secondary">
                            {step.body}
                          </Typography>
                        </div>
                      </ScrollReveal>
                    );
                  })}
                </div>

                <Button href="/products" size="lg" variant="primary" className="mt-9 rounded-full">
                  Browse the storefront
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </ScrollReveal>

              <ScrollReveal delay={120} className="relative">
                <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-linear-to-tr from-primary/15 via-secondary/10 to-accent/15 blur-2xl" />
                <div className="relative overflow-hidden rounded-3xl border border-border/70 shadow-2xl shadow-primary/10">
                  <img
                    src="https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1200&q=80"
                    alt="Retail store interior with shelves of products"
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-linear-to-t from-[#0c0a1e]/80 via-transparent to-transparent" />
                  <div className="absolute bottom-5 left-5 right-5 flex items-center justify-between rounded-2xl border border-white/15 bg-[#0c0a1e]/70 px-5 py-4 backdrop-blur-md">
                    <div>
                      <p className="text-xs uppercase tracking-widest text-white/55">In sync</p>
                      <p className="text-sm font-semibold text-white">Storefront · Marketplace · POS</p>
                    </div>
                    <span className="flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1 text-xs font-semibold text-accent">
                      <span className="h-2 w-2 rounded-full bg-accent animate-float" /> Live
                    </span>
                  </div>
                </div>
              </ScrollReveal>
            </div>
          </Container>
        </section>

        {/* ===================== FEATURED PRODUCTS ====================== */}
        <section className="bg-surface py-24 lg:py-32">
          <Container>
            <ScrollReveal className="mb-14 flex flex-col items-end justify-between gap-6 sm:flex-row">
              <div className="max-w-xl">
                <Typography variant="label" className="text-secondary">
                  Live from the storefront
                </Typography>
                <Typography variant="h2" className="mt-3 text-text-primary">
                  Fresh in the marketplace
                </Typography>
              </div>
              <a
                href="/products"
                className="inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors hover:text-secondary"
              >
                View all products <ArrowRight className="h-4 w-4" />
              </a>
            </ScrollReveal>

            {featured.length > 0 ? (
              <div className="grid grid-cols-1 gap-7 sm:grid-cols-2 lg:grid-cols-3">
                {featured.map((product, i) => (
                  <ScrollReveal key={product.id} delay={i * 80}>
                    <a
                      href={`/products/${product.id}`}
                      className="group block h-full overflow-hidden rounded-2xl border border-border/70 bg-background transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/5"
                    >
                      <div className="aspect-[4/3] overflow-hidden bg-surface">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.title}
                            className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                            loading="lazy"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-text-muted">
                            <Store className="h-12 w-12" />
                          </div>
                        )}
                      </div>
                      <div className="p-5">
                        <Typography variant="h4" as="h3" className="text-text-primary">
                          {product.title}
                        </Typography>
                        {product.description && (
                          <Typography variant="bodySmall" className="mt-1 line-clamp-2 text-text-secondary">
                            {product.description}
                          </Typography>
                        )}
                        <p className="mt-4 font-heading text-lg font-bold text-primary">
                          {formatCurrency(product.price, currency.code, currency.locale)}
                        </p>
                      </div>
                    </a>
                  </ScrollReveal>
                ))}
              </div>
            ) : (
              <ScrollReveal className="rounded-2xl border border-dashed border-border bg-background py-20 text-center">
                <Store className="mx-auto mb-4 h-12 w-12 text-text-muted" />
                <Typography variant="body" className="text-text-secondary">
                  No products published yet. Add one in the dashboard and it shows up here instantly.
                </Typography>
                <Button href="/dashboard/products" variant="outline" className="mt-6 rounded-full">
                  Go to dashboard
                </Button>
              </ScrollReveal>
            )}
          </Container>
        </section>

        {/* ========================= TESTIMONIALS ======================= */}
        <section className="py-24 lg:py-32">
          <Container>
            <ScrollReveal className="mx-auto mb-16 max-w-2xl text-center">
              <Typography variant="label" className="text-secondary">
                Loved by operators
              </Typography>
              <Typography variant="h2" className="mt-3 text-text-primary">
                Built for the people who run the floor
              </Typography>
            </ScrollReveal>

            <div className="grid gap-6 lg:grid-cols-3">
              {testimonials.map((t, i) => (
                <ScrollReveal key={t.name} delay={i * 90}>
                  <figure className="flex h-full flex-col rounded-2xl border border-border/70 bg-background p-7 shadow-sm">
                    <div className="mb-4 flex gap-1 text-secondary">
                      {Array.from({ length: 5 }).map((_, s) => (
                        <Star key={s} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                    <blockquote className="flex-1">
                      <Typography variant="body" className="text-text-primary">
                        “{t.quote}”
                      </Typography>
                    </blockquote>
                    <figcaption className="mt-6 flex items-center gap-3">
                      <img
                        src={t.img}
                        alt={t.name}
                        className="h-11 w-11 rounded-full object-cover"
                        loading="lazy"
                      />
                      <div>
                        <p className="text-sm font-semibold text-text-primary">{t.name}</p>
                        <p className="text-xs text-text-secondary">{t.role}</p>
                      </div>
                    </figcaption>
                  </figure>
                </ScrollReveal>
              ))}
            </div>
          </Container>
        </section>

        {/* =========================== PRICING ========================== */}
        <PricingSection />

        {/* ========================== TRY DEMO ========================== */}
        <section id="demo" className="bg-surface py-24 lg:py-32">
          <Container>
            <ScrollReveal className="mx-auto mb-16 max-w-2xl text-center">
              <Typography variant="label" className="text-secondary">
                Try before you buy
              </Typography>
              <Typography variant="h2" className="mt-3 text-text-primary">
                Explore {siteTitle} in 5 quick steps
              </Typography>
              <Typography variant="bodyLarge" className="mt-4 text-text-secondary">
                No forms, no waiting. Sign in with our shared demo account and click through
                every feature on real sample data, then chat with us when you're ready.
              </Typography>
            </ScrollReveal>

            <ScrollReveal delay={120}>
              <DemoGuide />
            </ScrollReveal>
          </Container>
        </section>

        {/* ========================== CHAT NOW ========================== */}
        <section id="chat" className="py-24 lg:py-32">
          <Container>
            <ScrollReveal className="relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] border border-[#25D366]/20 bg-surface px-8 py-16 lg:px-16 lg:py-20">
              {/* WhatsApp green glow */}
              <div className="pointer-events-none absolute -top-24 -right-16 h-72 w-72 rounded-full bg-[#25D366]/20 blur-[110px] animate-aurora" />
              <div className="pointer-events-none absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-[#128C7E]/15 blur-[110px] animate-aurora" style={{ animationDelay: "-7s" }} />

              <div className="relative grid items-center gap-12 lg:grid-cols-[1.2fr_1fr]">
                <div>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 bg-[#25D366]/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-[#128C7E]">
                    <MessageCircle className="h-4 w-4" />
                    We reply in minutes
                  </span>
                  <Typography variant="h2" className="mt-5 text-text-primary">
                    Want to explore or register? Chat with us on WhatsApp.
                  </Typography>
                  <Typography variant="bodyLarge" className="mt-4 text-text-secondary">
                    Curious about {siteTitle}, ready to set up your store, or have a question
                    before you start? Skip the forms. Message us directly on WhatsApp and a
                    real person will walk you through it.
                  </Typography>

                  <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
                    <a
                      href={`${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent(
                        `Hi ${siteTitle} team! I'd like to explore your product and get started.`,
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-14 shrink-0 items-center justify-center gap-3 whitespace-nowrap rounded-full bg-[#25D366] px-8 text-base font-semibold text-white shadow-lg shadow-[#25D366]/30 transition-all duration-200 hover:bg-[#1ebe5d] hover:shadow-[#25D366]/50"
                    >
                      <WhatsApp className="h-6 w-6" />
                      Chat now on WhatsApp
                    </a>
                    <span className="text-sm text-text-secondary">
                      or call us at{" "}
                      <span className="font-semibold text-text-primary">
                        {SUPPORT_WHATSAPP_NUMBER}
                      </span>
                    </span>
                  </div>

                  <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-text-secondary">
                    <span className="inline-flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#25D366]" /> No sign-up needed to talk
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#25D366]" /> Free product walkthrough
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Check className="h-4 w-4 text-[#25D366]" /> Help getting registered
                    </span>
                  </div>
                </div>

                <div className="relative mx-auto flex h-40 w-40 items-center justify-center lg:h-56 lg:w-56">
                  <div className="absolute inset-0 rounded-full bg-[#25D366]/10" />
                  <div className="absolute inset-6 rounded-full bg-[#25D366]/15" />
                  <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-[#25D366] text-white shadow-2xl shadow-[#25D366]/40 lg:h-32 lg:w-32">
                    <WhatsApp className="h-12 w-12 lg:h-16 lg:w-16" />
                  </div>
                </div>
              </div>
            </ScrollReveal>
          </Container>
        </section>

        {/* =========================== FINAL CTA ======================== */}
        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <ScrollReveal className="relative mx-auto max-w-6xl overflow-hidden rounded-[2.5rem] px-8 py-20 text-center text-white lg:py-28" >
            <div
              className="absolute inset-0 -z-10"
              style={{ background: "radial-gradient(120% 130% at 50% 0%, #4f46e5 0%, #312e81 50%, #0c0a1e 100%)" }}
            />
            <div className="pointer-events-none absolute -top-16 left-1/4 h-64 w-64 rounded-full bg-accent/30 blur-[100px] animate-aurora" />
            <div className="pointer-events-none absolute -bottom-16 right-1/4 h-64 w-64 rounded-full bg-secondary/40 blur-[100px] animate-aurora" style={{ animationDelay: "-8s" }} />
            <Typography variant="h1" as="h2" className="relative mx-auto max-w-3xl text-white">
              Ready to run your business from one place?
            </Typography>
            <Typography variant="bodyLarge" className="relative mx-auto mt-5 max-w-xl text-white/75">
              Join thousands of shops, cafés and retailers already growing with {siteTitle}.
            </Typography>
            <div className="relative mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Button
                href="#demo"
                size="lg"
                className="rounded-full bg-white px-8 text-primary hover:bg-white/90"
              >
                View demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Link
                href="/products"
                className="inline-flex h-12 items-center justify-center rounded-full border border-white/25 px-7 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                Explore the storefront
              </Link>
            </div>
          </ScrollReveal>
        </section>
      </main>

      <FooterAesthetic config={footerConfig} />
    </>
  );
}
