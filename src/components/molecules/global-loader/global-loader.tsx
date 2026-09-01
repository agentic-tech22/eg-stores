"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname } from "next/navigation";
import { cn } from "@/utils/cn";

/**
 * Imperative control over the app-wide loading overlay. `start()` returns a
 * `stop` function so callers can pair them like `const stop = start(); …; stop()`.
 * `run(promise)` is the convenience wrapper for async actions: it shows the
 * loader for the lifetime of the promise and always hides it (even on error).
 */
interface GlobalLoaderApi {
  start: (message?: string) => () => void;
  stop: () => void;
  run: <T>(promise: Promise<T>, message?: string) => Promise<T>;
  isLoading: boolean;
}

const GlobalLoaderContext = createContext<GlobalLoaderApi | null>(null);

// Wait this long before showing the overlay on a route change. Prefetched /
// fast navigations finish first and never flash the loader; only slower
// transitions reveal it, keeping the experience smooth rather than jumpy.
const NAV_SHOW_DELAY_MS = 140;

// Safety net: if a navigation never resolves (cancelled download, blocked nav),
// auto-clear the nav loader so it can't get stuck on screen.
const NAV_SAFETY_TIMEOUT_MS = 8000;

export function GlobalLoaderProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Manual loading (actions) is reference-counted so concurrent calls stack and
  // the overlay only hides once the last one finishes. Navigation loading is a
  // separate boolean driven by link clicks + pathname changes.
  const [manualCount, setManualCount] = useState(0);
  const [navActive, setNavActive] = useState(false);
  const [message, setMessage] = useState<string | undefined>(undefined);

  const navShowTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navSafetyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearNavTimers = useCallback(() => {
    if (navShowTimer.current) clearTimeout(navShowTimer.current);
    if (navSafetyTimer.current) clearTimeout(navSafetyTimer.current);
    navShowTimer.current = null;
    navSafetyTimer.current = null;
  }, []);

  const start = useCallback((msg?: string) => {
    setMessage(msg);
    setManualCount((n) => n + 1);
    let stopped = false;
    return () => {
      if (stopped) return;
      stopped = true;
      setManualCount((n) => Math.max(n - 1, 0));
    };
  }, []);

  const stop = useCallback(() => {
    setManualCount((n) => Math.max(n - 1, 0));
  }, []);

  const run = useCallback(
    async <T,>(promise: Promise<T>, msg?: string): Promise<T> => {
      setMessage(msg);
      setManualCount((n) => n + 1);
      try {
        return await promise;
      } finally {
        setManualCount((n) => Math.max(n - 1, 0));
      }
    },
    [],
  );

  // Auto-show on internal link navigation. Mirrors the NProgress click
  // detection: anything that triggers a real client route change arms the
  // delayed overlay; external/hash/new-tab/same-page links are ignored.
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      // Respect modifier clicks (open in new tab) and non-primary buttons.
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) {
        return;
      }
      const anchor = (e.target as HTMLElement).closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;

      if (
        href.startsWith("http") ||
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href === pathname ||
        anchor.getAttribute("target") === "_blank" ||
        anchor.hasAttribute("download")
      ) {
        return;
      }

      clearNavTimers();
      setMessage(undefined);
      navShowTimer.current = setTimeout(() => setNavActive(true), NAV_SHOW_DELAY_MS);
      navSafetyTimer.current = setTimeout(() => {
        clearNavTimers();
        setNavActive(false);
      }, NAV_SAFETY_TIMEOUT_MS);
    };

    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [pathname, clearNavTimers]);

  // The new route has rendered: cancel any pending show and clear the loader.
  useEffect(() => {
    clearNavTimers();
    setNavActive(false);
  }, [pathname, clearNavTimers]);

  const api = useMemo<GlobalLoaderApi>(
    () => ({ start, stop, run, isLoading: manualCount > 0 || navActive }),
    [start, stop, run, manualCount, navActive],
  );

  const visible = manualCount > 0 || navActive;

  return (
    <GlobalLoaderContext.Provider value={api}>
      {children}
      {visible && (
        <div
          className="global-loader-overlay fixed inset-0 z-[9998] flex items-center justify-center bg-admin-bg/55 backdrop-blur-[2px]"
          role="status"
          aria-live="polite"
          aria-label={message ?? "Loading"}
        >
          <div className="flex flex-col items-center gap-4 rounded-2xl bg-admin-surface px-8 py-7 shadow-2xl shadow-black/10 ring-1 ring-admin-border">
            <span
              className={cn(
                "h-10 w-10 rounded-full border-[3px] border-admin-accent/25 border-t-admin-accent",
                "animate-spin",
              )}
            />
            <span className="text-sm font-medium text-admin-text-secondary">
              {message ?? "Loading…"}
            </span>
          </div>
        </div>
      )}
    </GlobalLoaderContext.Provider>
  );
}

/** Imperative `useGlobalLoader()` for actions: `start/stop`, `run(promise)`. */
export function useGlobalLoader(): GlobalLoaderApi {
  const ctx = useContext(GlobalLoaderContext);
  if (!ctx) {
    throw new Error("useGlobalLoader must be used within a GlobalLoaderProvider");
  }
  return ctx;
}
