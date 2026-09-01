import { redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import { fetchBusinessProfile } from "@/services/invoice.service";
import type { BusinessProfile } from "@/types/invoice.types";
import { BusinessProfileForm } from "./BusinessProfileForm";

export default async function BusinessSettingsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "settings.business")) redirect("/dashboard");

  let profile: BusinessProfile | null = null;
  try {
    profile = await fetchBusinessProfile();
  } catch {
    // Render an empty form if the profile can't be read.
  }

  return <BusinessProfileForm initialProfile={profile} />;
}
