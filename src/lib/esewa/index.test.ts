import { describe, it, expect } from "vitest";
import {
  generateSignature,
  verifyEsewaSignature,
  decodeEsewaResponse,
} from "./index";
import type { EsewaSuccessResponse } from "./config";

/** Build a response whose signature is genuinely valid for its fields. */
function signedResponse(over: Partial<EsewaSuccessResponse> = {}): EsewaSuccessResponse {
  const base: EsewaSuccessResponse = {
    transaction_code: "0001",
    status: "COMPLETE",
    total_amount: "100",
    transaction_uuid: "TXN-1",
    product_code: "EPAYTEST",
    signed_field_names: "total_amount,transaction_uuid,product_code",
    signature: "",
    ...over,
  };
  const message = base.signed_field_names
    .split(",")
    .map((f) => `${f.trim()}=${base[f.trim() as keyof EsewaSuccessResponse]}`)
    .join(",");
  base.signature = generateSignature(message);
  return base;
}

describe("generateSignature", () => {
  it("is deterministic for the same message + key", () => {
    expect(generateSignature("a=1,b=2")).toBe(generateSignature("a=1,b=2"));
  });
  it("changes when the message changes", () => {
    expect(generateSignature("a=1")).not.toBe(generateSignature("a=2"));
  });
});

describe("verifyEsewaSignature: rejects forged/tampered callbacks", () => {
  it("accepts a correctly signed response", () => {
    expect(verifyEsewaSignature(signedResponse())).toBe(true);
  });

  it("rejects a response whose amount was tampered after signing", () => {
    const res = signedResponse();
    res.total_amount = "999999"; // signature no longer matches
    expect(verifyEsewaSignature(res)).toBe(false);
  });

  it("rejects an outright forged signature", () => {
    const res = signedResponse();
    res.signature = "deadbeef"; // overwrite the valid signature with a forgery
    expect(verifyEsewaSignature(res)).toBe(false);
  });
});

describe("decodeEsewaResponse", () => {
  it("decodes valid base64 JSON", () => {
    const payload = { status: "COMPLETE", total_amount: "100" };
    const encoded = Buffer.from(JSON.stringify(payload)).toString("base64");
    expect(decodeEsewaResponse(encoded)).toMatchObject(payload);
  });

  it("returns null for malformed input instead of throwing", () => {
    expect(decodeEsewaResponse("!!!not-base64-json!!!")).toBeNull();
  });
});
