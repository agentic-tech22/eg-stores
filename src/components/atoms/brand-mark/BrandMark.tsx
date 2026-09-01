import { cn } from "@/utils/cn";

interface BrandMarkProps {
  className?: string;
}

/**
 * The EG Stores monogram: an "EG" set on the brand gradient.
 *
 * Rendered as markup rather than the SVG in /public so it inherits the theme
 * tokens — retint `--admin-accent` / `--admin-glow` and the mark follows,
 * instead of drifting from the rest of the dashboard. The static SVGs stay for
 * the places that can't run CSS: the favicon and OpenGraph cards.
 *
 * Size it from the caller (`h-10 w-10 text-[13px]`); the gradient and weight
 * are fixed.
 */
export function BrandMark({ className }: BrandMarkProps) {
  return (
    <span
      className={cn(
        "from-admin-accent to-admin-glow shadow-admin-accent/25 inline-flex shrink-0 items-center justify-center rounded-xl bg-linear-to-br shadow-lg",
        className,
      )}
      aria-hidden="true"
    >
      <span className="font-heading leading-none font-extrabold tracking-tight text-white">
        EG
      </span>
    </span>
  );
}
