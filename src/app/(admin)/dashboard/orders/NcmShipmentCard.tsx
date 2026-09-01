"use client";

import { useState } from "react";
import {
  MessageSquarePlus,
  PackageCheck,
  RefreshCw,
  RotateCcw,
  Truck,
  Undo2,
} from "lucide-react";
import { useConfirm } from "@/components/molecules/confirm-dialog/confirm-context";
import { Textarea } from "@/components/molecules/form";
import {
  useAddNcmComment,
  useNcmComments,
  useReturnNcmOrder,
  useSyncNcmStatus,
} from "@/hooks/ncm/use-ncm-shipment";
import { useRestockOrder } from "@/hooks/orders/use-order-mutations";
import { notify } from "@/lib/toast";
import type { NcmDeliveryType } from "@/types/ncm.types";
import type { Order } from "@/types/order.types";
import { ShipToNcmModal } from "./ShipToNcmModal";
import { NcmStatusBadge } from "./status-badges";

interface NcmShipmentCardProps {
  order: Order;
  defaults: {
    fromBranch: string | null;
    deliveryType: NcmDeliveryType;
    codCharge: number;
  };
  can: { ship: boolean; manage: boolean; edit: boolean };
}

export function NcmShipmentCard({ order, defaults, can }: NcmShipmentCardProps) {
  const confirm = useConfirm();
  const [shipOpen, setShipOpen] = useState(false);
  const [comment, setComment] = useState("");

  const syncStatus = useSyncNcmStatus();
  const returnOrder = useReturnNcmOrder();
  const restock = useRestockOrder();
  const addComment = useAddNcmComment();
  const shipped = Boolean(order.ncmOrderId);
  const { data: comments = [] } = useNcmComments(order.id, shipped && can.ship);

  async function handleReturn() {
    const ok = await confirm({
      title: "Mark as returned",
      description:
        "This tells NCM to return the parcel and marks the order cancelled. Reserved stock is released only if it was not already delivered.",
      confirmLabel: "Mark returned",
      destructive: true,
    });
    if (!ok) return;
    returnOrder.mutate({ orderId: order.id });
  }

  async function handleRestock() {
    const ok = await confirm({
      title: "Restock items",
      description:
        "Add this order's quantities back into stock. Only do this if the delivered items physically came back.",
      confirmLabel: "Restock",
    });
    if (!ok) return;
    restock.mutate(order.id, {
      onSuccess: () => notify.success("Items restocked."),
    });
  }

  function handleAddComment() {
    if (!comment.trim()) return;
    addComment.mutate(
      { orderId: order.id, comment: comment.trim() },
      {
        onSuccess: () => {
          notify.success("Comment added.");
          setComment("");
        },
      },
    );
  }

  return (
    <div className="rounded-2xl border border-admin-border bg-admin-surface p-5">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold text-admin-text">
          <Truck className="h-4 w-4 text-admin-accent" />
          NCM Shipment
        </h2>
        <NcmStatusBadge status={order.ncmStatus} />
      </div>

      {shipped ? (
        <dl className="mb-4 space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-admin-text-muted">NCM order ID</dt>
            <dd className="font-bold text-admin-text">{order.ncmOrderId}</dd>
          </div>
          {order.ncmFromBranch && (
            <div className="flex justify-between">
              <dt className="text-admin-text-muted">From → To</dt>
              <dd className="font-semibold text-admin-text">
                {order.ncmFromBranch} → {order.ncmToBranch}
              </dd>
            </div>
          )}
          {order.ncmDeliveryType && (
            <div className="flex justify-between">
              <dt className="text-admin-text-muted">Delivery type</dt>
              <dd className="font-semibold text-admin-text">
                {order.ncmDeliveryType}
              </dd>
            </div>
          )}
        </dl>
      ) : (
        <p className="mb-4 text-sm text-admin-text-muted">
          This order has not been dispatched to NCM yet.
        </p>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {!shipped && can.ship && order.status !== "cancelled" && (
          <button
            type="button"
            onClick={() => setShipOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-admin-accent px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover"
          >
            <Truck className="h-4 w-4" /> Ship via NCM
          </button>
        )}
        {shipped && can.ship && (
          <button
            type="button"
            onClick={() => syncStatus.mutate(order.id)}
            disabled={syncStatus.isPending}
            className="flex items-center gap-2 rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-text transition-colors hover:bg-admin-card disabled:opacity-40"
          >
            <RefreshCw className={`h-4 w-4 ${syncStatus.isPending ? "animate-spin" : ""}`} />
            Sync status
          </button>
        )}
        {shipped && can.manage && order.status !== "cancelled" && (
          <button
            type="button"
            onClick={handleReturn}
            disabled={returnOrder.isPending}
            className="flex items-center gap-2 rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-danger transition-colors hover:bg-admin-danger/10 disabled:opacity-40"
          >
            <Undo2 className="h-4 w-4" /> Mark returned
          </button>
        )}
        {order.stockCommitted && can.edit && (
          <button
            type="button"
            onClick={handleRestock}
            disabled={restock.isPending}
            className="flex items-center gap-2 rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-text transition-colors hover:bg-admin-card disabled:opacity-40"
          >
            <RotateCcw className="h-4 w-4" /> Restock items
          </button>
        )}
      </div>

      {/* Comments */}
      {shipped && can.manage && (
        <div className="mt-5 border-t border-admin-border pt-4">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.1em] text-admin-text-muted">
            NCM comments
          </p>
          {comments.length > 0 && (
            <ul className="mb-3 space-y-2">
              {comments.map((c, i) => (
                <li
                  key={i}
                  className="rounded-lg bg-admin-card/40 px-3 py-2 text-xs text-admin-text"
                >
                  <p>{c.comments}</p>
                  <p className="mt-1 text-[10px] text-admin-text-muted">
                    {c.addedBy} · {c.addedTime}
                  </p>
                </li>
              ))}
            </ul>
          )}
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={2}
            placeholder="Add a comment for NCM…"
          />
          <button
            type="button"
            onClick={handleAddComment}
            disabled={addComment.isPending || !comment.trim()}
            className="mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-admin-accent transition-colors hover:bg-admin-accent/10 disabled:opacity-40"
          >
            <MessageSquarePlus className="h-3.5 w-3.5" /> Add comment
          </button>
        </div>
      )}

      {order.status === "delivered" && (
        <p className="mt-4 flex items-center gap-1.5 text-xs font-semibold text-admin-success">
          <PackageCheck className="h-4 w-4" /> Delivered, stock deducted.
        </p>
      )}

      {shipOpen && (
        <ShipToNcmModal
          open
          onClose={() => setShipOpen(false)}
          order={order}
          defaults={defaults}
        />
      )}
    </div>
  );
}
