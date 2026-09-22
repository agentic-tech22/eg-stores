import { Suspense } from "react";
import type { Metadata } from "next";
import { SiteShell } from "@/components/organisms/site-shell";
import { siteConfig } from "@/config/site";
import { getActiveCurrency } from "@/lib/currency.server";
import { fetchCategories } from "@/services/category.service";
import { fetchProducts } from "@/services/product.service";
import { toPublicProducts } from "@/utils/to-public-product";
import { ProductsPageClient } from "./ProductsPageClient";

const siteTitle = siteConfig.defaultSiteName;
const description = "Browse every phone and accessory we have in stock.";

export const metadata: Metadata = {
  title: `Products | ${siteTitle}`,
  description,
  openGraph: { title: `Products | ${siteTitle}`, description },
  twitter: {
    card: "summary_large_image",
    title: `Products | ${siteTitle}`,
    description,
  },
};

export default async function ProductsPage() {
  const [products, categories, currency] = await Promise.all([
    fetchProducts(),
    fetchCategories(),
    getActiveCurrency(),
  ]);

  return (
    <SiteShell>
      {/* ProductsPageClient reads ?category= via useSearchParams, which needs a
          Suspense boundary above it. */}
      <Suspense fallback={null}>
        {/* Cost stripped: ProductsPageClient is a client component, so its props
            are serialized into the page payload. */}
        <ProductsPageClient
          products={toPublicProducts(products)}
          categories={categories}
          currency={currency}
        />
      </Suspense>
    </SiteShell>
  );
}
