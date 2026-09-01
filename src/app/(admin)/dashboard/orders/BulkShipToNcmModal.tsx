"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/molecules/modal/Modal";
import { Field, Select, TextInput, Textarea } from "@/components/molecules/form";
import { useConfirm } from "@/components/molecules/confirm-dialog/confirm-context";
import {
  useBulkShipToNcm,
  useNcmBranches,
} from "@/hooks/ncm/use-ncm-shipment";
import { notify } from "@/lib/toast";
import type { NcmDeliveryType } from "@/types/ncm.types";
import type { Order } from "@/types/order.types";

const DELIVERY_TYPES: NcmDeliveryType[] = [
  "Door2Door",
  "Branch2Door",
  "D2B",
  "B2B",
];

interface BulkShipToNcmModalProps {
  open: boolean;
  onClose: () => void;
  /** The orders the user selected in the table. */
  orders: Order[];
  /** Called after a dispatch attempt so the table can clear its selection. */
  onShipped: () => void;
  defaults: {
    fromBranch: string | null;
    deliveryType: NcmDeliveryType;
    codCharge: number;
  };
}

/** Why an order can't be shipped, for the skipped list. */
function ineligibleReason(order: Order): string | null {
  if (order.ncmOrderId) return "Already shipped to NCM";
  if (order.status === "cancelled") return "Order is cancelled";
  return null;
}

