export interface NavbarConfig {
  siteName: string;
  logoUrl?: string;
  logoOrientation?: "horizontal" | "vertical" | "square";
  links: { label: string; href: string }[];
  ctaText: string;
  ctaHref?: string;
  /**
   * Show the live cart indicator in the header. Only meaningful inside the
   * (site) route group, where a CartProvider is mounted; defaults to false so
   * the navbar stays usable on pages without one.
   */
  showCart?: boolean;
}

export interface FooterConfig {
  siteName: string;
  logoUrl?: string;
  logoOrientation?: "horizontal" | "vertical" | "square";
  description: string;
  links: { group: string; items: { label: string; href: string }[] }[];
}
