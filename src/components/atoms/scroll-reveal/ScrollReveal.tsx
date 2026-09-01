"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";

type ScrollRevealProps = {
  children: React.ReactNode;
  /** Delay in ms before the reveal transition starts (for staggering). */
  delay?: number;
  className?: string;
  id?: string;
  /** Re-trigger every time it enters the viewport instead of only once. */
  repeat?: boolean;
};

/**
 * Lightweight scroll-reveal wrapper. Toggles `data-reveal="visible"` when the
 * element scrolls into view; the actual transition lives in globals.css and is
 * disabled automatically under `prefers-reduced-motion`.
 */
export function ScrollReveal({
  children,
  delay = 0,
  className,
  id,
  repeat = false,
}: ScrollRevealProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          if (!repeat) observer.unobserve(entry.target);
        } else if (repeat) {
          setVisible(false);
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [repeat]);

  return (
    <div
      ref={ref}
      id={id}
      data-reveal={visible ? "visible" : ""}
      style={{ "--reveal-delay": `${delay}ms` } as React.CSSProperties}
      className={cn(className)}
    >
      {children}
    </div>
  );
}
