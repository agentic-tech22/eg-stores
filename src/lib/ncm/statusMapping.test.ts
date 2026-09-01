import { describe, it, expect } from "vitest";
import {
  getNcmPhase,
  isNcmDelivered,
  isNcmCancelledOrReturned,
} from "./statusMapping";

describe("getNcmPhase: free-text NCM status classification", () => {
  it("classifies delivery-related text as 'delivered' (commits stock)", () => {
    expect(getNcmPhase("Delivered")).toBe("delivered");
    expect(getNcmPhase("Parcel delivered to customer")).toBe("delivered");
  });

  it("classifies return/cancel/reject as 'returned' (releases stock)", () => {
    expect(getNcmPhase("Returned to vendor")).toBe("returned");
    expect(getNcmPhase("Order cancelled")).toBe("returned");
    expect(getNcmPhase("Rejected by customer")).toBe("returned");
  });

  it("classifies failure text as 'failed'", () => {
    expect(getNcmPhase("Delivery failed")).toBe("failed");
  });

  it("classifies movement text as 'in_transit'", () => {
    for (const s of ["Pickup complete", "Sent for delivery", "Arrived at hub", "In transit", "Dispatched"]) {
      expect(getNcmPhase(s)).toBe("in_transit");
    }
  });

  it("classifies creation text as 'created' and unknowns as 'unknown'", () => {
    expect(getNcmPhase("Order created")).toBe("created");
    expect(getNcmPhase("Dropoff at branch")).toBe("created");
    expect(getNcmPhase("something weird")).toBe("unknown");
    expect(getNcmPhase(null)).toBe("unknown");
    expect(getNcmPhase(undefined)).toBe("unknown");
  });

  it("exposes the lifecycle-driving predicates", () => {
    expect(isNcmDelivered("Delivered")).toBe(true);
    expect(isNcmCancelledOrReturned("Returned")).toBe(true);
    expect(isNcmCancelledOrReturned("Delivery failed")).toBe(true);
    expect(isNcmCancelledOrReturned("In transit")).toBe(false);
  });
});
