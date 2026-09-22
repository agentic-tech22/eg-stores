"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/cart-context";
import { cn } from "@/utils/cn";

interface CartButtonProps {
  className?: string;
}

/**
 * Header cart indicator. Until this existed there was no way to see or reach the
 * cart from anywhere on the site — you had to know the /cart URL.
 *
 * The count comes from the cart context, which hydrates from localStorage in an
 * effect, so the badge is absent on the server render and appears on hydration.
 * That is intentional: rendering a count during SSR would mismatch.
 */
export function CartButton({ className }: CartButtonProps) {
  const { count } = useCart();

  return (
    <Link
      href="/cart"
      aria-label={count > 0 ? `Cart, ${count} items` : "Cart, empty"}
      className={cn(
        "text-text-primary hover:bg-surface hover:text-primary focus-visible:ring-ring relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors focus-visible:ring-2 focus-visible:outline-none",
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
        <span className="bg-secondary absolute -top-0.5 -right-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold text-white">
          {count > 99 ? "99+" : count}
        </span>
      )}
    </Link>
  );
}
