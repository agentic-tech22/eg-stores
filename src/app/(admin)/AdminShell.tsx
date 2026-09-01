"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Building2,
  ChevronDown,
  // Download, // used by the commented-out nav entries below
  ExternalLink,
  FileText,
  // LifeBuoy, // used by the commented-out nav entries below
  LayoutDashboard,
  LogOut,
  // Layers, // used by the commented-out nav entries below
  Menu,
  Package,
  Phone,
  Receipt,
  Settings,
  ShoppingCart,
  Truck,
  UserRound,
  Wallet,
  Users,
  // Warehouse, // used by the commented-out nav entries below
  X,
  type LucideIcon,
} from "lucide-react";
import { signOut } from "@/services/auth.service";
import { BrandMark } from "@/components/atoms/brand-mark/BrandMark";
import { useConfirm } from "@/components/molecules/confirm-dialog/confirm-context";
import { PermissionProvider } from "@/components/auth/permission-context";
import type { PermissionId, Role } from "@/lib/auth/permissions";
import { cn } from "@/utils/cn";

/** A sub-link nested under a collapsible group (inherits the group's visibility). */
interface NavChild {
  label: string;
  href: string;
}

interface NavLink {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Permission required to see this link. `null` = always; "admin" = admins only. */
  requires: PermissionId | "admin" | null;
  /** When present, this entry is a collapsible group of sub-links (no own page). */
  children?: NavChild[];
}

const allNavLinks: NavLink[] = [
  {
    label: "Overview",
    href: "/dashboard",
    requires: null,
    icon: LayoutDashboard,
  },
  {
    label: "Products",
    href: "/dashboard/products",
    requires: "products.view",
    icon: Package,
    children: [
      { label: "Categories", href: "/dashboard/products/categories" },
      { label: "All Products", href: "/dashboard/products" },
      { label: "Barcodes", href: "/dashboard/products/barcodes" },
    ],
  },
  // Hidden from the nav for now — uncomment to bring either back. The routes
  // themselves are still live and still reachable by URL; this only removes the
  // way in from the sidebar.
  // {
  //   label: "Combos",
  //   href: "/dashboard/combos",
  //   requires: "products.view",
  //   icon: Layers,
  // },
  // {
  //   label: "Warehouses",
  //   href: "/dashboard/warehouses",
  //   requires: "warehouses.view",
  //   icon: Warehouse,
  //   children: [
  //     { label: "All Warehouses", href: "/dashboard/warehouses" },
  //     { label: "Transfers", href: "/dashboard/warehouses/transfers" },
  //   ],
  // },
  {
    label: "Vendors",
    href: "/dashboard/vendors",
    requires: "vendors.view",
    icon: Truck,
  },
  {
    label: "Customers",
    href: "/dashboard/customers",
    requires: "customers.view",
    icon: UserRound,
  },
  {
    label: "Orders",
    href: "/dashboard/orders",
    requires: "orders.view",
    icon: ShoppingCart,
  },
  {
    label: "Point of Sale",
    href: "/dashboard/sales",
    requires: "sales.view",
    icon: Receipt,
    children: [
      { label: "Create New Sale", href: "/dashboard/sales/new" },
      { label: "View All Sales", href: "/dashboard/sales" },
      { label: "Extra Sales", href: "/dashboard/sales/extras" },
    ],
  },
  {
    label: "Expenses",
    href: "/dashboard/expenses",
    requires: "expenses.view",
    icon: Wallet,
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    requires: "sales.view",
    icon: BarChart3,
  },
  {
    label: "Invoices",
    href: "/dashboard/invoices",
    requires: "invoices.view",
    icon: FileText,
  },
  {
    label: "Settings",
    href: "/dashboard/settings",
    requires: "settings.ncm",
    icon: Settings,
  },
  {
    label: "Business",
    href: "/dashboard/settings/business",
    requires: "settings.business",
    icon: Building2,
  },
  { label: "Users", href: "/dashboard/users", requires: "admin", icon: Users },
  // Hidden alongside Combos and Warehouses above — uncomment to restore.
  // {
  //   label: "Export Data",
  //   href: "/dashboard/export-data",
  //   requires: "admin",
  //   icon: Download,
  // },
  // {
  //   label: "Support",
  //   href: "/dashboard/support",
  //   requires: null,
  //   icon: LifeBuoy,
  // },
];

interface AdminShellProps {
  children: React.ReactNode;
  email: string;
  role: Role;
  isAdmin: boolean;
  permissions: PermissionId[];
}

/**
 * Public storefront URL, inlined from the environment at build time. When unset,
 * "View Live Site" explains the site isn't connected yet instead of opening a
 * dead link. Trimmed so a blank value counts as "not configured".
 */
const LIVE_SITE_URL = process.env.NEXT_PUBLIC_SITE_URL?.trim() ?? "";

/** Who to contact to get a website set up (shown in the no-site modal). */
const WEBSITE_CONTACT_PHONE = "9743697262";
/** WhatsApp deep link (international format, no "+") for the "Chat now" action. */
const WEBSITE_CONTACT_WHATSAPP = "https://wa.me/9779743697262";

