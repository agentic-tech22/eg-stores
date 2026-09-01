import type { Metadata } from "next";
import { FooterAesthetic } from "@/components/organisms/footer";
import { NavbarAesthetic } from "@/components/organisms/navbar";
import { siteConfig } from "@/config/site";
import { getActiveCurrency } from "@/lib/currency.server";
import type { FooterConfig, NavbarConfig } from "@/types/layout.types";
import { CartClient } from "./CartClient";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Cart", href: "/cart" },
];

const siteTitle = siteConfig.defaultSiteName;

export const metadata: Metadata = {
  title: `Cart | ${siteTitle}`,
  description: "Review the items in your cart.",
};

export default async function CartPage() {
  const currency = await getActiveCurrency();
  const navbarConfig: NavbarConfig = {
    siteName: siteTitle,
    links: navLinks,
    ctaText: "Shop Now",
  };
  const footerConfig: FooterConfig = {
    siteName: siteTitle,
    description: siteConfig.defaultDescription,
    links: [{ group: "Navigate", items: navLinks }],
  };

  return (
    <>
      <NavbarAesthetic config={navbarConfig} />
      <main className="flex-1">
        <CartClient currency={currency} />
      </main>
      <FooterAesthetic config={footerConfig} />
    </>
  );
}
