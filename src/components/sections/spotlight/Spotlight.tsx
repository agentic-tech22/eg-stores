import Link from "next/link";
import { Container } from "@/components/atoms/container/Container";
import { cn } from "@/utils/cn";

interface SpotlightProps {
  eyebrow: string;
  title: string;
  body: string;
  link: { label: string; href: string };
  /** The right-hand panel. Sits on a soft brand tint, rounded to match. */
  visual: React.ReactNode;
  className?: string;
  id?: string;
}

/**
 * An editorial split: copy on the left, a visual on the right.
 *
 * For the one programme the shop wants to explain rather than sell — it is the
 * only section on the page with a paragraph of body copy, which is what lets it
 * stand apart from the product grids around it.
 */
export function Spotlight({
  eyebrow,
  title,
  body,
  link,
  visual,
  className,
  id,
}: SpotlightProps) {
  return (
    <section id={id} className={cn("py-14 lg:py-20", className)}>
      <Container>
        <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
          <div className="flex flex-col items-start gap-5">
            <p className="text-accent text-sm font-medium tracking-[0.12em] uppercase">
              {eyebrow}
            </p>
            <h2 className="font-heading text-text-primary text-3xl leading-tight font-bold text-balance md:text-4xl lg:text-[2.6rem]">
              {title}
            </h2>
            <p className="text-text-secondary max-w-xl text-base leading-relaxed md:text-lg">
              {body}
            </p>
            <Link
              href={link.href}
              className="group text-accent hover:text-primary mt-1 inline-flex items-center gap-2 text-base font-medium transition-colors"
            >
              {link.label}
              <svg
                className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
                />
              </svg>
            </Link>
          </div>

          <div className="bg-primary-soft/70 flex items-center justify-center overflow-hidden rounded-3xl px-6 py-12 sm:px-12 lg:py-16">
            {visual}
          </div>
        </div>
      </Container>
    </section>
  );
}

/**
 * A membership card drawn in CSS, for the spotlight's visual.
 *
 * Drawn rather than photographed so it carries the shop's own name and
 * nothing it cannot back up: no points balance, no member number.
 */
export function MembershipCardVisual({ shopName }: { shopName: string }) {
  return (
    <div className="relative w-full max-w-sm">
      {/* A second card fanned out behind, so the first reads as one of many. */}
      <div
        aria-hidden="true"
        className="bg-accent/40 absolute inset-0 translate-x-4 translate-y-4 rotate-3 rounded-2xl"
      />
      <div className="from-primary to-shop-brand-deep relative flex aspect-[1.6/1] flex-col justify-between rounded-2xl bg-linear-to-br p-6 text-white shadow-[0_24px_48px_-16px_rgba(143,7,7,0.55)] sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <span className="font-heading text-lg font-extrabold tracking-tight uppercase">
            {shopName}
          </span>
          <svg
            className="h-7 w-7 text-white/90"
            fill="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path d="M11.48 3.5a.56.56 0 011.04 0l2.13 5.11c.08.2.27.33.47.35l5.52.44c.5.04.7.66.32.99l-4.2 3.6a.56.56 0 00-.18.56l1.28 5.38a.56.56 0 01-.84.61l-4.72-2.88a.56.56 0 00-.59 0l-4.72 2.88a.56.56 0 01-.84-.61l1.28-5.38a.56.56 0 00-.18-.56l-4.2-3.6a.56.56 0 01.32-.99l5.52-.44c.2-.02.39-.15.47-.35L11.48 3.5z" />
          </svg>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium tracking-[0.3em] text-white/70 uppercase">
            Membership
          </span>
          <span className="font-heading text-2xl font-bold">
            Earn on every buy
          </span>
        </div>
      </div>
    </div>
  );
}
