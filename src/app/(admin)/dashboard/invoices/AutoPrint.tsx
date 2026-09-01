"use client";

import { useEffect } from "react";

/**
 * Fires the browser print dialog once after mount, with a short delay so fonts
 * and layout settle first. Used by the dedicated print route.
 */
export function AutoPrint() {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 300);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
