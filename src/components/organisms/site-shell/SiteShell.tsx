import { FooterAesthetic } from "@/components/organisms/footer";
import { NavbarAesthetic } from "@/components/organisms/navbar";
import { siteFooterConfig, siteNavbarConfig } from "@/config/navigation";
import type { FooterConfig, NavbarConfig } from "@/types/layout.types";
import { cn } from "@/utils/cn";

interface SiteShellProps {
  children: React.ReactNode;
  /** Override the shared header, e.g. to hide the cart on a payment callback. */
  navbar?: NavbarConfig;
  /** Override the shared footer. Rarely needed. */
  footer?: FooterConfig;
  className?: string;
}

/**
 * Header + main + footer for every public page.
 *
 * Each storefront page used to declare its own navLinks/NavbarConfig/FooterConfig
 * inline, which drifted: "/" advertised Features/Showcase/Pricing while
 * "/products" advertised Home/Products, and no page offered a cart link at all.
 * Defaulting to config/navigation keeps one answer to "what is in the header".
 */
export function SiteShell({
  children,
  navbar = siteNavbarConfig,
  footer = siteFooterConfig,
  className,
}: SiteShellProps) {
  return (
    <>
      <NavbarAesthetic config={navbar} />
      <main className={cn("flex-1", className)}>{children}</main>
      <FooterAesthetic config={footer} />
    </>
  );
}
