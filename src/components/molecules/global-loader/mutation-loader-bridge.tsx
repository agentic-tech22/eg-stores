"use client";

import { useEffect, useRef } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { useOnline } from "@/hooks/use-online";
import { useGlobalLoader } from "./global-loader";

// Don't flash the overlay for instant mutations: only reveal it once an action
// has been running longer than this. Most quick toggles finish first.
const SHOW_DELAY_MS = 120;

/**
 * Bridges React Query's mutation activity to the global loader: whenever any
 * mutation is in flight (create/update/delete across the dashboard), the
 * overlay appears, giving uniform "we're working on it" feedback for every
 * action without each hook having to opt in. Mounts inside both the
 * QueryClientProvider and the GlobalLoaderProvider.
 */
export function MutationLoaderBridge() {
  const isMutating = useIsMutating();
  const online = useOnline();
  const { start } = useGlobalLoader();

  const stopRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // While offline, React Query pauses mutations (fetchStatus 'paused') yet they
  // still count as in-flight. Treat that as idle so the "Working…" overlay never
  // hangs: the OfflineBanner explains the pause, and the loader returns when the
  // connection comes back and the mutation actually resumes.
  const active = online ? isMutating : 0;

  useEffect(() => {
    if (active > 0) {
      if (!stopRef.current && !timerRef.current) {
        timerRef.current = setTimeout(() => {
          timerRef.current = null;
          stopRef.current = start("Working…");
        }, SHOW_DELAY_MS);
      }
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      stopRef.current?.();
      stopRef.current = null;
    }
  }, [active, start]);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      stopRef.current?.();
    },
    [],
  );

  return null;
}