function isLinkMatch(pathname: string, href: string) {
  return (
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(`${href}/`))
  );
}

/**
 * Of all links that match the current path, only the most specific (longest
 * href) one is active, so /dashboard/settings/business highlights "Business",
 * not its parent "Settings".
 */
function getActiveHref(pathname: string, links: NavLink[]): string | null {
  // Collect every navigable href: group parents contribute their children's
  // hrefs (a group itself has no page) alongside plain links.
  const hrefs: string[] = [];
  for (const link of links) {
    if (link.children) hrefs.push(...link.children.map((c) => c.href));
    else hrefs.push(link.href);
  }
  let active: string | null = null;
  for (const href of hrefs) {
    if (
      isLinkMatch(pathname, href) &&
      (active === null || href.length > active.length)
    ) {
      active = href;
    }
  }
  return active;
}

function SidebarLogo() {
  return (
    <div className="flex items-center gap-3 px-5 py-6">
      <BrandMark className="h-10 w-10 text-[13px]" />
      <div className="leading-tight">
        <span className="font-heading text-lg font-bold tracking-tight text-white">
          EG Stores
        </span>
        <p className="text-admin-sidebar-muted text-[10px] font-bold tracking-[0.18em] uppercase">
          Point of Sale
        </p>
      </div>
    </div>
  );
}

