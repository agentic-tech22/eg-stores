/**
 * Central error-message normalizer. Turns raw fetch/Supabase failures (most
 * importantly a dropped internet connection) into short, human messages so the
 * UI never surfaces a cryptic "TypeError: Failed to fetch". Kept dependency-free
 * (no imports) so it is safe to use from both client and server code.
 */

/** Copy shown whenever the failure looks like a lost/absent network connection. */
export const OFFLINE_MESSAGE =
  "No internet connection. Please check your network and try again.";

/** Generic fallback when we can't extract anything more specific. */
export const GENERIC_MESSAGE = "Something went wrong. Please try again.";

/** True when the browser currently reports itself as offline. SSR-safe. */
export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Heuristic: does this error stem from the network being unreachable? Covers the
 * browser being offline plus the assorted "failed to fetch" strings different
 * engines throw when a request can't leave the machine.
 */
export function isNetworkError(error: unknown): boolean {
  if (isOffline()) return true;
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";
  return /failed to fetch|network\s?error|networkerror|load failed|fetch failed|err_internet_disconnected|internet connection appears to be offline/i.test(
    message,
  );
}

/**
 * Friendly, display-ready message for any thrown value. A network/offline
 * failure collapses to {@link OFFLINE_MESSAGE}; otherwise we surface the error's
 * own message, falling back to a generic line.
 */
export function getErrorMessage(error: unknown): string {
  if (isNetworkError(error)) return OFFLINE_MESSAGE;
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string" && error) return error;
  return GENERIC_MESSAGE;
}
