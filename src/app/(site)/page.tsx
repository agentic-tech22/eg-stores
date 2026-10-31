import type { Metadata } from "next";
import { SiteShell } from "@/components/organisms/site-shell";
import { CategoryGrid } from "@/components/sections/category-grid/CategoryGrid";
import { Faq, type FaqItem } from "@/components/sections/faq/Faq";
import { ImageBanner } from "@/components/sections/image-banner/ImageBanner";
import { ProductTabs } from "@/components/sections/product-tabs/ProductTabs";
import {
  PromoBento,
  type PromoTile,
} from "@/components/sections/promo-bento/PromoBento";
import {
  MembershipCardVisual,
  Spotlight,
} from "@/components/sections/spotlight/Spotlight";
import { StoreDetails } from "@/components/sections/store-details/StoreDetails";
import {
  ValueProps,
  type ValueProp,
} from "@/components/sections/value-props/ValueProps";
import { SUPPORT_WHATSAPP_URL } from "@/config/contact";
import { siteConfig } from "@/config/site";
import {
  STORE_DIRECTIONS,
  STORE_HERO,
  STORE_HOURS,
  STORE_POSTERS,
  categoryImageFor,
} from "@/config/store";
import { getActiveCurrency } from "@/lib/currency.server";
import { fetchCategories } from "@/services/category.service";
import { fetchMembershipShopInfo } from "@/services/membership.service";
import {
  fetchBestSellingProducts,
  fetchFeaturedProducts,
  fetchProducts,
} from "@/services/product.service";
import type { Product } from "@/types/product.types";
import { onlyBuyable } from "@/utils/product-availability";
import { toPublicProducts } from "@/utils/to-public-product";

const siteTitle = siteConfig.defaultSiteName;
const siteDescription =
  "Mobile accessories and everyday gadgets in Nepal: earbuds, headphones, speakers, chargers, powerbanks, watches and more. Pay with eSewa or cash on delivery, delivered nationwide.";

