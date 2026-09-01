import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { FooterAesthetic } from "@/components/organisms/footer";
import { NavbarAesthetic } from "@/components/organisms/navbar";
import { siteConfig } from "@/config/site";
import {
  fetchProductById,
  fetchProductWithVariants,
} from "@/services/product.service";
import { fetchComboWithItems } from "@/services/combo.service";
import { getActiveCurrency } from "@/lib/currency.server";
import type { FooterConfig, NavbarConfig } from "@/types/layout.types";
import { ComboDetailClient } from "./ComboDetailClient";
import { ProductDetailClient } from "./ProductDetailClient";

const navLinks = [
  { label: "Home", href: "/" },
  { label: "Products", href: "/products" },
];

const siteTitle = siteConfig.defaultSiteName;

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const product = await fetchProductById(id);
  if (!product) return { title: "Product Not Found" };
  const title = `${product.title} | ${siteTitle}`;
  const description = product.description ?? `${product.title} available at ${siteTitle}`;
  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: product.imageUrl ? [{ url: product.imageUrl, width: 800, height: 1000, alt: product.title }] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: product.imageUrl ? [product.imageUrl] : undefined,
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await params;

  // Resolve the base product first so we can 404 hidden items and route combos
  // to their own detail view.
  const base = await fetchProductById(id);
  if (!base || !base.isVisible) notFound();

  const currency = await getActiveCurrency();

  const navbarConfig: NavbarConfig = {
    siteName: siteTitle,
    links: navLinks,
    ctaText: "Shop Now",
    ctaHref: "/checkout",
  };

  const footerConfig: FooterConfig = {
    siteName: siteTitle,
    description: siteConfig.defaultDescription,
    links: [{ group: "Navigate", items: navLinks }],
  };

  let content;
  if (base.isCombo) {
    const combo = await fetchComboWithItems(id);
    if (!combo) notFound();
    content = <ComboDetailClient combo={combo} currency={currency} />;
  } else {
    const product = await fetchProductWithVariants(id);
    if (!product) notFound();
    content = <ProductDetailClient product={product} currency={currency} />;
  }

  return (
    <>
      <NavbarAesthetic config={navbarConfig} />
      <main className="flex-1">{content}</main>
      <FooterAesthetic config={footerConfig} />
    </>
  );
}
