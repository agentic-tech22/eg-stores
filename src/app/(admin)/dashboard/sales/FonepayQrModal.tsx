"use client";

import { useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/molecules/admin";
import { Modal } from "@/components/molecules/modal/Modal";
import {
  cancelPendingFonepaySale,
  checkFonepaySaleStatus,
  initiateFonepayQr,
} from "@/lib/fonepay/actions";
import { queryKeys } from "@/lib/react-query/keys";
import { notify } from "@/lib/toast";
import { formatCurrency } from "@/utils/format-currency";

interface FonepayQrModalProps {
  /** The pending Fonepay sale to collect payment for. */
  saleId: string;
  currency: { code: string; locale: string };
  /** Payment confirmed: the sale is now paid (parent finalizes + invoices it). */
  onPaid: () => void;
  /** Payment cancelled: the pending sale was deleted and stock restored. */
  onCancelled: () => void;
}

/**
 * Collects a Fonepay dynamic-QR payment for a pending sale: generates the QR,
 * renders it, and polls Fonepay every few seconds until the payment succeeds
 * (then flips the sale to paid) or the cashier cancels (deleting the pending
 * sale and restoring stock).
 */
export function FonepayQrModal({
  saleId,
  currency,
  onPaid,
  onCancelled,
}: FonepayQrModalProps) {
  const queryClient = useQueryClient();

  // Generate the QR once when the modal opens.
  const qrQuery = useQuery({
    queryKey: ["fonepay-qr", saleId],
    queryFn: async () => {
      const r = await initiateFonepayQr(saleId);
      if (!r.success) throw new Error(r.error ?? "Could not generate the QR.");
      return r;
    },
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const prn = qrQuery.data?.prn;
  const amount = qrQuery.data?.amount ?? 0;

  // Poll Fonepay for the payment result while the QR is displayed and unpaid.
  const statusQuery = useQuery({
    queryKey: ["fonepay-status", prn],
    queryFn: async () => {
      const r = await checkFonepaySaleStatus(prn!);
      if (!r.success) throw new Error(r.error ?? "Could not check status.");
      return r.status;
    },
    enabled: Boolean(prn),
    // Stop polling once paid; keep polling (every 3s) while pending/failed.
    refetchInterval: (query) => (query.state.data === "paid" ? false : 3000),
    refetchOnWindowFocus: false,
  });

  const status = statusQuery.data;
  const paid = status === "paid";

  // On the first confirmed success, notify and hand back to the parent, which
  // finalizes the sale (invoice generation + preview) uniformly across all
  // payment methods. Guarded by a ref so it fires exactly once.
  const settledRef = useRef(false);
  useEffect(() => {
    if (paid && !settledRef.current) {
      settledRef.current = true;
      queryClient.invalidateQueries({ queryKey: queryKeys.sales.all });
      notify.success("Fonepay payment received.");
      onPaid();
    }
  }, [paid, queryClient, onPaid]);

  const cancel = useMutation({
    mutationFn: async () => {
      const r = await cancelPendingFonepaySale(saleId);
      if (!r.success) throw new Error(r.error ?? "Could not cancel.");
      return r;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.sales.all });
      notify.success("Payment cancelled and stock restored.");
      onCancelled();
    },
    onError: (err: Error) => notify.error(err.message),
  });

  const money = (n: number) => formatCurrency(n, currency.code, currency.locale);

  return (
    <Modal
      open
      // While pending, the modal is not dismissible: the cashier must either
      // complete or cancel the payment (both fire an explicit callback).
      onOpenChange={() => {}}
      size="sm"
      title="Fonepay payment"
      description={
        paid
          ? "Payment received."
          : "Ask the customer to scan this QR with any Fonepay or mobile-banking app."
      }
      footer={
        !paid && (
          <Button
            variant="secondary"
            onClick={() => cancel.mutate()}
            loading={cancel.isPending}
          >
            Cancel payment
          </Button>
        )
      }
    >
      <div className="flex flex-col items-center gap-4 py-2 text-center">
        <div className="text-2xl font-extrabold text-admin-text">
          {money(amount)}
        </div>

        {qrQuery.isPending && (
          <div className="flex h-60 w-60 items-center justify-center rounded-xl border border-admin-border">
            <Loader2 className="h-8 w-8 animate-spin text-admin-accent" />
          </div>
        )}

        {qrQuery.isError && (
          <div className="flex flex-col items-center gap-3">
            <XCircle className="h-10 w-10 text-admin-danger" />
            <p className="text-sm text-admin-danger">
              {(qrQuery.error as Error).message}
            </p>
            <Button variant="secondary" onClick={() => qrQuery.refetch()}>
              Try again
            </Button>
          </div>
        )}

        {qrQuery.data && !paid && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={qrQuery.data.qrDataUrl}
            alt="Fonepay payment QR code"
            width={240}
            height={240}
            className="rounded-xl border border-admin-border"
          />
        )}

        {paid ? (
          <div className="flex items-center gap-2 text-admin-success">
            <CheckCircle2 className="h-5 w-5" />
            <span className="text-sm font-bold">Payment successful</span>
          </div>
        ) : (
          qrQuery.data && (
            <div className="flex items-center gap-2 text-admin-text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">Waiting for payment…</span>
            </div>
          )
        )}
      </div>
    </Modal>
  );
}
