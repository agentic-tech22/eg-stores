"use client";

import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { Container } from "@/components/atoms/container/Container";
import { CartButton } from "@/components/molecules/cart-button/CartButton";
import {
  SearchField,
  SearchFieldFallback,
} from "@/components/molecules/search-field/SearchField";
import { SUPPORT_WHATSAPP_TEL, SUPPORT_WHATSAPP_URL } from "@/config/contact";
import type { NavbarConfig } from "@/types/layout.types";
import { cn } from "@/utils/cn";
import { getNavbarLogoClasses } from "@/utils/logo-classes";
import { nextCollapsed } from "./header-collapse";
import { useActiveLink } from "./useActiveLink";
import { useResolvedHref } from "./useResolvedHref";

interface NavbarAestheticProps {
  config: NavbarConfig;
  className?: string;
}

/**
 * The shop's header, on the same near-black as the dashboard's navigation rail.
 *
 * It used to be a floating white pill with a gradient CTA: handsome, and wrong
 * for a shop. It gave a phone-accessory storefront the chrome of a SaaS landing
 * page, and it had nowhere to put the two things a shopper reaches for first,
 * search and the cart. Dark chrome also leaves the product photography as the
 * only bright surface on the screen, which is where the eye should land.
 *
 * Three rows, collapsing as the viewport narrows: a utility strip (delivery
 * promise, and how to reach a human), the bar itself, and below `lg` a search
 * row, because on a phone search matters more than the logo does.
 */
