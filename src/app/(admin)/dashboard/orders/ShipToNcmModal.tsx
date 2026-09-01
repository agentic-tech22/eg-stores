"use client";

import { useState } from "react";
import { Modal } from "@/components/molecules/modal/Modal";
import { Field, Select, TextInput, Textarea } from "@/components/molecules/form";
import {
  useNcmBranches,
  useShipToNcm,
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

interface ShipToNcmModalProps {
  open: boolean;
  onClose: () => void;
  order: Order;
  defaults: {
    fromBranch: string | null;
    deliveryType: NcmDeliveryType;
    codCharge: number;
  };
}

export function ShipToNcmModal({
  open,
  onClose,
  order,
  defaults,
}: ShipToNcmModalProps) {
  const { data: branches = [], isFetching } = useNcmBranches(open);
  const shipToNcm = useShipToNcm();

  const [fromBranch, setFromBranch] = useState(defaults.fromBranch ?? "");
  const [toBranch, setToBranch] = useState("");
  const [deliveryType, setDeliveryType] = useState<NcmDeliveryType>(
    defaults.deliveryType,
  );
  const [codCharge, setCodCharge] = useState(
    String(order.total || defaults.codCharge || 0),
  );
  const [weight, setWeight] = useState("1");
  const [instruction, setInstruction] = useState("");

  function handleSubmit() {
    if (!fromBranch || !toBranch) {
      notify.error("Select both a pickup and a destination branch.");
      return;
    }
    const cod = parseFloat(codCharge);
    const wt = parseFloat(weight);
    if (Number.isNaN(cod) || cod < 0) {
      notify.error("Enter a valid COD amount.");
      return;
    }
    if (Number.isNaN(wt) || wt <= 0) {
      notify.error("Enter a valid weight.");
      return;
    }

    shipToNcm.mutate(
      {
        orderId: order.id,
        opts: {
          fromBranch,
          toBranch,
          deliveryType,
          codCharge: cod,
          weight: wt,
          instruction: instruction || undefined,
        },
      },
      {
        onSuccess: () => {
          notify.success("Order dispatched to NCM.");
          onClose();
        },
      },
    );
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next && !shipToNcm.isPending) onClose();
      }}
      size="md"
      title="Ship via NCM"
      description={`Create an NCM shipment for order #${order.orderNumber}.`}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={shipToNcm.isPending}
            className="rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-text-secondary transition-colors hover:bg-admin-card disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={shipToNcm.isPending}
            className="rounded-xl bg-admin-accent px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover disabled:opacity-40"
          >
            {shipToNcm.isPending ? "Shipping..." : "Create shipment"}
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
        <Field label="Destination branch" required>
          {(p) => (
            <Select
              value={toBranch}
              onChange={(e) => setToBranch(e.target.value)}
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
        <Field label="Weight (kg)" required>
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
        <Field label="COD amount" required>
          {(p) => (
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={codCharge}
              onChange={(e) => setCodCharge(e.target.value)}
              {...p}
            />
          )}
        </Field>
        <Field label="Instruction" className="sm:col-span-2">
          {(p) => (
            <Textarea
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              rows={2}
              placeholder="Optional delivery instruction"
              {...p}
            />
          )}
        </Field>
      </div>
    </Modal>
  );
}
