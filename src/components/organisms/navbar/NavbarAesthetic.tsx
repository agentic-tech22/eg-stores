"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Container } from "@/components/atoms/container/Container";
import { CartButton } from "@/components/molecules/cart-button/CartButton";
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

const PHONE_ICON =
  "M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z";

/**
 * Header search. A plain GET form onto /products, which already reads `?q=`,
 * so it works before hydration and needs no state of its own.
 */
function HeaderSearch({ className }: { className?: string }) {
  return (
    <form
      action="/products"
      method="get"
      role="search"
      className={cn("relative w-full", className)}
    >
      <label htmlFor="header-search" className="sr-only">
        Search products
      </label>
      <input
        id="header-search"
        type="search"
        name="q"
        placeholder="Search products..."
        className="border-border bg-surface/70 text-text-primary placeholder:text-text-muted focus:border-primary/50 focus:bg-background focus:ring-primary/15 h-11 w-full rounded-xl border pr-12 pl-4 text-sm transition-colors focus:ring-4 focus:outline-none"
      />
      <button
        type="submit"
        aria-label="Search"
        className="text-text-secondary hover:text-primary absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center transition-colors"
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
            d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z"
          />
        </svg>
      </button>
    </form>
  );
}

/**
 * The shop's header: a white bar under a deep brand-red utility strip.
 *
 * Laid out the way an electronics retailer's header reads: logo, a search box
 * given the middle of the bar because it is the first thing a shopper with a
 * model number in mind reaches for, then call and cart. The section links get
 * a row of their own below on desktop, so they never compete with search for
 * width. Keeping the bar white leaves the brand red to the strip, the footer
 * and the calls to action, which is where it should catch the eye.
 *
 * On a phone the nav row folds into the drawer and search drops to a full-width
 * row under the bar, because there search matters more than the logo does.
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
    <span className="font-heading text-primary text-2xl font-extrabold tracking-tight uppercase">
      {config.siteName}
    </span>
  );

  return (
    <header
      className={cn(
        "bg-background sticky top-0 z-50 transition-shadow duration-300",
        scrolled && "shadow-[0_6px_24px_rgba(17,24,39,0.08)]",
        className,
      )}
    >
      {/* Utility strip. Collapses to nothing on scroll rather than unmounting,
          so the header height animates instead of jumping. */}
      <div
        className={cn(
          "bg-shop-brand-deep hidden overflow-hidden transition-all duration-300 ease-out sm:block",
          scrolled ? "max-h-0 opacity-0" : "max-h-12 opacity-100",
        )}
      >
        <Container>
          <div className="flex items-center justify-between gap-4 py-2.5 text-xs font-medium text-white/90">
            <p className="truncate">
              Genuine stock · eSewa and cash on delivery · Delivered across
              Nepal
            </p>
            <div className="flex shrink-0 items-center gap-5">
              <Link
                href="/membership"
                className="hidden transition-colors hover:text-white md:inline"
              >
                Membership
              </Link>
              <a
                href={SUPPORT_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="transition-colors hover:text-white"
              >
                WhatsApp us
              </a>
            </div>
          </div>
        </Container>
      </div>

      <div className="border-border border-b">
        <Container>
          <div
            className={cn(
              "flex items-center gap-4 transition-all duration-300 lg:gap-10",
              scrolled ? "py-2.5" : "py-3.5",
            )}
          >
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2.5 transition-opacity hover:opacity-80"
            >
              {brand}
            </Link>

            <HeaderSearch className="mx-auto hidden max-w-md lg:block" />

            <div className="ml-auto flex items-center gap-1 lg:ml-0 lg:gap-2">
              <a
                href={`tel:${SUPPORT_WHATSAPP_TEL}`}
                aria-label={`Call ${SUPPORT_WHATSAPP_TEL}`}
                className="text-text-primary hover:bg-surface hover:text-primary hidden h-10 w-10 items-center justify-center rounded-full transition-colors sm:inline-flex"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.7}
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d={PHONE_ICON}
                  />
                </svg>
              </a>

              {config.showCart && <CartButton tone="light" />}

              <button
                type="button"
                className="text-text-primary hover:bg-surface hover:text-primary flex h-10 w-10 cursor-pointer items-center justify-center rounded-full transition-colors lg:hidden"
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
          </div>

          <HeaderSearch className="pb-3 lg:hidden" />
        </Container>
      </div>

      {/* Section row, desktop only. The CTA sits at the end in the brand red,
          set as a link rather than a button so the row reads as one line. */}
      <nav
        className="border-border hidden border-b lg:block"
        aria-label="Main navigation"
      >
        <Container>
          <div className="flex items-center justify-center gap-10 py-3">
            {config.links.map((link) => {
              const active = activeHref === link.href;
              return (
                <Link
                  key={link.href}
                  href={resolveHref(link.href)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "group relative py-1 text-[15px] font-medium transition-colors duration-200",
                    active
                      ? "text-primary"
                      : "text-text-primary hover:text-primary",
                  )}
                >
                  {link.label}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "bg-primary absolute inset-x-0 -bottom-0.5 h-0.5 origin-left rounded-full transition-transform duration-300 ease-out",
                      active
                        ? "scale-x-100"
                        : "scale-x-0 group-hover:scale-x-100",
                    )}
                  />
                </Link>
              );
            })}

            <Link
              href={config.ctaHref ?? "/products"}
              className="text-primary hover:text-secondary py-1 text-[15px] font-semibold transition-colors"
            >
              {config.ctaText}
            </Link>
          </div>
        </Container>
      </nav>

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
            "bg-background border-border absolute inset-y-0 right-0 flex w-[19rem] max-w-[85vw] flex-col border-l shadow-2xl transition-transform duration-300 ease-out",
            mobileOpen ? "translate-x-0" : "translate-x-full",
          )}
        >
          <div className="border-border flex items-center justify-between border-b px-5 py-4">
            <span className="text-text-muted text-[10px] font-bold tracking-[0.2em] uppercase">
              Menu
            </span>
            <button
              type="button"
              className="text-text-primary hover:bg-surface hover:text-primary flex h-9 w-9 cursor-pointer items-center justify-center rounded-full transition-colors"
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
                      ? "bg-primary-soft text-primary font-bold"
                      : "text-text-primary hover:bg-surface hover:text-primary",
                  )}
                >
                  {active && (
                    <span className="bg-primary absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full" />
                  )}
                  {link.label}
                </Link>
              );
            })}
          </div>

          <div className="border-border flex flex-col gap-3 border-t px-4 py-5">
            <Link
              href={config.ctaHref ?? "/products"}
              onClick={() => setMobileOpen(false)}
              className="bg-primary hover:bg-secondary inline-flex items-center justify-center rounded-lg px-6 py-3 text-xs font-bold tracking-wide text-white transition-colors"
            >
              {config.ctaText}
            </Link>
            <a
              href={SUPPORT_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="border-border text-text-primary hover:border-primary/50 hover:text-primary inline-flex items-center justify-center gap-2 rounded-lg border px-6 py-3 text-xs font-bold tracking-wide transition-colors"
            >
              WhatsApp {SUPPORT_WHATSAPP_TEL}
            </a>
          </div>
        </aside>
      </div>
    </header>
  );
}
