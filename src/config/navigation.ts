// Single source of truth for the public website's header and footer navigation.
//
// Before this existed, every public page (/, /products, /cart, /checkout) built
// its own navLinks + NavbarConfig + FooterConfig inline, so the header silently
// advertised different destinations depending on where you happened to be. The
// shell (see organisms/site-shell) reads from here so all of them stay in sync.
//
// The dashboard is deliberately absent: it is staff-only and auth-gated, and the
// shop's customers have no reason to see a link to it.

import { siteConfig } from "@/config/site";
import { SUPPORT_WHATSAPP_URL } from "@/config/contact";
import type { FooterConfig, NavbarConfig } from "@/types/layout.types";

/** Primary header navigation, left to right. */
export const SITE_NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "Shop", href: "/products" },
  { label: "Why us", href: "/why-us" },
  { label: "Visit", href: "/visit" },
] as const;

/** Header config shared by every public page. */
export const siteNavbarConfig: NavbarConfig = {
  siteName: siteConfig.defaultSiteName,
  links: [...SITE_NAV_LINKS],
  ctaText: "Shop now",
  ctaHref: "/products",
  showCart: true,
};

/** Footer config shared by every public page. */
export const siteFooterConfig: FooterConfig = {
  siteName: siteConfig.defaultSiteName,
  description: siteConfig.defaultDescription,
  links: [
    {
      group: "Shop",
      items: [
        { label: "All products", href: "/products" },
        { label: "Your cart", href: "/cart" },
        { label: "Membership", href: "/membership" },
      ],
    },
    {
      group: "Company",
      items: [
        { label: "Why us", href: "/why-us" },
        { label: "Visit the store", href: "/visit" },
        { label: "WhatsApp us", href: SUPPORT_WHATSAPP_URL },
      ],
    },
  ],
};
