"use client";

import { useState } from "react";
import { Container } from "@/components/atoms/container/Container";
import type { NavbarConfig } from "@/types/layout.types";
import { cn } from "@/utils/cn";
import { getNavbarLogoClasses } from "@/utils/logo-classes";
import { useActiveLink } from "./useActiveLink";
import { useResolvedHref } from "./useResolvedHref";

interface NavbarAestheticProps {
  config: NavbarConfig;
  className?: string;
}

export function NavbarAesthetic({ config, className }: NavbarAestheticProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const activeHref = useActiveLink(config.links);
  const resolveHref = useResolvedHref();

  return (
    <header className={cn("sticky top-0 z-50 py-4", className)}>
      <Container>
        <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-full bg-background/60 px-6 py-4 shadow-[0_10px_40px_rgba(26,26,46,0.06)] backdrop-blur-xl lg:px-8" aria-label="Main navigation">
          <a href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            {config.logoUrl ? (
              <img src={config.logoUrl} alt={config.siteName} className={cn("object-contain", getNavbarLogoClasses(config.logoOrientation))} />
            ) : (
              <>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-tr from-primary via-secondary to-accent shadow-lg shadow-primary/25">
                  <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l4-4 3 3 5-6" /></svg>
                </div>
                <span className="font-heading text-2xl font-bold tracking-tight text-primary">{config.siteName}</span>
              </>
            )}
          </a>

          <div className="hidden items-center gap-5 lg:flex xl:gap-7">
            {config.links.map((link) => (
              <a key={link.href} href={resolveHref(link.href)} className={cn("text-xs font-medium uppercase tracking-[0.2em] transition-colors duration-200", activeHref === link.href ? "border-b border-secondary/30 pb-1 font-bold text-secondary" : "text-text-secondary hover:text-secondary")}>
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden lg:block">
            <a href={config.ctaHref ?? "#"} className="inline-flex items-center justify-center rounded-full bg-gradient-to-r from-secondary to-primary px-6 py-2.5 text-xs font-bold uppercase tracking-widest text-white shadow-lg shadow-secondary/15 transition-all duration-200 hover:shadow-secondary/25 active:scale-95">{config.ctaText}</a>
          </div>

          <button type="button" className="flex h-10 w-10 items-center justify-center rounded-full text-primary transition-colors hover:bg-surface lg:hidden" onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? "Close menu" : "Open menu"} aria-expanded={mobileOpen}>
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              {mobileOpen ? <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /> : <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 7.5h16.5M3.75 12h16.5m-16.5 4.5h16.5" />}
            </svg>
          </button>
        </nav>

        <div className={cn("overflow-hidden transition-all duration-300 ease-out lg:hidden", mobileOpen ? "max-h-screen pb-4 pt-3" : "max-h-0")}>
          <div className="mx-auto flex max-w-5xl flex-col gap-2 rounded-2xl bg-background/80 px-6 py-4 shadow-lg backdrop-blur-xl">
            {config.links.map((link) => (
              <a key={link.href} href={resolveHref(link.href)} className={cn("rounded-xl px-4 py-3 text-sm uppercase tracking-wider transition-colors", activeHref === link.href ? "bg-surface font-bold text-secondary" : "text-text-secondary hover:bg-surface hover:text-secondary")}>
                {link.label}
              </a>
            ))}
            <a href={config.ctaHref ?? "#"} className="mt-2 inline-flex w-full items-center justify-center rounded-full bg-gradient-to-r from-secondary to-primary px-6 py-3 text-xs font-bold uppercase tracking-widest text-white">{config.ctaText}</a>
          </div>
        </div>
      </Container>
    </header>
  );
}
