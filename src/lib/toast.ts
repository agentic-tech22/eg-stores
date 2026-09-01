import toast, { type DefaultToastOptions } from "react-hot-toast";
import { getErrorMessage } from "@/lib/errors";

/**
 * Hex values mirror the static `--color-admin-*` design tokens from
 * `globals.css`. They are repeated here only because react-hot-toast styles its
 * toast container via an inline `style` object (which wins over Tailwind
 * classes), and those tokens are inlined by `@theme inline` so they are not
 * available as runtime CSS variables. Keep in sync with globals.css.
 */
const ADMIN = {
  surface: "#ffffff", // --admin-surface
  text: "#12141b", // --admin-text
  border: "#e3e6ef", // --admin-border
  success: "#059669", // --admin-success
  danger: "#dc2626", // --admin-danger
} as const;

/** Shared defaults for the global `<Toaster>` (see root layout). */
export const toasterOptions: DefaultToastOptions = {
  duration: 4000,
  style: {
    background: ADMIN.surface,
    color: ADMIN.text,
    border: `1px solid ${ADMIN.border}`,
    borderRadius: "0.75rem",
    fontSize: "14px",
    fontWeight: 500,
    padding: "12px 16px",
    maxWidth: "420px",
    boxShadow: "0 12px 32px -10px rgba(18, 20, 27, 0.22)",
  },
  success: {
    iconTheme: { primary: ADMIN.success, secondary: ADMIN.surface },
  },
  error: {
    duration: 5000,
    iconTheme: { primary: ADMIN.danger, secondary: ADMIN.surface },
  },
};

/**
 * Themed notification helpers. Prefer these over importing `react-hot-toast`
 * directly so styling stays consistent across the app.
 */
export const notify = {
  success: (message: string) => toast.success(message),
  error: (message: string) => toast.error(message),
  /**
   * Show an error toast from any thrown value, normalizing network/offline
   * failures into a friendly "no internet connection" message. Prefer this in
   * `onError` handlers over `error(err.message)` so offline errors read well.
   */
  fromError: (error: unknown) => toast.error(getErrorMessage(error)),
  loading: (message: string) => toast.loading(message),
  dismiss: (id?: string) => toast.dismiss(id),
  /** Drives loading → success/error states off a promise. */
  promise: <T>(
    promise: Promise<T>,
    messages: { loading: string; success: string; error: string },
  ) => toast.promise(promise, messages),
};
