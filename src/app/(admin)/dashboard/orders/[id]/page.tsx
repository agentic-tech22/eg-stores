import { notFound, redirect } from "next/navigation";
import { ctxHasPermission, getAuthContext } from "@/lib/auth/session";
import { getActiveCurrency } from "@/lib/currency.server";
import { fetchOrderById } from "@/services/order.service";
import { getNcmSettings } from "@/queries/ncm.query";
import type { NcmDeliveryType } from "@/types/ncm.types";

import { OrderDetailClient } from "./OrderDetailClient";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function OrderDetailPage({ params }: PageProps) {
  const { id } = await params;

  const ctx = await getAuthContext();
  if (!ctx) redirect("/login");
  if (!ctxHasPermission(ctx, "orders.view")) redirect("/dashboard");

  const order = await fetchOrderById(id);
  if (!order) notFound();

  const settings = await getNcmSettings();
  const ncmDefaults = {
    fromBranch: settings?.default_from_branch ?? null,
    deliveryType: (settings?.default_delivery_type as NcmDeliveryType) ?? "Door2Door",
    codCharge: settings?.default_cod_charge ?? 0,
  };

  return (
    <OrderDetailClient
      initialOrder={order}
      ncmDefaults={ncmDefaults}
      currency={await getActiveCurrency()}
      can={{
        edit: ctxHasPermission(ctx, "orders.edit"),
        cancel: ctxHasPermission(ctx, "orders.cancel"),
        delete: ctxHasPermission(ctx, "orders.delete"),
        ship: ctxHasPermission(ctx, "shipments.ship"),
        manage: ctxHasPermission(ctx, "shipments.manage"),
        convert: ctxHasPermission(ctx, "sales.create"),
      }}
    />
  );
}
