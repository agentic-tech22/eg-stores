import { Suspense } from "react";
import type { Metadata } from "next";
import { SiteShell } from "@/components/organisms/site-shell";
import { siteConfig } from "@/config/site";
import { getActiveCurrency } from "@/lib/currency.server";
import { CheckoutClient } from "./CheckoutClient";

const siteTitle = siteConfig.defaultSiteName;

export const metadata: Metadata = {
  title: `Checkout | ${siteTitle}`,
  description: "Complete your order.",
};

export default async function CheckoutPage() {
  const currency = await getActiveCurrency();

  return (
    <SiteShell>
      <Suspense fallback={null}>
        <CheckoutClient currency={currency} />
      </Suspense>
    </SiteShell>
  );
}