export function BulkShipToNcmModal({
  open,
  onClose,
  orders,
  onShipped,
  defaults,
}: BulkShipToNcmModalProps) {
  const { data: branches = [], isFetching } = useNcmBranches(open);
  const bulkShip = useBulkShipToNcm();
  const confirm = useConfirm();

  // Split the selection into orders we can ship and ones we'll skip, so the
  // user sees exactly what the action will (and won't) touch before confirming.
  const { eligible, skipped } = useMemo(() => {
    const eligible: Order[] = [];
    const skipped: { order: Order; reason: string }[] = [];
    for (const o of orders) {
      const reason = ineligibleReason(o);
      if (reason) skipped.push({ order: o, reason });
      else eligible.push(o);
    }
    return { eligible, skipped };
  }, [orders]);

  const [fromBranch, setFromBranch] = useState(defaults.fromBranch ?? "");
  const [deliveryType, setDeliveryType] = useState<NcmDeliveryType>(
    defaults.deliveryType,
  );
  const [weight, setWeight] = useState("1");
  const [instruction, setInstruction] = useState("");
  // Per-order destination branch, keyed by order id.
  const [destinations, setDestinations] = useState<Record<string, string>>({});

  function setDestination(orderId: string, branch: string) {
    setDestinations((prev) => ({ ...prev, [orderId]: branch }));
  }

  function applyDestinationToAll(branch: string) {
    if (!branch) return;
    setDestinations(() =>
      Object.fromEntries(eligible.map((o) => [o.id, branch])),
    );
  }

  async function handleSubmit() {
    if (eligible.length === 0) {
      notify.error("None of the selected orders can be shipped.");
      return;
    }
    if (!fromBranch) {
      notify.error("Select a pickup branch.");
      return;
    }
    const wt = parseFloat(weight);
    if (Number.isNaN(wt) || wt <= 0) {
      notify.error("Enter a valid weight.");
      return;
    }
    const missingDest = eligible.filter((o) => !destinations[o.id]);
    if (missingDest.length > 0) {
      notify.error(
        `Pick a destination branch for ${missingDest.length} order(s).`,
      );
      return;
    }

    const ok = await confirm({
      title: "Dispatch to NCM?",
      description: `${eligible.length} order(s) will be shipped via NCM and marked as shipped.${
        skipped.length ? ` ${skipped.length} order(s) will be skipped.` : ""
      } This can't be undone.`,
      confirmLabel: `Ship ${eligible.length} order${eligible.length > 1 ? "s" : ""}`,
    });
    if (!ok) return;

    bulkShip.mutate(
      {
        items: eligible.map((o) => ({
          orderId: o.id,
          toBranch: destinations[o.id],
          // Mirror the single-order modal: COD defaults to the order total.
          codCharge: o.total || defaults.codCharge || 0,
        })),
        shared: {
          fromBranch,
          deliveryType,
          weight: wt,
          instruction: instruction || undefined,
        },
      },
      {
        onSuccess: (data) => {
          const shipped = data.shipped ?? 0;
          const failed = data.failed ?? 0;
          if (failed === 0) {
            notify.success(`${shipped} order(s) dispatched to NCM.`);
          } else if (shipped === 0) {
            notify.error(`Failed to dispatch ${failed} order(s).`);
          } else {
            notify.success(`${shipped} shipped, ${failed} failed.`);
          }
          const firstError = data.results?.find((r) => !r.success)?.error;
          if (failed > 0 && firstError) notify.error(firstError);
          onShipped();
          onClose();
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next && !bulkShip.isPending) onClose();
      }}
      size="lg"
      title="Ship orders via NCM"
      description={`Dispatch ${eligible.length} selected order${
        eligible.length === 1 ? "" : "s"
      } to NCM in one go.`}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={bulkShip.isPending}
            className="rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-text-secondary transition-colors hover:bg-admin-card disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={bulkShip.isPending || eligible.length === 0}
            className="rounded-xl bg-admin-accent px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover disabled:opacity-40"
          >
            {bulkShip.isPending
              ? "Shipping..."
              : `Ship ${eligible.length} order${eligible.length === 1 ? "" : "s"}`}
          </button>
        </>
      }
    >
      {branches.length === 0 && !isFetching && (
        <p className="mb-4 rounded-lg bg-admin-warning/10 px-3 py-2 text-xs text-admin-warning">
          No NCM branches cached yet. Refresh the branch list from the NCM
          settings page first.
        </p>
      )}

      {skipped.length > 0 && (
        <div className="mb-4 rounded-xl border border-admin-border bg-admin-card/40 px-4 py-3">
          <p className="text-xs font-bold text-admin-text-secondary">
            {skipped.length} order{skipped.length === 1 ? "" : "s"} will be
            skipped
          </p>
          <ul className="mt-1.5 space-y-1">
            {skipped.map(({ order, reason }) => (
              <li key={order.id} className="text-[11px] text-admin-text-muted">
                #{order.orderNumber} · {order.customerName}: {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Shared shipment fields */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Pickup branch" required>
          {(p) => (
            <Select
              value={fromBranch}
              onChange={(e) => setFromBranch(e.target.value)}
              {...p}
            >
              <option value="">Select…</option>
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                  {b.district ? `, ${b.district}` : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Delivery type">
          {(p) => (
            <Select
              value={deliveryType}
              onChange={(e) => setDeliveryType(e.target.value as NcmDeliveryType)}
              {...p}
            >
              {DELIVERY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Weight (kg)" required hint="Applied to every order.">
          {(p) => (
            <TextInput
              type="number"
              step="0.1"
              min="0.1"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              {...p}
            />
          )}
        </Field>
        <Field
          label="Destination for all"
          hint="Quickly set the same destination on every order below."
        >
          {(p) => (
            <Select
              value=""
              onChange={(e) => applyDestinationToAll(e.target.value)}
              {...p}
            >
              <option value="">Apply to all…</option>
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                  {b.district ? `, ${b.district}` : ""}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <Field label="Instruction" className="sm:col-span-2">
          {(p) => (
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={2}
              placeholder="Optional delivery instruction (applied to all)"
              {...p}
            />
          )}
        </Field>
      </div>

      {/* Per-order destination + COD */}
      {eligible.length > 0 && (
        <div className="mt-5">
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">
            Destination per order
          </p>
          <div className="divide-y divide-admin-border overflow-hidden rounded-xl border border-admin-border">
            {eligible.map((order) => (
              <div
                key={order.id}
                className="grid grid-cols-1 gap-2 px-4 py-3 sm:grid-cols-12 sm:items-center sm:gap-3"
              >
                <div className="min-w-0 sm:col-span-6">
                  <p className="truncate text-sm font-semibold text-admin-text">
                    #{order.orderNumber} · {order.customerName}
                  </p>
                  <p className="truncate text-[11px] text-admin-text-muted">
                    {order.customerAddress || "No address"}
                  </p>
                </div>
                <div className="sm:col-span-6">
                  <Select
                    aria-label={`Destination branch for order #${order.orderNumber}`}
                    value={destinations[order.id] ?? ""}
                    onChange={(e) => setDestination(order.id, e.target.value)}
                  >
                    <option value="">Destination branch…</option>
                    {branches.map((b) => (
                      <option key={b.name} value={b.name}>
                        {b.name}
                        {b.district ? `, ${b.district}` : ""}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}
