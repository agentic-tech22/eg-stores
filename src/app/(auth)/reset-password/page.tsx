import type { Metadata } from "next";
import { getUser } from "@/services/auth.service";
import { AuthShell } from "../AuthShell";
import { ResetPasswordForm } from "./ResetPasswordForm";

export const metadata: Metadata = {
  title: "Set a new password | Dashboard",
};

export default async function ResetPasswordPage() {
  // The /auth/reset route handler exchanges the recovery code for a session
  // before redirecting here, so a signed-in user means the link was valid.
  const user = await getUser();

  return (
    <AuthShell
      title="Set a new password"
      subtitle="Choose a strong password you don't use anywhere else."
    >
      {user ? (
        <ResetPasswordForm />
      ) : (
        <div className="space-y-4 text-center">
          <p className="text-admin-text text-sm font-bold">
            This link is invalid or expired
          </p>
          <p className="text-admin-text-secondary text-sm">
            Password reset links can only be used once and expire after a short
            time.
          </p>
          <a
            href="/forgot-password"
            className="text-admin-accent hover:text-admin-accent-hover inline-block text-sm font-semibold transition-colors"
          >
            Request a new link
          </a>
        </div>
      )}
    </AuthShell>
  );
}
