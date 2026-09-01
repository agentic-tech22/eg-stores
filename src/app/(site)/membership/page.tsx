import type { Metadata } from "next";
import { connection } from "next/server";
import { fetchMembershipShopInfo } from "@/services/membership.service";
import { MembershipForm } from "./MembershipForm";

export const metadata: Metadata = {
  title: "Become a member",
  description:
    "Join our membership program and collect loyalty points on every purchase.",
};

/**
 * Public membership signup, reached by scanning the QR code printed from the
 * dashboard. No auth: anyone with the link can enrol. The submission itself is
 * handled by `submitMembershipSignup`, which validates server-side.
 */
export default async function MembershipPage() {
  // Render per request rather than at build time, so renaming the shop in
  // settings shows up here without a redeploy — and so a build running without
  // database access doesn't bake in a permanently blank name. `connection()`
  // rather than `export const dynamic`, which Next 16 drops under Cache
  // Components.
  await connection();

  let shopName: string | null = null;
  try {
    const shop = await fetchMembershipShopInfo();
    shopName = shop.shopName;
  } catch {
    // Branding is decorative; the form still works without a shop name.
  }

  return <MembershipForm shopName={shopName} />;
}
