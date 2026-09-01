import type { NcmPhase, NcmTone } from "@/types/ncm.types";

/**
 * NCM exposes delivery progress as free-text status strings. We classify them
 * into a coarse phase to drive UI tone and the order lifecycle (delivered →
 * commit stock; returned/failed → release stock).
 */
export function getNcmPhase(status: string | null | undefined): NcmPhase {
  if (!status) return "unknown";
  const s = status.toLowerCase();

  // Order matters: check the specific terminal/transit signals before the broad
  // "deliver" match, otherwise "delivery failed" or "sent for delivery" would be
  // wrongly classified as delivered (and commit stock early).
  if (
    s.includes("return") ||
    s.includes("cancel") ||
    s.includes("reject")
  ) {
    return "returned";
  }
  if (s.includes("fail")) return "failed";
  if (
    s.includes("pickup") ||
    s.includes("sent for") ||
    s.includes("arrived") ||
    s.includes("transit") ||
    s.includes("dispatch")
  ) {
    return "in_transit";
  }
  if (s.includes("deliver")) return "delivered";
  if (s.includes("created") || s.includes("drop")) return "created";
  return "unknown";
}

export function isNcmDelivered(status: string | null | undefined): boolean {
  return getNcmPhase(status) === "delivered";
}

export function isNcmCancelledOrReturned(
  status: string | null | undefined,
): boolean {
  const phase = getNcmPhase(status);
  return phase === "returned" || phase === "failed";
}

export function getNcmTone(status: string | null | undefined): NcmTone {
  switch (getNcmPhase(status)) {
    case "delivered":
      return "success";
    case "failed":
      return "error";
    case "returned":
      return "warning";
    case "in_transit":
      return "info";
    case "created":
      return "pending";
    default:
      return "neutral";
  }
}
