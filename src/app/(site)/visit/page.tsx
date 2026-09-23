import type { Metadata } from "next";
import { connection } from "next/server";
import { SiteShell } from "@/components/organisms/site-shell";
import { Hero } from "@/components/sections/hero/Hero";
import { StoreDetails } from "@/components/sections/store-details/StoreDetails";
import {
  ValueProps,
  type ValueProp,
} from "@/components/sections/value-props/ValueProps";
import { SUPPORT_WHATSAPP_URL } from "@/config/contact";
import { siteConfig } from "@/config/site";
import { STORE_DIRECTIONS, STORE_HERO, STORE_HOURS } from "@/config/store";
import { fetchMembershipShopInfo } from "@/services/membership.service";

const siteTitle = siteConfig.defaultSiteName;
const description =
  "Find the shop, check our opening hours, and see what you can do at the counter — phones, accessories, setup help and membership signup.";

export const metadata: Metadata = {
  title: `Visit the store | ${siteTitle}`,
  description,
  openGraph: { title: `Visit the store | ${siteTitle}`, description },
  twitter: {
    card: "summary_large_image",
    title: `Visit the store | ${siteTitle}`,
    description,
  },
};

/**
 * Reasons to make the trip rather than order online. Each one is something the
 * counter genuinely does — no repairs claim, because nothing in this codebase
 * tracks a repair job.
 */
const inStore: ValueProp[] = [
  {
    title: "Hold it before you buy it",
    body: "Compare two phones side by side, feel the weight, check the screen in daylight. The thing a product photo cannot tell you.",
    iconPath:
      "M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z",
  },
  {
    title: "Walk out with it today",
    body: "What is on the shelf goes home with you the same visit. No courier window, no tracking page to refresh.",
    iconPath:
      "M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z",
  },
  {
    title: "Set up at the counter",
    body: "We will get the phone started, move your data across and fit the case and screen protector before you leave.",
    iconPath:
      "M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z",
  },
  {
    title: "Join the membership",
    body: "Sign up at the counter in a minute and start collecting points on what you buy, redeemable against your next purchase.",
    iconPath:
      "M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.562.562 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.562.562 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z",
  },
];

export default async function VisitPage() {
  // Address and phone come from the business profile, so render per request:
  // updating them in settings should show here without a redeploy. `connection()`
  // rather than `export const dynamic`, which Next 16 drops under Cache
  // Components.
  await connection();

  const shop = await fetchMembershipShopInfo().catch(() => ({
    shopName: null,
    logoUrl: null,
    address: null,
    phone: null,
  }));

  const shopName = shop.shopName ?? siteTitle;

  return (
    <SiteShell>
      <Hero
        eyebrow="Come say hello"
        title="Visit the"
        titleAccent={`${shopName} counter.`}
        description="Want to hold it before you buy it? Come in, try it out, ask the awkward questions, and walk out with it the same day."
        primaryCta={{ label: "Message us on WhatsApp", href: SUPPORT_WHATSAPP_URL }}
        secondaryCta={{ label: "Browse the shop", href: "/products" }}
        highlights={["Open six days a week", "Same-day pickup", "Setup at the counter"]}
        coverImage={STORE_HERO.coverImage}
      />

      <StoreDetails
        address={shop.address}
        phone={shop.phone}
        whatsappUrl={SUPPORT_WHATSAPP_URL}
        hours={STORE_HOURS}
        directions={STORE_DIRECTIONS}
      />

      <ValueProps
        eyebrow="At the counter"
        title="What you can do in store"
        description="Things the website cannot do for you."
        items={inStore}
        className="bg-surface"
      />
    </SiteShell>
  );
}
