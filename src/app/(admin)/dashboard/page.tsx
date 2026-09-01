import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, Package, Users } from "lucide-react";
import { siteConfig } from "@/config/site";
import { PageHeader } from "@/components/molecules/admin";
import { SalesPulse } from "@/components/dashboard/SalesPulse";
import { LowStockCard } from "@/components/dashboard/LowStockCard";
import { PendingOrdersCard } from "@/components/dashboard/PendingOrdersCard";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import { getActiveCurrency } from "@/lib/currency.server";
import { fetchSales } from "@/services/sale.service";
import { fetchOrders } from "@/services/order.service";
import { fetchProductsWithStock } from "@/services/product.service";
import type { Sale } from "@/types/sale.types";
import type { Order } from "@/types/order.types";
import type { Product } from "@/types/product.types";

export default async function DashboardPage() {
  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");

  const siteName = siteConfig.defaultSiteName;
  const canViewSales = ctxHasPermission(ctx, "sales.view");
  const canViewFinances = ctxHasPermission(ctx, "finances.view");
  const canViewProducts = ctxHasPermission(ctx, "products.view");
  const canViewOrders = ctxHasPermission(ctx, "orders.view");

  // Fetch only what the user is allowed to see; tolerate read failures.
  const [sales, stock, orders, currency] = await Promise.all([
    canViewSales
      ? fetchSales().catch(() => [] as Sale[])
      : Promise.resolve([] as Sale[]),
    canViewProducts
      ? fetchProductsWithStock().catch(() => ({
          products: [] as Product[],
          variantStock: {} as Record<
            string,
            { total: number; available: number }
          >,
        }))
      : Promise.resolve({
          products: [] as Product[],
          variantStock: {} as Record<
            string,
            { total: number; available: number }
          >,
        }),
    canViewOrders
      ? fetchOrders().catch(() => [] as Order[])
      : Promise.resolve([] as Order[]),
    getActiveCurrency(),
  ]);

  const showCurrentState = canViewProducts || canViewOrders;

  const actions = [
    canViewSales && {
      href: "/dashboard/analytics",
      title: "Analytics",
      description: "Drill into sales over any date range",
      icon: <BarChart3 className="h-5 w-5" />,
      chip: "bg-admin-accent/10 text-admin-accent",
    },
    canViewProducts && {
      href: "/dashboard/products",
      title: "Products",
      description: "Add and organize your collection",
      icon: <Package className="h-5 w-5" />,
      chip: "bg-emerald-500/10 text-emerald-600",
    },
    ctx.isAdmin && {
      href: "/dashboard/users",
      title: "Users",
      description: "Invite people and manage permissions",
      icon: <Users className="h-5 w-5" />,
      chip: "bg-indigo-500/10 text-indigo-600",
    },
  ].filter(Boolean) as {
    href: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    chip: string;
  }[];

  return (
    <div>
      <PageHeader
        eyebrow="Dashboard"
        title="Welcome back"
        description={`Here's how ${siteName} is doing.`}
      />

      {canViewSales && (
        <div className="mb-8">
          <SalesPulse
            initialSales={sales}
            currency={currency}
            canViewFinances={canViewFinances}
          />
        </div>
      )}

      {showCurrentState && (
        <div className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-2">
          {canViewProducts && (
            <LowStockCard
              products={stock.products}
              variantStock={stock.variantStock}
            />
          )}
          {canViewOrders && <PendingOrdersCard initialOrders={orders} />}
        </div>
      )}

      {actions.length > 0 && (
        <>
          <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.18em] text-admin-text-muted">
            Quick Actions
          </p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {actions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="group flex items-center gap-4 rounded-2xl border border-admin-border bg-admin-surface p-5 transition-all hover:border-admin-accent/40 hover:shadow-sm"
              >
                <div
                  className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${action.chip}`}
                >
                  {action.icon}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-admin-text transition-colors group-hover:text-admin-accent">
                    {action.title}
                  </p>
                  <p className="text-[12px] text-admin-text-muted">
                    {action.description}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 shrink-0 text-admin-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-admin-accent" />
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
