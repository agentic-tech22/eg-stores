import { redirect } from "next/navigation";
import { getAuthContext } from "@/lib/auth/session";
import { getSubscriptionStatus } from "@/lib/subscription/status";
import { Providers } from "@/app/providers";
import { AdminShell } from "./AdminShell";
import { SubscriptionLockScreen } from "./SubscriptionLockScreen";
import { AccountDeactivatedScreen } from "./AccountDeactivatedScreen";

export default async function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const ctx = await getAuthContext();

  if (!ctx) {
    redirect("/login");
  }

  // Deactivation gate: a user deactivated mid-session keeps a valid cookie until
  // it expires, so render ONLY the lock screen: the dashboard is never sent to
  // the client. Server actions are separately blocked by requireAuth.
  if (!ctx.isActive) {
    return <AccountDeactivatedScreen />;
  }

  // Subscription gate: when lapsed, render ONLY the lock screen: the dashboard
  // and its children are never sent to the client. Managed from /sm-control.
  const subscription = await getSubscriptionStatus();
  if (subscription.locked) {
    return <SubscriptionLockScreen status={subscription} />;
  }

  return (
    <Providers>
      <AdminShell
        email={ctx.email}
        role={ctx.role}
        isAdmin={ctx.isAdmin}
        permissions={ctx.permissions}
      >
        {children}
      </AdminShell>
    </Providers>
  );
}
