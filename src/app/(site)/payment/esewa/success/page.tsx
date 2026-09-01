/**
 * eSewa success callback. eSewa redirects here after a payment, appending its
 * own base64 `data` blob to the success URL we supplied (which carried only our
 * short `ref` = transaction_uuid). We verify the payment, look the stashed cart
 * up by that reference, place the paid order, then send the shopper back to
 * checkout with a status the client uses to clear the cart and show a confirmation.
 */

import { redirect } from "next/navigation";
import { processEsewaCheckoutSuccess } from "@/lib/esewa/actions";

export const dynamic = "force-dynamic";

interface PageProps {
  searchParams: Promise<{ ref?: string; data?: string }>;
}

export default async function EsewaSuccessPage({ searchParams }: PageProps) {
  const params = await searchParams;

  let ref = params.ref;
  let encodedEsewaData = params.data;

  // Our success_url ends with `?ref=...`; eSewa naively appends `?data=...`, so
  // the query parser folds both into `ref` as "<uuid>?data=<esewa>". Split it.
  if (ref && ref.includes("?data=")) {
    const [refPart, dataPart] = ref.split("?data=");
    ref = refPart;
    encodedEsewaData = dataPart;
  }

  if (!ref || !encodedEsewaData) {
    redirect("/checkout?status=failed&message=No+payment+data+received");
  }

  const result = await processEsewaCheckoutSuccess(encodedEsewaData, ref);

  if (!result.success || !result.orderId) {
    redirect(
      `/checkout?status=failed&message=${encodeURIComponent(result.error || "Payment failed")}`,
    );
  }

  redirect(`/checkout?status=success&order=${result.orderId}`);
}
