import type { Metadata } from "next";
import { SiteShell } from "@/components/organisms/site-shell";
import { CategoryStrip } from "@/components/sections/category-strip/CategoryStrip";
import { Hero, type HeroShowcaseItem } from "@/components/sections/hero/Hero";
import { ProductRail } from "@/components/sections/product-rail/ProductRail";
import { StoreVisit } from "@/components/sections/store-visit/StoreVisit";
import {
  TrustStrip,
  type TrustPoint,
} from "@/components/sections/trust-strip/TrustStrip";
import {
  ValueProps,
  type ValueProp,
} from "@/components/sections/value-props/ValueProps";
import { SUPPORT_WHATSAPP_URL } from "@/config/contact";
import { siteConfig } from "@/config/site";
import { STORE_HERO } from "@/config/store";
import { getActiveCurrency } from "@/lib/currency.server";
import { fetchCategories } from "@/services/category.service";
import { fetchMembershipShopInfo } from "@/services/membership.service";
import {
  fetchBestSellingProducts,
  fetchFeaturedProducts,
  fetchProducts,
} from "@/services/product.service";
import type { Product } from "@/types/product.types";
import { pickAcrossCategories } from "@/utils/pick-across-categories";
import { toPublicProducts } from "@/utils/to-public-product";

const siteTitle = siteConfig.defaultSiteName;
const siteDescription =
  "Mobile accessories and everyday gadgets in Nepal: earbuds, headphones, speakers, chargers, powerbanks, watches and more. Pay with eSewa or cash on delivery, delivered nationwide.";

export const metadata: Metadata = {
  title: siteTitle,
  description: siteDescription,
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
  },
};

/**
 * Reasons to buy here. Deliberately limited to things this shop actually does —
 * eSewa and cash on delivery are wired up in checkout, NCM handles couriering,
 * and /membership is a live signup page — rather than invented social proof.
 */
const valueProps: ValueProp[] = [
  {
    title: "Genuine stock",
    body: "Everything we sell is checked at the counter before it leaves the shop, so what arrives is what you chose.",
    iconPath:
      "M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.746 3.746 0 0121 12z",
  },
  {
    title: "Pay your way",
    body: "Check out online with eSewa, or choose cash on delivery and pay when the package reaches your door.",
    iconPath:
      "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z",
  },
  {
    title: "Delivered anywhere",
    body: "Orders ship through Nepal Can Move, so your order reaches you wherever you are with tracking from door to door.",
    iconPath:
      "M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12",
  },
  {
    title: "Rewards for regulars",
    body: "Join the membership and earn points on what you buy, redeemable against your next purchase at the counter.",
    iconPath:
      "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z",
  },
];

/**
 * The band under the hero. Every claim maps to something wired up in this
 * codebase, which is the bar for anything that appears this high on the page.
 */
const trustPoints: TrustPoint[] = [
  {
    title: "Genuine stock",
    detail: "Checked at the counter before it ships",
    iconPath:
      "M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.746 3.746 0 0121 12z",
  },
  {
    title: "Delivered across Nepal",
    detail: "Tracked door to door with NCM",
    iconPath:
      "M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12",
  },
  {
    title: "eSewa or cash on delivery",
    detail: "Pay online, or pay the courier",
    iconPath:
      "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z",
  },
  {
    title: "A counter to walk into",
    detail: "Real shop, real people, six days a week",
    iconPath:
      "M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.615m-16.5 0a3.004 3.004 0 01-.621-4.72l1.189-1.19A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72M6.75 18h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .414.336.75.75.75z",
  },
];