export function NavbarAesthetic({ config, className }: NavbarAestheticProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const activeHref = useActiveLink(config.links);
  const resolveHref = useResolvedHref();

  // Past the first screenful the utility strip rolls up and the bar tightens,
  // so the header costs less vertical space over a long product grid.
  useEffect(() => {
    let frame = 0;

    function apply() {
      frame = 0;
      const y = window.scrollY;
      // Two thresholds, picked by the shape the header is already in. See
      // header-collapse for why one threshold made this flicker.
      setScrolled((collapsed) => nextCollapsed(collapsed, y));
    }

    function onScroll() {
      // At most one update per frame. Scroll fires far more often than the
      // header can usefully change, and each change starts a 300ms transition.
      if (frame === 0) frame = window.requestAnimationFrame(apply);
    }

    apply();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame !== 0) window.cancelAnimationFrame(frame);
    };
  }, []);

  // A drawer that lets the page scroll behind it reads as a bug.
  useEffect(() => {
    if (!mobileOpen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const brand = config.logoUrl ? (
    /* Shop logos are arbitrary remote URLs from the business profile, rendered
       the same way as everywhere else on the storefront. */
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={config.logoUrl}
      alt={config.siteName}
      className={cn(
        "object-contain",
        getNavbarLogoClasses(config.logoOrientation),
      )}
    />
  ) : (
    <>
      <span className="from-shop-ink-accent to-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-linear-to-br shadow-lg shadow-black/40">
        <span className="font-heading text-[13px] leading-none font-extrabold tracking-tight text-white">
          EG
        </span>
      </span>
      <span className="font-heading text-shop-ink-text-active text-xl font-bold tracking-tight">
        {config.siteName}
      </span>
    </>
  );

  return (
    <header
      className={cn(
        "bg-shop-ink sticky top-0 z-50 transition-shadow duration-300",
        scrolled && "shadow-[0_8px_30px_rgba(0,0,0,0.35)]",
        className,
      )}
    >
      {/* Utility strip. Collapses to nothing on scroll rather than unmounting,
          so the header height animates instead of jumping. */}
      <div
        className={cn(
          "bg-shop-ink-deep hidden overflow-hidden transition-all duration-300 ease-out sm:block",
          scrolled ? "max-h-0 opacity-0" : "max-h-10 opacity-100",
        )}
      >
        <Container>
          <div className="text-shop-ink-muted flex items-center justify-between gap-4 py-2 text-[11px] font-medium tracking-wide">
            <p className="flex items-center gap-2">
              <span className="bg-shop-ink-accent inline-block h-1.5 w-1.5 shrink-0 rounded-full" />
              Genuine stock, eSewa and cash on delivery, delivered across Nepal
            </p>
            <div className="flex shrink-0 items-center gap-5">
              <a
                href={`tel:${SUPPORT_WHATSAPP_TEL}`}
                className="hover:text-shop-ink-text-active transition-colors"
              >
                {SUPPORT_WHATSAPP_TEL}
              </a>
              <a
                href={SUPPORT_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-shop-ink-text-active hidden transition-colors md:inline"
              >
                WhatsApp us
              </a>
            </div>
          </div>
        </Container>
      </div>

      <Container>
        <nav
          className={cn(
            "flex items-center gap-4 transition-all duration-300",
            scrolled ? "py-3" : "py-4",
          )}
          aria-label="Main navigation"
        >
          <Link
            href="/"
            className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80"
          >
            {brand}
          </Link>

          <div className="hidden items-center gap-6 lg:flex">
            {config.links.map((link) => {
              const active = activeHref === link.href;
              return (
                <Link
                  key={link.href}
                  href={resolveHref(link.href)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative py-1 text-sm font-medium transition-colors duration-200",
                    active
                      ? "text-shop-ink-text-active"
                      : "text-shop-ink-text hover:text-shop-ink-text-active",
                  )}
                >
                  {link.label}
                  {/* Grows from the left on hover, and sits already drawn for
                      the current page. */}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "bg-shop-ink-accent absolute inset-x-0 -bottom-0.5 h-0.5 origin-left rounded-full transition-transform duration-300 ease-out",
                      active
                        ? "scale-x-100"
                        : "scale-x-0 group-hover:scale-x-100",
                    )}
                  />
                </Link>
              );
            })}
          </div>

          {/* Search takes the slack between the links and the actions, so it
              grows on a wide screen instead of leaving a gap there. */}
          <div className="ml-auto hidden max-w-sm flex-1 lg:block">
            {/* The box reads the active search off the URL, which needs a
                boundary on the prerendered routes (/cart, /checkout). The
                fallback is the same box without that reading, so the header
                is never missing its search. */}
            <Suspense fallback={<SearchFieldFallback />}>
              <SearchField />
            </Suspense>
          </div>

          <div className="ml-auto flex items-center gap-1 lg:ml-0 lg:gap-2">
            {config.showCart && <CartButton tone="ink" />}

            <Link
              href={config.ctaHref ?? "/products"}
              className="bg-shop-ink-accent hover:bg-shop-ink-accent/85 hidden items-center justify-center rounded-full px-5 py-2.5 text-xs font-bold tracking-wide text-white transition-all duration-200 active:scale-95 lg:inline-flex"
            >
              {config.ctaText}
            </Link>

            <button
              type="button"
              className="text-shop-ink-text hover:bg-shop-ink-hover hover:text-shop-ink-text-active flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
              aria-expanded={mobileOpen}
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                />
              </svg>
            </button>
          </div>
        </nav>

        {/* Search gets its own row below `lg`: on a phone it is the main way
            into the catalogue and does not deserve to be behind an icon. */}
        <div className="pb-3 lg:hidden">
          <Suspense fallback={<SearchFieldFallback />}>
            <SearchField />
          </Suspense>
        </div>
      </Container>

      {/* Mobile drawer. Kept mounted and slid off-screen so it animates both
          ways; pointer events are dropped while it is closed. */}
      <div
        className={cn(
          "fixed inset-0 z-50 lg:hidden",
          mobileOpen ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden={!mobileOpen}
      >
        <div
          className={cn(
            "absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300",
            mobileOpen ? "opacity-100" : "opacity-0",
          )}
          onClick={() => setMobileOpen(false)}
        />
        <aside
          className={cn(
            "bg-shop-ink border-shop-ink-border absolute inset-y-0 right-0 flex w-[19rem] max-w-[85vw] flex-col border-l shadow-2xl transition-transform duration-300 ease-out",
            mobileOpen ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="border-shop-ink-border flex items-center justify-between border-b px-5 py-4">
            <span className="text-shop-ink-muted text-[10px] font-bold tracking-[0.2em] uppercase">
              Menu
            </span>
            <button
              type="button"
              className="text-shop-ink-text hover:bg-shop-ink-hover hover:text-shop-ink-text-active flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
            >
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-4 py-4">
            {config.links.map((link) => {
              const active = activeHref === link.href;
              return (
                <Link
                  key={link.href}
                  href={resolveHref(link.href)}
                  onClick={() => setMobileOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-colors duration-200",
                    active
                      ? "bg-shop-ink-accent/15 text-shop-ink-text-active font-bold"
                      : "text-shop-ink-text hover:bg-shop-ink-hover hover:text-shop-ink-text-active",
                  )}
                >
                  {active && (
                    <span className="bg-shop-ink-accent absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full" />
                  )}
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="border-shop-ink-border flex flex-col gap-3 border-t px-4 py-5">
            <Link
              href={config.ctaHref ?? "/products"}
              onClick={() => setMobileOpen(false)}
              className="bg-shop-ink-accent hover:bg-shop-ink-accent/85 inline-flex items-center justify-center rounded-full px-6 py-3 text-xs font-bold tracking-wide text-white transition-colors"
            >
              {config.ctaText}
            </Link>
            <a
              href={SUPPORT_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="border-shop-ink-border text-shop-ink-text hover:border-shop-ink-accent/50 hover:text-shop-ink-text-active inline-flex items-center justify-center gap-2 rounded-full border px-6 py-3 text-xs font-bold tracking-wide transition-colors"
            >
              WhatsApp {SUPPORT_WHATSAPP_TEL}
            </a>
          </div>
        </aside>
      </div>
    </header>
  );
}
