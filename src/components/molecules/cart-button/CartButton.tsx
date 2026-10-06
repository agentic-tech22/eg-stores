"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/cart-context";
import { cn } from "@/utils/cn";

interface CartButtonProps {
  /** `ink` for the dark header, `light` for a white surface. */
  tone?: "ink" | "light";
  className?: string;
}

/**
 * Header cart indicator. Until this existed there was no way to see or reach the
 * cart from anywhere on the site — you had to know the /cart URL.
 *
 * The count comes from the cart context, which hydrates from localStorage in an
 * effect, so the badge is absent on the server render and appears on hydration.
 * That is intentional: rendering a count during SSR would mismatch. The badge
 * pops in on arrival rather than blinking into place, which is also what makes
 * "that went in the cart" legible when it changes on a later add.
 */
export function CartButton({ tone = "light", className }: CartButtonProps) {
  const { count } = useCart();
  const ink = tone === "ink";

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Cart, ${count} items` : "Cart, empty"}
      className={cn(
        "focus-visible:ring-ring relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none",
        ink
          ? "text-shop-ink-text hover:bg-shop-ink-hover hover:text-shop-ink-text-active"
          : "text-text-primary hover:bg-surface hover:text-primary",
        className,
      )}
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
          d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 00-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 00-16.536-1.84M7.5 14.25L5.106 5.272M6 20.25a.75.75 0 11-1.5 0 .75.75 0 011.5 0zm12.75 0a.75.75 0 11-1.5 0 .75.75 0 011.5 0z"
        />
      </svg>

      {count > 0 && (
        <span
          /* Keyed on the count so a change remounts the badge and replays the
             pop, instead of silently swapping the number. */
          key={count}
          className={cn(
            "animate-pop absolute -top-0.5 -right-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white",
            ink ? "bg-shop-ink-accent" : "bg-secondary",
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
