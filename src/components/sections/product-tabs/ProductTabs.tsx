"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Container } from "@/components/atoms/container/Container";
import { ProductCard } from "@/components/molecules/product-card/ProductCard";
import { SectionTitle } from "@/components/molecules/section-title/SectionTitle";
import type { PublicProduct } from "@/types/product.types";
import { cn } from "@/utils/cn";

export interface ProductTab {
  id: string;
  label: string;
  products: PublicProduct[];
}

interface ProductTabsProps {
  title: string;
  tabs: ProductTab[];
  viewAll?: { label: string; href: string };
  currency?: { code: string; locale: string };
  className?: string;
  id?: string;
}

/**
 * One product showcase with tabs ("Featured", "Best sellers", "New arrivals")
 * in place of three stacked rails.
 *
 * Three rails of four put twelve near-identical tiles between the categories
 * and the rest of the page; tabs keep the showcase to one screen and let the
 * shopper choose the slice. Empty tabs are dropped, so a shop with no sales
 * yet shows no "Best sellers" tab rather than an empty one, and the section
 * hides itself when every tab is empty.
 */
export function ProductTabs({
  title,
  tabs,
  viewAll,
  currency,
  className,
  id,
}: ProductTabsProps) {
  const visible = tabs.filter((tab) => tab.products.length > 0);
  const [activeId, setActiveId] = useState(visible[0]?.id);
  const baseId = useId();

  if (visible.length === 0) return null;

  const active = visible.find((tab) => tab.id === activeId) ?? visible[0];

  function handleKeyDown(event: React.KeyboardEvent, index: number) {
    const step =
      event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const next = visible[(index + step + visible.length) % visible.length];
    setActiveId(next.id);
    document.getElementById(`${baseId}-tab-${next.id}`)?.focus();
  }

  return (
    <section id={id} className={cn("py-14 lg:py-20", className)}>
      <Container>
        <SectionTitle title={title} variant="spaced" className="mb-8" />

        {visible.length > 1 && (
          <div
            role="tablist"
            aria-label={title}
            className="mb-10 flex flex-wrap items-center justify-center gap-x-10 gap-y-3"
          >
            {visible.map((tab, index) => {
              const selected = tab.id === active.id;
              return (
                <button
                  key={tab.id}
                  id={`${baseId}-tab-${tab.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveId(tab.id)}
                  onKeyDown={(event) => handleKeyDown(event, index)}
                  className={cn(
                    "relative cursor-pointer pb-2 text-sm font-medium tracking-[0.08em] uppercase transition-colors focus-visible:outline-none",
                    selected
                      ? "text-accent"
                      : "text-text-muted hover:text-text-secondary",
                  )}
                >
                  {tab.label}
                  <span
                    aria-hidden="true"
                    className={cn(
                      "bg-accent absolute inset-x-1 bottom-0 h-0.5 rounded-full transition-transform duration-300",
                      selected ? "scale-x-100" : "scale-x-0",
                    )}
                  />
                </button>
              );
            })}
          </div>
        )}

        <div
          id={`${baseId}-panel`}
          role={visible.length > 1 ? "tabpanel" : undefined}
          aria-labelledby={
            visible.length > 1 ? `${baseId}-tab-${active.id}` : undefined
          }
          // Keyed on the tab so switching replays the fade, which is what
          // tells the shopper the grid actually changed.
          key={active.id}
          className="animate-rise grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-6"
        >
          {active.products.map((product) => (
            <ProductCard key={product.id} product={product} currency={currency} />
          ))}
        </div>

        {viewAll && (
          <div className="mt-10 flex justify-end">
            <Link
              href={viewAll.href}
              className="text-text-primary hover:text-primary text-sm font-semibold underline underline-offset-4 transition-colors"
            >
              {`${viewAll.label} »`}
            </Link>
          </div>
        )}
      </Container>
    </section>
  );
}