function NavItems({
  links,
  pathname,
  onNavigate,
}: {
  links: NavLink[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const activeHref = getActiveHref(pathname, links);

  // Collapsible groups start expanded when one of their children is active, so
  // the current page is always revealed; the user can toggle from there.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const init = new Set<string>();
    for (const link of links) {
      if (link.children?.some((c) => c.href === activeHref))
        init.add(link.label);
    }
    return init;
  });

  function toggleGroup(label: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }

  return (
    <nav className="space-y-1" aria-label="Admin">
      <p className="text-admin-sidebar-muted px-3 pb-2 text-[10px] font-bold tracking-[0.2em] uppercase">
        Menu
      </p>
      {links.map((link) => {
        if (link.children) {
          const isOpen = expanded.has(link.label);
          const hasActiveChild = link.children.some(
            (c) => c.href === activeHref,
          );
          return (
            <div key={link.label}>
              <button
                type="button"
                onClick={() => toggleGroup(link.label)}
                aria-expanded={isOpen}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
                  hasActiveChild
                    ? "text-admin-sidebar-text-active"
                    : "text-admin-sidebar-text hover:bg-admin-sidebar-hover hover:text-admin-sidebar-text-active",
                )}
              >
                <link.icon className="h-5 w-5 shrink-0" />
                <span className="flex-1 text-left">{link.label}</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform duration-200",
                    isOpen && "rotate-180",
                  )}
                />
              </button>
              {isOpen && (
                <div className="mt-1 space-y-1 pl-4">
                  {link.children.map((child) => {
                    const active = child.href === activeHref;
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        onClick={onNavigate}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors duration-200",
                          active
                            ? "bg-admin-sidebar-accent/15 font-bold text-white"
                            : "text-admin-sidebar-text hover:bg-admin-sidebar-hover hover:text-admin-sidebar-text-active",
                        )}
                      >
                        {active && (
                          <span className="bg-admin-sidebar-accent absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full" />
                        )}
                        <span
                          className={cn(
                            "h-1.5 w-1.5 shrink-0 rounded-full",
                            active
                              ? "bg-admin-sidebar-accent"
                              : "bg-admin-sidebar-text/40",
                          )}
                        />
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        }

        const active = link.href === activeHref;
        return (
          <Link
            key={link.href}
            href={link.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
              active
                ? "bg-admin-sidebar-accent/15 font-bold text-white"
                : "text-admin-sidebar-text hover:bg-admin-sidebar-hover hover:text-admin-sidebar-text-active",
            )}
          >
            {active && (
              <span className="bg-admin-sidebar-accent absolute top-1/2 left-0 h-5 w-1 -translate-y-1/2 rounded-r-full" />
            )}
            <link.icon
              className={cn(
                "h-5 w-5 shrink-0",
                active && "text-admin-sidebar-accent",
              )}
            />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserCard({ email, role }: { email: string; role: Role }) {
  const initial = email.trim().charAt(0).toUpperCase() || "?";
  return (
    <div className="border-admin-sidebar-border bg-admin-sidebar-raised flex items-center gap-3 rounded-xl border px-3 py-2.5">
      <span className="from-admin-sidebar-accent to-admin-glow flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br text-sm font-bold text-white shadow-sm">
        {initial}
      </span>
      <div className="min-w-0 flex-1">
        <p
          className="text-admin-sidebar-text-active truncate text-xs font-semibold"
          title={email}
        >
          {email}
        </p>
        <span
          className={cn(
            "mt-1 inline-block rounded-full px-2 py-0.5 text-[9px] font-bold tracking-[0.12em] uppercase",
            role === "admin"
              ? "bg-admin-sidebar-accent/20 text-admin-sidebar-accent ring-admin-sidebar-accent/30 ring-1"
              : "bg-white/10 text-admin-sidebar-text",
          )}
        >
          {role === "admin" ? "Admin" : "Member"}
        </span>
      </div>
    </div>
  );
}

export function AdminShell({
  children,
  email,
  role,
  isAdmin,
  permissions,
}: AdminShellProps) {
  const pathname = usePathname();
  const confirm = useConfirm();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleSignOut() {
    const ok = await confirm({
      title: "Sign out",
      description: "Are you sure you want to sign out?",
      confirmLabel: "Sign out",
      destructive: true,
    });
    if (!ok) return;
    await signOut();
    window.location.href = "/login";
  }

  async function handleViewLiveSite() {
    // A configured storefront URL opens directly; otherwise guide the owner to
    // get a website set up rather than dead-ending on a broken link.
    if (LIVE_SITE_URL) {
      window.open(LIVE_SITE_URL, "_blank", "noopener,noreferrer");
      return;
    }
    const chatNow = await confirm({
      title: "No website yet",
      description: (
        <div className="space-y-3">
          <p>
            Your storefront isn&apos;t connected yet. Once your website is live,
            this button will take you straight to it.
          </p>
          <div className="border-admin-border bg-admin-card flex items-center gap-3 rounded-xl border p-3">
            <span className="bg-admin-accent/10 text-admin-accent flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
              <Phone className="h-4.5 w-4.5" strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <p className="text-admin-text-muted text-[11px] font-bold tracking-[0.15em] uppercase">
                Get your website
              </p>
              <p className="text-admin-text text-sm font-semibold">
                Reach out to your admin, or chat with us on{" "}
                {WEBSITE_CONTACT_PHONE}.
              </p>
            </div>
          </div>
        </div>
      ),
      confirmLabel: "Chat now",
      cancelLabel: "Close",
    });
    if (chatNow)
      window.open(WEBSITE_CONTACT_WHATSAPP, "_blank", "noopener,noreferrer");
  }

  const navLinks = allNavLinks.filter((link) => {
    if (link.requires === null) return true;
    if (link.requires === "admin") return isAdmin;
    return isAdmin || permissions.includes(link.requires);
  });

  return (
    <div className="admin-root bg-admin-bg flex min-h-screen font-sans">
      {/* Sidebar (desktop) */}
      <aside className="bg-admin-sidebar border-admin-sidebar-border fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r lg:flex print:hidden">
        <SidebarLogo />
        <div className="sidebar-scroll flex-1 overflow-y-auto px-4 pt-2">
          <NavItems links={navLinks} pathname={pathname} />
        </div>
        <div className="space-y-2 px-4 pb-6">
          <UserCard email={email} role={role} />
          <button
            type="button"
            onClick={handleSignOut}
            className="text-admin-sidebar-text hover:bg-admin-sidebar-danger/10 hover:text-admin-sidebar-danger flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200"
          >
            <LogOut className="h-5 w-5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col lg:pl-64 print:pl-0">
        {/* Top bar */}
        <header className="border-admin-border bg-admin-surface/80 sticky top-0 z-20 flex h-16 items-center justify-between border-b px-5 backdrop-blur-md lg:px-8 print:hidden">
          <button
            type="button"
            className="text-admin-text-muted hover:bg-admin-card hover:text-admin-text flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
          <button
            type="button"
            onClick={handleViewLiveSite}
            className="bg-admin-text text-admin-surface hover:bg-admin-text/90 ml-auto flex cursor-pointer items-center gap-2 rounded-full px-5 py-2 text-xs font-bold transition-transform active:scale-95"
          >
            <ExternalLink className="h-4 w-4" />
            View Live Site
          </button>
        </header>

        {/* Mobile nav drawer */}
        {mobileOpen && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <div
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              onClick={() => setMobileOpen(false)}
            />
            <aside className="bg-admin-sidebar border-admin-sidebar-border absolute inset-y-0 left-0 flex w-64 flex-col border-r shadow-2xl">
              <SidebarLogo />
              <div className="sidebar-scroll flex-1 overflow-y-auto px-4 pt-2">
                <NavItems
                  links={navLinks}
                  pathname={pathname}
                  onNavigate={() => setMobileOpen(false)}
                />
              </div>
              <div className="space-y-2 px-4 pb-6">
                <UserCard email={email} role={role} />
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="text-admin-sidebar-text hover:bg-admin-sidebar-danger/10 hover:text-admin-sidebar-danger flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
                >
                  <LogOut className="h-5 w-5" />
                  Sign Out
                </button>
              </div>
            </aside>
          </div>
        )}

        {/* Content */}
        <main className="flex-1 px-5 py-10 lg:px-12 print:p-0">
          <div className="mx-auto max-w-6xl print:max-w-none">
            <PermissionProvider isAdmin={isAdmin} permissions={permissions}>
              {children}
            </PermissionProvider>
          </div>
        </main>
      </div>
    </div>
  );
}
