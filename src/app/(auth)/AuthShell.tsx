import { BrandMark } from "@/components/atoms/brand-mark/BrandMark";

interface AuthShellProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}

/**
 * The chrome shared by sign-in, forgot-password and reset-password: brand mark,
 * heading, and the card the form sits in.
 *
 * These pages are the front door to the dashboard rather than to the shop, so
 * they wear the dashboard's `admin-*` content palette instead of the
 * storefront's theme — the two are close in tone but not the same, and a user
 * signing in should land on the surface they're about to work on. The
 * `admin-root` class is what globals.css keys that page ground off.
 */
export function AuthShell({ title, subtitle, children }: AuthShellProps) {
  return (
    <div className="admin-root bg-admin-bg flex min-h-screen items-center justify-center px-4">
      <div className="relative z-10 w-full max-w-md">
        <div className="mb-8 text-center">
          <BrandMark className="mx-auto h-14 w-14 rounded-2xl text-lg" />
          <h1 className="text-admin-text mt-5 text-2xl font-extrabold tracking-tight">
            {title}
          </h1>
          <p className="text-admin-text-secondary mt-1.5 text-sm">{subtitle}</p>
        </div>

        <div className="border-admin-border bg-admin-surface rounded-2xl border p-8 shadow-xl shadow-black/5">
          {children}
        </div>

        <p className="text-admin-text-muted mt-6 text-center text-xs">
          Protected area. Authorized users only.
        </p>
      </div>
    </div>
  );
}
