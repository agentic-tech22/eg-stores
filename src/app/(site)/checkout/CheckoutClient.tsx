"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Banknote,
  CheckCircle2,
  Minus,
  Pencil,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  Wallet,
} from "lucide-react";
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import { cartItemKey, useCart } from "@/components/cart/cart-context";
import { EsewaPaymentButton } from "@/components/payment/EsewaPaymentButton";
import {
  placePublicOrder,
  fetchOrderSummary,
  type OrderSummary,
} from "@/services/order.service";
import type { EsewaCheckoutInput } from "@/lib/esewa/actions";
import { notify } from "@/lib/toast";
import { formatCurrency } from "@/utils/format-currency";

interface CheckoutClientProps {
  currency: { code: string; locale: string };
}

type PaymentMethod = "cod" | "esewa";

export function CheckoutClient({ currency }: CheckoutClientProps) {
  const { items, subtotal, clear, updateQuantity, removeItem } = useCart();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState<{ orderId: string } | null>(null);
  const [summary, setSummary] = useState<OrderSummary | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("cod");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [phone2, setPhone2] = useState("");
  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  // Surface required-field errors only after a submit attempt, so the form
  // doesn't shout at the shopper before they've had a chance to fill it in.
  const [triedSubmit, setTriedSubmit] = useState(false);

  const money = (n: number) => formatCurrency(n, currency.code, currency.locale);

  const errors = {
    name: !name.trim() ? "Please enter your full name." : "",
    phone: !phone.trim()
      ? "Please enter a phone number."
      : !/^[0-9+\-\s]{7,}$/.test(phone.trim())
        ? "Please enter a valid phone number."
        : "",
    address: !address.trim() ? "Please enter a delivery address." : "",
  };
  const showError = (field: keyof typeof errors) => triedSubmit && errors[field];
  const fieldClass = (field: keyof typeof errors) =>
    `w-full rounded-xl border bg-background/60 px-4 py-3 text-text-primary focus:outline-none ${
      showError(field)
        ? "border-red-400 focus:border-red-400"
        : "border-border/50 focus:border-secondary"
    }`;

  // Handle the redirect back from the eSewa callback (success/failed/cancelled).
  // Runs once: clears the cart + shows confirmation on success, surfaces a toast
  // otherwise, then strips the status params from the URL.
  const handledReturn = useRef(false);
  useEffect(() => {
    if (handledReturn.current) return;
    const status = searchParams.get("status");
    if (!status) return;
    handledReturn.current = true;

    if (status === "success") {
      const orderId = searchParams.get("order") ?? "";
      clear();
      // eslint-disable-next-line react-hooks/set-state-in-effect -- react to the eSewa redirect (external navigation)
      setDone({ orderId });
    } else {
      notify.error(searchParams.get("message") || "Payment was not completed.");
    }
    router.replace("/checkout");
  }, [searchParams, clear, router]);

  // Once an order is placed (COD submit or eSewa return), load its details so
  // the confirmation screen can show the order number, items, and totals.
  useEffect(() => {
    if (!done?.orderId) return;
    let active = true;
    void fetchOrderSummary(done.orderId).then((s) => {
      if (active) setSummary(s);
    });
    return () => {
      active = false;
    };
  }, [done?.orderId]);

  /** Validate the form + cart and assemble the order payload, or null if invalid. */
  function buildCheckoutInput(): EsewaCheckoutInput | null {
    if (errors.name || errors.phone || errors.address) {
      setTriedSubmit(true);
      notify.error("Please fix the highlighted fields.");
      return null;
    }
    if (items.length === 0) {
      notify.error("Your cart is empty.");
      return null;
    }
    return {
      customerName: name,
      customerPhone: phone,
      customerPhone2: phone2 || null,
      customerAddress: address,
      notes: notes || null,
      items: items.map((i) => ({
        productId: i.productId,
        productVariantId: i.productVariantId,
        quantity: i.quantity,
      })),
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = buildCheckoutInput();
    if (!input) return;

    startTransition(async () => {
      const result = await placePublicOrder(input);

      if (!result.success || !result.orderId) {
        notify.error(result.error ?? "Could not place your order.");
        return;
      }
      clear();
      setDone({ orderId: result.orderId });
    });
  }

  if (done) {
    const paid = summary?.paymentStatus === "paid";
    return (
      <Container size="md" className="py-24">
        <div className="mx-auto max-w-lg text-center">
          <CheckCircle2 className="mx-auto mb-6 h-16 w-16 text-secondary" />
          <Typography variant="h2" className="mb-3 italic">
            {paid ? "Payment successful!" : "Order placed!"}
          </Typography>
          <Typography variant="bodyLarge" className="mb-8 text-text-secondary">
            Thank you{summary?.customerName ? `, ${summary.customerName}` : ""}, we&rsquo;ve
            received your order and will be in touch shortly.
          </Typography>
        </div>

        {summary ? (
          <div className="mx-auto max-w-lg rounded-2xl border border-border/50 bg-surface/50 p-6 text-left">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <Typography variant="bodySmall" className="text-text-secondary">
                  Order
                </Typography>
                <Typography variant="h4">#{summary.orderNumber}</Typography>
              </div>
              <span
                className={`rounded-full px-3 py-1 text-sm font-semibold ${
                  paid
                    ? "bg-secondary/5 text-secondary"
                    : "bg-background/60 text-text-secondary"
                }`}
              >
                {paid ? "Paid · eSewa" : "Pay on delivery"}
              </span>
            </div>

            <ul className="divide-y divide-border/30 border-y border-border/30">
              {summary.items.map((it, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-3 py-3 text-sm"
                >
                  <span className="text-text-primary">
                    {it.quantity} × {it.title}
                    {it.variantLabel ? (
                      <span className="text-text-secondary"> ({it.variantLabel})</span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-medium text-text-primary">
                    {money(it.lineTotal)}
                  </span>
                </li>
              ))}
            </ul>

            <dl className="mt-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-text-secondary">
                <dt>Subtotal</dt>
                <dd>{money(summary.subtotal)}</dd>
              </div>
              {summary.codCharge > 0 ? (
                <div className="flex justify-between text-text-secondary">
                  <dt>Delivery (COD)</dt>
                  <dd>{money(summary.codCharge)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between border-t border-border/50 pt-2 text-base font-bold text-text-primary">
                <dt>Total</dt>
                <dd>{money(summary.total)}</dd>
              </div>
            </dl>
          </div>
        ) : (
          <div className="mx-auto max-w-lg rounded-2xl border border-border/30 bg-surface/50 p-6 text-center text-sm text-text-secondary">
            Loading your order details…
          </div>
        )}

        <div className="mt-8 text-center">
          <Link
            href="/products"
            className="inline-flex rounded-full bg-secondary px-8 py-3 font-bold text-white transition-colors hover:bg-primary"
          >
            Continue shopping
          </Link>
        </div>
      </Container>
    );
  }

  if (items.length === 0) {
    return (
      <Container size="md" className="py-24 text-center">
        <ShoppingBag className="mx-auto mb-6 h-16 w-16 text-text-secondary/30" />
        <Typography variant="h2" className="mb-3 italic">
          Nothing to check out
        </Typography>
        <Link
          href="/products"
          className="mt-6 inline-flex rounded-full bg-secondary px-8 py-3 font-bold text-white transition-colors hover:bg-primary"
        >
          Shop products
        </Link>
      </Container>
    );
  }

  return (
    <Container size="md" className="py-16">
      <Typography variant="h1" className="mb-8 italic">
        Checkout
      </Typography>

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-5">
        {/* Form */}
        <form onSubmit={handleSubmit} noValidate className="space-y-5 lg:col-span-3">
          <div>
            <Typography variant="label" className="mb-3 block tracking-widest text-secondary">
              Delivery details
            </Typography>
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-text-primary">
                  Full name *
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  aria-invalid={Boolean(showError("name"))}
                  className={fieldClass("name")}
                  placeholder="Jane Doe"
                />
                {showError("name") && (
                  <p className="mt-1 text-xs font-medium text-red-500">{errors.name}</p>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-text-primary">
                    Phone *
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    aria-invalid={Boolean(showError("phone"))}
                    className={fieldClass("phone")}
                    placeholder="98XXXXXXXX"
                  />
                  {showError("phone") && (
                    <p className="mt-1 text-xs font-medium text-red-500">{errors.phone}</p>
                  )}
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-text-primary">
                    Alternate phone
                  </label>
                  <input
                    type="tel"
                    inputMode="tel"
                    value={phone2}
                    onChange={(e) => setPhone2(e.target.value)}
                    autoComplete="tel"
                    className="w-full rounded-xl border border-border/50 bg-background/60 px-4 py-3 text-text-primary focus:border-secondary focus:outline-none"
                    placeholder="Optional"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-text-primary">
                  Delivery address *
                </label>
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={3}
                  autoComplete="street-address"
                  aria-invalid={Boolean(showError("address"))}
                  className={fieldClass("address")}
                  placeholder="Street, city, landmark"
                />
                {showError("address") && (
                  <p className="mt-1 text-xs font-medium text-red-500">{errors.address}</p>
                )}
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-text-primary">
                  Notes <span className="font-normal text-text-secondary">(optional)</span>
                </label>
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full rounded-xl border border-border/50 bg-background/60 px-4 py-3 text-text-primary focus:border-secondary focus:outline-none"
                  placeholder="Landmark, delivery time, anything we should know"
                />
              </div>
            </div>
          </div>

          {/* Payment method */}
          <fieldset className="pt-1">
            <legend className="mb-3 block text-xs font-semibold uppercase tracking-widest text-secondary">
              Payment method
            </legend>
            <div className="space-y-2">
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  paymentMethod === "cod"
                    ? "border-secondary bg-secondary/5"
                    : "border-border/50 bg-background/60 hover:border-secondary/40"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="cod"
                  checked={paymentMethod === "cod"}
                  onChange={() => setPaymentMethod("cod")}
                  className="mt-0.5 accent-secondary"
                />
                <span className="flex items-start gap-2.5">
                  <Banknote className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                  <span>
                    <span className="block text-sm font-semibold text-text-primary">
                      Cash on delivery
                    </span>
                    <span className="block text-xs text-text-secondary">
                      Pay with cash when your order arrives.
                    </span>
                  </span>
                </span>
              </label>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 transition-colors ${
                  paymentMethod === "esewa"
                    ? "border-secondary bg-secondary/5"
                    : "border-border/50 bg-background/60 hover:border-secondary/40"
                }`}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="esewa"
                  checked={paymentMethod === "esewa"}
                  onChange={() => setPaymentMethod("esewa")}
                  className="mt-0.5 accent-secondary"
                />
                <span className="flex items-start gap-2.5">
                  <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
                  <span>
                    <span className="block text-sm font-semibold text-text-primary">
                      Pay online with eSewa
                    </span>
                    <span className="block text-xs text-text-secondary">
                      Secure online payment, confirmed instantly.
                    </span>
                  </span>
                </span>
              </label>
            </div>
          </fieldset>

          {paymentMethod === "cod" ? (
            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-full bg-secondary px-8 py-3.5 font-bold text-white shadow-lg transition-colors hover:bg-primary disabled:opacity-50"
            >
              {pending ? "Placing order…" : "Place order"}
            </button>
          ) : (
            <EsewaPaymentButton
              getInput={buildCheckoutInput}
              amountLabel={money(subtotal)}
              disabled={pending}
            />
          )}
        </form>

        {/* Summary */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-border/30 bg-surface/50 p-5 lg:sticky lg:top-24">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-bold text-text-primary">Order summary</h2>
              <Link
                href="/cart"
                className="inline-flex items-center gap-1 text-xs font-semibold text-secondary transition-colors hover:text-primary"
              >
                <Pencil className="h-3 w-3" /> Edit cart
              </Link>
            </div>
            <ul className="space-y-3">
              {items.map((item) => {
                const key = cartItemKey(item.productId, item.productVariantId);
                const atMax =
                  item.available !== undefined && item.quantity >= item.available;
                return (
                  <li key={key} className="flex gap-3">
                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-background">
                      {item.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={item.imageUrl} alt={item.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-text-secondary/30">
                          <ShoppingBag className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-text-primary">
                        {item.title}
                      </p>
                      {item.variantLabel && (
                        <p className="truncate text-xs text-text-secondary">{item.variantLabel}</p>
                      )}
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1 rounded-full border border-border/50 bg-background/60">
                          <button
                            type="button"
                            onClick={() => updateQuantity(key, item.quantity - 1)}
                            aria-label="Decrease quantity"
                            className="flex h-6 w-6 items-center justify-center rounded-full text-text-secondary transition-colors hover:text-secondary"
                          >
                            <Minus className="h-3 w-3" />
                          </button>
                          <span className="w-5 text-center text-xs font-bold text-text-primary">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => updateQuantity(key, item.quantity + 1)}
                            disabled={atMax}
                            aria-label="Increase quantity"
                            className="flex h-6 w-6 items-center justify-center rounded-full text-text-secondary transition-colors hover:text-secondary disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <span className="text-sm font-semibold text-text-primary">
                          {money(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(key)}
                      aria-label={`Remove ${item.title}`}
                      className="self-start text-text-secondary/40 transition-colors hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="mt-4 flex justify-between border-t border-border/30 pt-4 text-base font-extrabold text-text-primary">
              <span>Subtotal</span>
              <span>{money(subtotal)}</span>
            </div>
            <p className="mt-2 text-xs text-text-secondary">
              {paymentMethod === "esewa"
                ? "Pay securely online with eSewa. Courier charges are confirmed when your order ships."
                : "Pay on delivery. Courier charges are confirmed when your order ships."}
            </p>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-text-secondary/80">
              <ShieldCheck className="h-3.5 w-3.5 text-secondary" /> Your details are kept private and secure.
            </p>
          </div>
        </div>
      </div>
    </Container>
  );
}
