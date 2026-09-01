"use client";

import { useSyncExternalStore } from "react";

/** Subscribe to the browser's connectivity changes. */
function subscribe(callback: () => void): () => void {
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

/**
 * Reactive connectivity flag driven by the browser's `online`/`offline` events.
 * Returns `true` while the browser reports a live connection. During SSR (and
 * the very first client render) it assumes online so the UI never flashes an
 * offline state on hydration.
 */
export function useOnline(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => navigator.onLine,
    () => true,
  );
}