/** Newest first, so the "New arrivals" rail reflects what just landed. */
function newestFirst(products: Product[]): Product[] {
  return [...products].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export default async function HomePage() {
  // Every one of these is safe to call unauthenticated: the product/category
  // reads go through the anon-readable tables, and fetchMembershipShopInfo is
  // the deliberately ungated shop-branding reader used by /membership.
  const [featured, bestSellers, products, categories, shop, currency] =
    await Promise.all([
      fetchFeaturedProducts(8).catch(() => [] as Product[]),
      fetchBestSellingProducts(10).catch(() => [] as Product[]),
      fetchProducts().catch(() => [] as Product[]),
      fetchCategories().catch(() => []),
      fetchMembershipShopInfo().catch(() => ({
        shopName: null,
        logoUrl: null,
        address: null,
        phone: null,
      })),
      getActiveCurrency(),
    ]);

  // Fall back to the head of the catalog when nothing is flagged featured yet,
  // so a shop that has not curated its homepage still shows stock.
  const featuredSource = featured.length > 0 ? featured : products.slice(0, 4);
  // Don't repeat in "New arrivals" what is already sitting in "Featured".
  const featuredIds = new Set(featuredSource.map((p) => p.id));
  const newArrivalsSource = newestFirst(products)
    .filter((p) => !featuredIds.has(p.id))
    .slice(0, 4);

  // Strip cost before these reach ProductCard, which is a client component:
  // props crossing that boundary end up readable in the page source.
  const featuredProducts = toPublicProducts(featuredSource);
  const newArrivals = toPublicProducts(newArrivalsSource);
  const bestSellingProducts = toPublicProducts(bestSellers);

  // Real stock, floated over the hero cover and blurred behind it.
  //
  // Featured products lead, so the shop keeps control of what greets a
  // visitor, with the rest of the catalogue behind them to fill any gap. The
  // spread is one per category: taking the first three featured products
  // meant that a shop flagging several watches got a hero that advertised
  // nothing but watches. Photo-less products are dropped first — an empty
  // tile in the hero is worse than one fewer tile.
  //
  // Which product represents a category is the comparator, not a pre-sort of
  // the list: featured first, then dearest. Nothing is flagged featured in
  // this catalogue yet, so without that tiebreak the slot went to whatever sat
  // at the head of the table, which put a Rs 1,000 Casio F-91W shot on a
  // scuffed desk in the largest card on the front page. Price is the only
  // signal in the data for which of two watches a shop would lead with, and in
  // practice it also tracks which product got photographed with any care.
  const heroShowcase: HeroShowcaseItem[] = pickAcrossCategories(
    [...featuredSource, ...products].filter((product) => product.imageUrl),
    3,
    (a, b) => {
      if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
      return b.price - a.price;
    },
  ).map((product) => ({
    id: product.id,
    title: product.title,
    imageUrl: product.imageUrl,
    href: `/products/${product.id}`,
  }));

  const shopName = shop.shopName ?? siteTitle;

  return (
    <SiteShell>
      <Hero
        eyebrow={STORE_HERO.tagline}
        title="Everything for your phone,"
        titleAccent="and everything around it."
        description={`${shopName} stocks earbuds, headphones, speakers, chargers, powerbanks, car chargers, phone holders, watches and trimmers. Order in a few taps and pay with eSewa or cash on delivery.`}
        primaryCta={{ label: "Shop everything", href: "/products" }}
        secondaryCta={{ label: "Visit the store", href: "/visit" }}
        highlights={[
          "Genuine products",
          "eSewa & cash on delivery",
          "Delivery across Nepal",
        ]}
        coverImage={STORE_HERO.coverImage}
        showcase={heroShowcase}
      />

      <TrustStrip items={trustPoints} />

      <CategoryStrip categories={categories} />

      <ProductRail
        id="featured"
        eyebrow="Handpicked"
        title="Featured right now"
        description="The pieces moving fastest off our shelves this week."
        products={featuredProducts}
        viewAll={{ label: "See all products", href: "/products" }}
        currency={currency}
      />

      {/* Ranked by units sold, so it reorders itself as the shop trades. The
          rail hides itself when there are no sales yet, rather than showing a
          "best sellers" heading over an arbitrary slice of the catalogue. */}
      <ProductRail
        id="best-sellers"
        eyebrow="Most loved"
        title="Best sellers"
        description="The ten our customers reach for most."
        products={bestSellingProducts}
        viewAll={{ label: "See all products", href: "/products" }}
        currency={currency}
        surface
      />

      <ProductRail
        id="new-arrivals"
        eyebrow="Just landed"
        title="New arrivals"
        products={newArrivals}
        viewAll={{ label: "Browse the shop", href: "/products" }}
        currency={currency}
      />

      <ValueProps
        id="why-us"
        eyebrow="Why us"
        title={`Why people buy from ${shopName}`}
        description="A small shop that treats an online order exactly like someone walking through the door."
        items={valueProps}
      />

      <StoreVisit
        id="visit"
        eyebrow="Come say hello"
        title="Visit us in store"
        description="Want to hold it before you buy it? Come in, try it out, and walk out with it the same day."
        address={shop.address}
        phone={shop.phone}
        whatsappUrl={SUPPORT_WHATSAPP_URL}
      />
    </SiteShell>
  );
}
