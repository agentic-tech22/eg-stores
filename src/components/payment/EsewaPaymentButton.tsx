"use client";

import { useState } from "react";
import {
  initiateEsewaCheckout,
  type EsewaCheckoutInput,
} from "@/lib/esewa/actions";
import type { EsewaFormData } from "@/lib/esewa/config";
import { notify } from "@/lib/toast";

interface EsewaPaymentButtonProps {
  /** Builds the checkout payload at click time (lets the parent validate first). */
  getInput: () => EsewaCheckoutInput | null;
  /** Formatted amount shown on the button, e.g. "Rs. 1,200". */
  amountLabel: string;
  disabled?: boolean;
}

/**
 * POST the signed eSewa payload to the gateway by building a detached form and
 * submitting it imperatively. The eSewa gateway only accepts POST, so we must
 * not render a `<form>` in JSX here: this component is used inside the checkout
 * `<form>`, and nested forms are invalid HTML (the browser drops/mis-associates
 * the inner form and the submission can degrade to a GET → 405 Method Not
 * Allowed). Appending a top-level form to `document.body` avoids that entirely.
 */
function postToEsewa(gatewayUrl: string, formData: EsewaFormData) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = gatewayUrl;
  form.style.display = "none";

  for (const [name, value] of Object.entries(formData)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  document.body.appendChild(form);
  form.submit();
}

export function EsewaPaymentButton({
  getInput,
  amountLabel,
  disabled = false,
}: EsewaPaymentButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  async function handlePayment() {
    const input = getInput();
    if (!input) return; // parent surfaced a validation error

    setIsProcessing(true);
    try {
      const result = await initiateEsewaCheckout(input);
      if (!result.success || !result.data) {
        throw new Error(result.error || "Failed to start payment.");
      }
      // Redirects the browser to eSewa; keep the spinner up until navigation.
      postToEsewa(result.data.gatewayUrl, result.data.formData);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : "Failed to start payment.");
      setIsProcessing(false);
    }
  }

  const isDisabled = disabled || isProcessing;

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={handlePayment}
      className={`flex w-full items-center justify-center gap-2 rounded-full px-8 py-3.5 font-bold text-white shadow-lg transition-colors ${
        isDisabled
          ? "cursor-not-allowed bg-neutral-400"
          : "bg-[#60BB46] hover:bg-[#4fa93a]"
      }`}
    >
      {isProcessing ? (
        <>
          <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Redirecting to eSewa…</span>
        </>
      ) : (
        <span>Pay with eSewa · {amountLabel}</span>
      )}
    </button>
  );
}
