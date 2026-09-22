import type { Metadata } from "next";
import { connection } from "next/server";
import { SiteShell } from "@/components/organisms/site-shell";
import { Faq, type FaqItem } from "@/components/sections/faq/Faq";
import { Hero } from "@/components/sections/hero/Hero";
import { StoreVisit } from "@/components/sections/store-visit/StoreVisit";
import {
  ValueProps,
  type ValueProp,
} from "@/components/sections/value-props/ValueProps";
import { SUPPORT_WHATSAPP_URL } from "@/config/contact";
import { siteConfig } from "@/config/site";
import { fetchMembershipShopInfo } from "@/services/membership.service";

const siteTitle = siteConfig.defaultSiteName;
const description =
  "Genuine stock checked at the counter, eSewa and cash on delivery, delivery across Nepal, and a shop you can actually walk into.";

export const metadata: Metadata = {
  title: `Why us | ${siteTitle}`,
  description,
  openGraph: { title: `Why us | ${siteTitle}`, description },
  twitter: {
    card: "summary_large_image",
    title: `Why us | ${siteTitle}`,
    description,
  },
};

/**
 * The same four promises the home page makes, stated at length.
 *
 * Every one of them is something this shop demonstrably does — eSewa and cash on
 * delivery are wired into checkout, NCM handles couriering, /membership is a live
 * signup page. Nothing here claims a rating, a customer count or an award,
 * because there is nothing in the shop's data to back one up.
 */
const reasons: ValueProp[] = [
  {
    title: "Genuine stock, checked by hand",
    body: "Every phone and accessory is opened, powered on and checked at the counter before it leaves the shop. What arrives is the model you chose, in the condition we would accept ourselves.",
    iconPath:
      "M9 12.75L11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 01-1.043 3.296 3.745 3.745 0 01-3.296 1.043A3.745 3.745 0 0112 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 01-3.296-1.043 3.745 3.745 0 01-1.043-3.296A3.745 3.745 0 013 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 011.043-3.296 3.746 3.746 0 013.296-1.043A3.746 3.746 0 0112 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 013.296 1.043 3.746 3.746 0 011.043 3.296A3.746 3.746 0 0121 12z",
  },
  {
    title: "Pay the way that suits you",
    body: "Check out online with eSewa, or pick cash on delivery and pay the courier at your door. At the counter we also take Fonepay, Khalti, IME Pay and bank transfer.",
    iconPath:
      "M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z",
  },
  {
    title: "Delivered anywhere in Nepal",
    body: "Orders ship through Nepal Can Move, so your parcel is trackable from our counter to your door — inside the valley or well outside it.",
    iconPath:
      "M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12",
  },
  {
    title: "A real shop, not just a website",
    body: "There is a counter you can walk up to. Come in, hold the phone, compare two models side by side, and take it home the same day.",
    iconPath:
      "M13.5 21v-7.5a.75.75 0 01.75-.75h3a.75.75 0 01.75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 003.75-.615A2.993 2.993 0 009.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 002.25 1.016c.896 0 1.7-.393 2.25-1.016a3.001 3.001 0 003.75.615m-16.5 0a3.004 3.004 0 01-.621-4.72l1.189-1.19A1.5 1.5 0 015.378 3h13.243a1.5 1.5 0 011.06.44l1.19 1.189a3 3 0 01-.621 4.72M6.75 18h3.75a.75.75 0 00.75-.75V13.5a.75.75 0 00-.75-.75H6.75a.75.75 0 00-.75.75v3.75c0 .414.336.75.75.75z",
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
      "Online you can pay with eSewa, or choose cash on delivery and pay when the courier reaches you. At the shop we also accept Fonepay, Khalti, IME Pay, bank transfer and cash.",
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

export default async function WhyUsPage() {
  // Render per request, so renaming the shop in settings shows up without a
  // redeploy and a build without database access does not bake in a blank name.
  // `connection()` rather than `export const dynamic`, which Next 16 drops under
  // Cache Components.
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
        eyebrow="Why us"
        title="A small shop that treats"
        titleAccent="every order like a visit."
        description={`${shopName} has sold phones and accessories over a counter long enough to know what goes wrong with buying one online. So we check the stock by hand, let you pay how you want, and stay reachable after the parcel arrives.`}
        primaryCta={{ label: "Shop everything", href: "/products" }}
        secondaryCta={{ label: "Visit the store", href: "/visit" }}
        highlights={[
          "Genuine products",
          "eSewa & cash on delivery",
          "Delivery across Nepal",
        ]}
      />

      <ValueProps
        eyebrow="What you get"
        title={`Why people buy from ${shopName}`}
        description="Four things we can actually promise, rather than four things that sound good."
        items={reasons}
      />

      <Faq
        id="faq"
        eyebrow="Before you buy"
        title="Questions we get asked"
        description="If yours is not here, message us on WhatsApp — someone at the counter will answer."
        items={faqs}
        surface
      />

      <StoreVisit
        eyebrow="Come say hello"
        title="Rather see it in person?"
        description="Come in, try it out, and take it home the same day."
        address={shop.address}
        phone={shop.phone}
        whatsappUrl={SUPPORT_WHATSAPP_URL}
      />
    </SiteShell>
  );
}
