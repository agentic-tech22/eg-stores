import type { Metadata } from "next";
import { SiteShell } from "@/components/organisms/site-shell";
import { siteConfig } from "@/config/site";
import { getActiveCurrency } from "@/lib/currency.server";
import { CartClient } from "./CartClient";

const siteTitle = siteConfig.defaultSiteName;

export const metadata: Metadata = {
  title: `Cart | ${siteTitle}`,
  description: "Review the items in your cart.",
};

export default async function CartPage() {
  const currency = await getActiveCurrency();

  return (
    <SiteShell>
      <CartClient currency={currency} />
    </SiteShell>
  );
}
