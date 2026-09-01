import { Suspense } from "react";
import type { Metadata } from "next";
import { FooterAesthetic } from "@/components/organisms/footer";
import { NavbarAesthetic } from "@/components/organisms/navbar";
import { siteConfig } from "@/config/site";
import { getActiveCurrency } from "@/lib/currency.server";
import type { FooterConfig, NavbarConfig } from "@/types/layout.types";
import { CheckoutClient } from "./CheckoutClient";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
  { label: "Cart", href: "/cart" },
];

const siteTitle = siteConfig.defaultSiteName;

export const metadata: Metadata = {
  title: `Checkout | ${siteTitle}`,
  description: "Complete your order.",
};

export default async function CheckoutPage() {
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
        <Suspense fallback={null}>
          <CheckoutClient currency={currency} />
        </Suspense>
      </main>
      <FooterAesthetic config={footerConfig} />
    </>
  );
}
