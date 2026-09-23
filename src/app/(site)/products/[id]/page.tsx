import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteShell } from "@/components/organisms/site-shell";
import { siteConfig } from "@/config/site";
import {
  fetchProductById,
  fetchProductWithVariants,
} from "@/services/product.service";
import { fetchComboWithItems } from "@/services/combo.service";
import { getActiveCurrency } from "@/lib/currency.server";
import {
  toPublicCombo,
  toPublicProductWithVariants,
} from "@/utils/to-public-product";
import { ComboDetailClient } from "./ComboDetailClient";
import { ProductDetailClient } from "./ProductDetailClient";

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

  // Both detail views are client components, so cost is stripped before the
  // product crosses the boundary and lands in the page payload.
  let content;
  if (base.isCombo) {
    const combo = await fetchComboWithItems(id);
    if (!combo) notFound();
    content = (
      <ComboDetailClient combo={toPublicCombo(combo)} currency={currency} />
    );
  } else {
    const product = await fetchProductWithVariants(id);
    if (!product) notFound();
    content = (
      <ProductDetailClient
        product={toPublicProductWithVariants(product)}
        currency={currency}
      />
    );
  }

  return <SiteShell>{content}</SiteShell>;
}
