import { redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import { getNcmSettingsForAdmin } from "@/services/ncm.service";
import { NcmSettingsForm } from "./NcmSettingsForm";

export default async function SettingsPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "settings.ncm")) redirect("/dashboard");

  const settings = await getNcmSettingsForAdmin();
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000";

  return <NcmSettingsForm initialSettings={settings} appUrl={appUrl} />;
}
