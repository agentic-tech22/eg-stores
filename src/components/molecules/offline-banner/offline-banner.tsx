"use client";

import { useEffect, useRef } from "react";
import { useOnline } from "@/hooks/use-online";
import { notify } from "@/lib/toast";

/**
 * A persistent, top-of-screen indicator shown whenever the browser loses its
 * network connection. While offline, React Query pauses every query/mutation and
 * automatically resumes them on reconnect, so the banner reassures the user that
 * their pending actions aren't lost; they'll sync once the connection returns.
 * On reconnect it surfaces a brief "back online" toast. Mounted once inside the
 * admin providers.
 */
export function OfflineBanner() {
  const online = useOnline();
  // Track the previous state so we only toast on an actual offline -> online
  // transition, not on the initial mount.
  const wasOffline = useRef(false);

  useEffect(() => {
    if (!online) {
      wasOffline.current = true;
    } else if (wasOffline.current) {
      wasOffline.current = false;
      notify.success("Back online. You're reconnected.");
    }
  }, [online]);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed inset-x-0 top-0 z-[9999] flex items-center justify-center gap-2 bg-amber-500 px-4 py-2 text-center text-sm font-medium text-white shadow-md"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4 shrink-0"
      >
        <path d="M1 1l22 22" />
        <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
        <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
        <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
        <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
        <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
        <line x1="12" y1="20" x2="12.01" y2="20" />
      </svg>
      <span>No internet connection. Changes will sync once you&apos;re back online.</span>
    </div>
  );
}
