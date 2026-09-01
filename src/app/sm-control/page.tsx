import type { Metadata } from "next";
import { isSuperManagerAuthed, superManagerPin } from "@/lib/super-manager/auth";
import { getSuperManagerSubscription } from "@/services/subscription.service";
import { PinGate } from "./PinGate";
import { SuperManagerPanel } from "./SuperManagerPanel";

// Hidden control panel: not linked anywhere, never indexed, and always rendered
// dynamically since access depends on the request's session cookie.
export const metadata: Metadata = {
  title: "Control",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function SmControlPage() {
  const configured = Boolean(superManagerPin());
  const authed = configured && (await isSuperManagerAuthed());

  if (!authed) {
    return <PinGate configured={configured} />;
  }

  const subscription = await getSuperManagerSubscription();
  return <SuperManagerPanel initial={subscription} />;
}
