import { cn } from "@/utils/cn";

/**
 * Which ground the mark is sitting on.
 *
 * It exists because the logo is one colour: `onDark` is the white artwork for
 * the navigation rail, `onLight` the ink one for the sign-in page, which is on
 * `--admin-bg`. Picking the wrong one renders the mark invisible rather than
 * merely ugly, which is why this is a required decision rather than a default
 * that usually works.
 */
type BrandTone = "onDark" | "onLight";

const sources: Record<BrandTone, string> = {
  onDark: "/assets/images/eg-store-logo-on-dark.png",
  onLight: "/assets/images/eg-store-logo-on-light.png",
};

interface BrandMarkProps {
  tone?: BrandTone;
  className?: string;
}

/**
 * The EG Store mark.
 *
 * Used to be an "EG" monogram drawn in markup on the dashboard's accent
 * gradient, which was a stand-in from before there was a real logo. Now it is
 * the shop's actual badge, so the dashboard, the sign-in page and the
 * storefront all wear the same mark.
 *
 * Size it from the caller, and prefer `h-* w-auto`: the badge is wider than it
 * is tall, and a square box would letterbox it.
 */
export function BrandMark({ tone = "onDark", className }: BrandMarkProps) {
  return (
    /* A local file under /public, but rendered as a plain <img> like every
       other logo on this site so the sizing stays the caller's business. */
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sources[tone]}
      alt="EG Store"
      className={cn("shrink-0 object-contain", className)}
    />
  );
}
