/**
 * eSewa failure/cancel callback. eSewa redirects here when a payment is
 * cancelled or fails. No order is created; we send the shopper back to checkout
 * (their cart is preserved) with a cancelled status.
 */

import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function EsewaFailurePage() {
  redirect("/checkout?status=cancelled&message=Payment+was+cancelled+or+failed");
}
