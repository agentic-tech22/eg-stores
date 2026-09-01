export interface NavbarConfig {
  siteName: string;
  logoUrl?: string;
  logoOrientation?: "horizontal" | "vertical" | "square";
  links: { label: string; href: string }[];
  ctaText: string;
  ctaHref?: string;
}

export interface FooterConfig {
  siteName: string;
  logoUrl?: string;
  logoOrientation?: "horizontal" | "vertical" | "square";
  description: string;
  links: { group: string; items: { label: string; href: string }[] }[];
}