export const metadata: Metadata = {
  // `absolute` because the root template appends the shop name, and the home
  // page's own title IS the shop name: left to the template it read
  // "EG Stores · EG Stores".
  title: { absolute: siteTitle },
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
 * The questions people actually ask before buying a phone online in Nepal.
 *
 * Answers are written against what the shop really does. Warranty and return
 * wording is deliberately general ("as the brand's warranty allows") rather than
 * promising a fixed window this codebase cannot enforce — tighten it once the
 * shop's own policy is settled.
 */
const faqs: FaqItem[] = [
  {
    question: "Are your products original?",
    answer:
      "Yes. We stock genuine units and check each one at the counter before it is handed over or packed. If something is a refurbished or open-box unit, it is described as such on its product page.",
  },
  {
    question: "How do I pay?",
    answer:
      "Choose cash on delivery and pay when the courier reaches you. At the shop we also accept Fonepay, Khalti, IME Pay, bank transfer and cash.",
  },
  {
    question: "How long does delivery take?",
    answer:
      "Orders are handed to Nepal Can Move once they are packed. Inside Kathmandu valley that is usually the next working day; outside the valley it depends on the route NCM runs to your area. You get a tracking reference either way.",
  },
  {
    question: "Do you deliver outside Kathmandu?",
    answer:
      "Yes. We ship anywhere Nepal Can Move delivers, which covers most of the country. Message us on WhatsApp if you are unsure about your location and we will check the route before you order.",
  },
  {
    question: "What if the product has a problem?",
    answer:
      "Bring it to the shop, or message us first and we will tell you what to do. Manufacturing faults are handled as the brand's warranty allows, and we will help you raise it rather than leaving you to deal with the manufacturer alone.",
  },
  {
    question: "Can I see the product before buying?",
    answer:
      "Come to the shop. You can hold it, power it on and compare models side by side before deciding, and walk out with it the same day.",
  },
  {
    question: "Do you have a membership or loyalty scheme?",
    answer:
      "Yes — join the membership and you collect points on what you buy, redeemable against a later purchase at the counter. Signing up takes a phone number.",
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
  const [allFeatured, allBestSellers, allProducts, categories, shop, currency] =
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

  // Sold-out stock is dropped everywhere on the storefront, not just in the
  // /products grid: a rail of things nobody can buy is worse than a shorter
  // rail. Variant products and combos survive this — their real stock lives on
  // their variants and components, not on the product row.
  const products = onlyBuyable(allProducts);
  const featured = onlyBuyable(allFeatured);
  const bestSellers = onlyBuyable(allBestSellers);

  // Fall back to the head of the catalog when nothing is flagged featured yet,
  // so a shop that has not curated its homepage still shows stock.
  const featuredSource = featured.length > 0 ? featured : products.slice(0, 8);
  // Don't repeat in "New arrivals" what is already sitting in "Featured".
  const featuredIds = new Set(featuredSource.map((p) => p.id));
  const newArrivalsSource = newestFirst(products)
    .filter((p) => !featuredIds.has(p.id))
    .slice(0, 8);

  // Strip cost before these reach ProductCard, which is a client component:
  // props crossing that boundary end up readable in the page source.
  const featuredProducts = toPublicProducts(featuredSource.slice(0, 8));
  const newArrivals = toPublicProducts(newArrivalsSource);
  const bestSellingProducts = toPublicProducts(bestSellers.slice(0, 8));

  const shopName = shop.shopName ?? siteTitle;

  // Featured first, then dearest: the order in which a shop would lead with
  // two products from the same category, used to pick each category tile's
  // photo. Nothing is flagged featured in this catalogue yet, so without the
  // price tiebreak the pick went to whatever sat at the head of the table — a
  // Rs 1,000 watch shot on a scuffed desk. Price is the only signal in the
  // data for which product a shop would lead with, and in practice it also
  // tracks which product got photographed with any care.
  const leadFirst = (a: Product, b: Product) => {
    if (a.isFeatured !== b.isFeatured) return a.isFeatured ? -1 : 1;
    return b.price - a.price;
  };
  const photographed = [...featuredSource, ...products].filter(
    (product) => product.imageUrl,
  );

  // The promo grid: campaign posters from config, each opening the shop
  // already searched for what it advertises.
  const promoTiles: PromoTile[] = STORE_POSTERS.map((poster) => ({
    id: poster.query,
    imageUrl: poster.imageUrl,
    title: poster.title,
    href: `/products?q=${encodeURIComponent(poster.query)}`,
    ctaLabel: poster.ctaLabel,
  }));

  // A photo for each category tile: the curated one from config where there
  // is one, otherwise a photo of the product that would lead the category.
  const imageByCategory = new Map<string, string>();
  for (const category of categories) {
    const curated = categoryImageFor(category.name);
    if (curated) imageByCategory.set(category.id, curated);
  }
  for (const product of [...photographed].sort(leadFirst)) {
    if (product.categoryId && !imageByCategory.has(product.categoryId)) {
      imageByCategory.set(product.categoryId, product.imageUrl as string);
    }
  }

  // Curated categories lead the grid, so the dozen tiles it shows are the
  // ones with proper photography rather than whichever come first in the
  // shop's sort order. Stable, so the shop's order still holds within each
  // group.
  const gridCategories = [
    ...categories.filter((c) => categoryImageFor(c.name)),
    ...categories.filter((c) => !categoryImageFor(c.name)),
  ];

  return (
    <SiteShell>
      <PromoBento tiles={promoTiles} />

      <CategoryGrid
        categories={gridCategories}
        imageByCategory={imageByCategory}
      />

      <Spotlight
        eyebrow={`${shopName} membership`}
        title="Every purchase earns you something back."
        body="Join with just your phone number and collect points each time you buy, online or at the counter. Redeem them against your next purchase — no card to carry, no minimum spend."
        link={{ label: "Join the membership", href: "/membership" }}
        visual={<MembershipCardVisual shopName={shopName} />}
      />

      {/* One showcase in three slices. "Best sellers" is ranked by units sold,
          so it reorders itself as the shop trades, and drops out entirely
          while there are no sales yet rather than labelling an arbitrary slice
          of the catalogue. */}
      <ProductTabs
        id="featured"
        title="Featured products"
        tabs={[
          { id: "featured", label: "Featured", products: featuredProducts },
          {
            id: "best-sellers",
            label: "Best sellers",
            products: bestSellingProducts,
          },
          { id: "new", label: "New arrivals", products: newArrivals },
        ]}
        viewAll={{ label: "Browse more products", href: "/products" }}
        currency={currency}
      />

      {/* "Why us" and "Visit" are sections here rather than pages of their
          own, so the header's links scroll instead of navigating. `scroll-mt`
          on each keeps its heading clear of the sticky header, which would
          otherwise sit on top of whatever you just jumped to. */}
      <ValueProps
        id="why-us"
        className="bg-surface scroll-mt-28 lg:scroll-mt-40"
        title={`Why buy from ${shopName}?`}
        items={valueProps}
      />

      <Faq
        title="Know before you buy"
        description="If yours is not here, message us on WhatsApp — someone at the counter will answer."
        items={faqs}
      />

      {STORE_HERO.coverImage && (
        <ImageBanner
          imageUrl={STORE_HERO.coverImage}
          eyebrow={`Visit ${shopName}`}
          title="Hold it before you buy it."
          description="Come in, try it out, compare models side by side, and walk out with it the same day. Real shop, real people, six days a week."
          cta={{ label: "Plan your visit", href: "#visit" }}
        />
      )}

      {/* The map and opening hours: the actual reason someone follows a
          "Visit" link. */}
      <StoreDetails
        id="visit"
        className="scroll-mt-28 lg:scroll-mt-40"
        eyebrow="Come say hello"
        title="Visit us in store"
        address={shop.address}
        phone={shop.phone}
        whatsappUrl={SUPPORT_WHATSAPP_URL}
        hours={STORE_HOURS}
        directions={STORE_DIRECTIONS}
      />
    </SiteShell>
  );
}
