import type { Metadata } from "next";
import { FooterAesthetic } from "@/components/organisms/footer";
import { NavbarAesthetic } from "@/components/organisms/navbar";
import { siteConfig } from "@/config/site";
import { fetchProducts } from "@/services/product.service";
import { fetchCategories } from "@/services/category.service";
import { getActiveCurrency } from "@/lib/currency.server";
import type { FooterConfig, NavbarConfig } from "@/types/layout.types";
import { ProductsPageClient } from "./ProductsPageClient";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
];

const siteTitle = siteConfig.defaultSiteName;

export const metadata: Metadata = {
  title: `Products | ${siteTitle}`,
  description: "Browse our full collection of products.",
  openGraph: { title: `Products | ${siteTitle}`, description: "Browse our full collection of products." },
  twitter: { card: "summary_large_image", title: `Products | ${siteTitle}`, description: "Browse our full collection of products." },
};

export default async function ProductsPage() {
  const [products, categories, currency] = await Promise.all([
    fetchProducts(),
    fetchCategories(),
    getActiveCurrency(),
  ]);

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
        <ProductsPageClient products={products} categories={categories} currency={currency} />
      </main>
      <FooterAesthetic config={footerConfig} />
    </>
  );
}
