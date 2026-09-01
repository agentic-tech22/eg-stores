import { describe, it, expect } from "vitest";
import {
  buildMembershipUrl,
  citizenshipPhotoPath,
  compactPhone,
  isHoneypotTripped,
  normalizeMembershipSignup,
  validateCitizenshipPhoto,
  validateMembershipSignup,
  CITIZENSHIP_PHOTO_MAX_BYTES,
} from "./membership-engine";
import type { MembershipSignupInput } from "@/types/customer.types";

const signup = (over: Partial<MembershipSignupInput> = {}): MembershipSignupInput => ({
  name: "Ram Bahadur",
  phone: "9812345678",
  ...over,
});

describe("validateMembershipSignup", () => {
  it("accepts a submission with only the required name and phone", () => {
    expect(validateMembershipSignup(signup())).toBeNull();
  });

  it("accepts every optional field when well formed", () => {
    expect(
      validateMembershipSignup(
        signup({
          email: "ram@example.com",
          address: "Thamel, Kathmandu",
          dob: "1990-04-17",
          citizenshipNumber: "12-34-56-78901",
        }),
      ),
    ).toBeNull();
  });

  it("requires a name", () => {
    expect(validateMembershipSignup(signup({ name: "   " }))?.field).toBe("name");
  });

  it("requires a phone number", () => {
    expect(validateMembershipSignup(signup({ phone: "" }))?.field).toBe("phone");
  });

  it("rejects a phone number containing letters", () => {
    expect(validateMembershipSignup(signup({ phone: "98call-me" }))?.field).toBe(
      "phone",
    );
  });

  it("rejects a phone number that is too short or too long", () => {
    expect(validateMembershipSignup(signup({ phone: "12345" }))?.field).toBe("phone");
    expect(
      validateMembershipSignup(signup({ phone: "1234567890123456" }))?.field,
    ).toBe("phone");
  });

  it("allows the separators people actually type", () => {
    expect(validateMembershipSignup(signup({ phone: "+977 (98) 1234-5678" }))).toBeNull();
  });

  it("ignores blank optional fields rather than validating them", () => {
    expect(
      validateMembershipSignup(
        signup({ email: "  ", dob: "", citizenshipNumber: "", address: "  " }),
      ),
    ).toBeNull();
  });

  it("rejects a malformed email when one is given", () => {
    expect(validateMembershipSignup(signup({ email: "ram@" }))?.field).toBe("email");
  });

  it("rejects a date of birth that is not YYYY-MM-DD", () => {
    expect(validateMembershipSignup(signup({ dob: "17/04/1990" }))?.field).toBe("dob");
  });

  it("rejects an impossible calendar date", () => {
    expect(validateMembershipSignup(signup({ dob: "1990-02-31" }))?.field).toBe("dob");
  });

  it("rejects a date of birth in the future", () => {
    expect(validateMembershipSignup(signup({ dob: "3000-01-01" }))?.field).toBe("dob");
  });

  it("rejects a year of birth before 1900 as a typo", () => {
    expect(validateMembershipSignup(signup({ dob: "1885-06-02" }))?.field).toBe("dob");
  });

  it("rejects an over-long citizenship number", () => {
    expect(
      validateMembershipSignup(signup({ citizenshipNumber: "1".repeat(51) }))?.field,
    ).toBe("citizenshipNumber");
  });

  it("reports the name before the phone when both are missing", () => {
    expect(validateMembershipSignup(signup({ name: "", phone: "" }))?.field).toBe(
      "name",
    );
  });
});

describe("normalizeMembershipSignup", () => {
  it("trims the required fields", () => {
    const result = normalizeMembershipSignup(
      signup({ name: "  Ram Bahadur  ", phone: " 9812345678 " }),
    );
    expect(result.name).toBe("Ram Bahadur");
    expect(result.phone).toBe("9812345678");
  });

  it("collapses blank optional fields to null", () => {
    const result = normalizeMembershipSignup(
      signup({ email: "", address: "   ", dob: "", citizenshipNumber: undefined }),
    );
    expect(result.email).toBeNull();
    expect(result.address).toBeNull();
    expect(result.dob).toBeNull();
    expect(result.citizenshipNumber).toBeNull();
  });

  it("compacts the phone so POS sale linking can match it exactly", () => {
    expect(normalizeMembershipSignup(signup({ phone: "98 1234-5678" })).phone).toBe(
      "9812345678",
    );
  });
});

describe("compactPhone", () => {
  it("strips the separators people type", () => {
    expect(compactPhone(" (98) 1234-5678 ")).toBe("9812345678");
  });

  it("keeps a leading country-code plus", () => {
    expect(compactPhone("+977 98-1234567")).toBe("+977981234567");
  });

  it("leaves an already-compact number untouched", () => {
    expect(compactPhone("9812345678")).toBe("9812345678");
  });
});

describe("isHoneypotTripped", () => {
  it("is false for a real submission that leaves the trap empty", () => {
    expect(isHoneypotTripped(signup({ website: "" }))).toBe(false);
    expect(isHoneypotTripped(signup())).toBe(false);
  });

  it("is true once the hidden field carries anything", () => {
    expect(isHoneypotTripped(signup({ website: "https://spam.example" }))).toBe(true);
  });
});

describe("buildMembershipUrl", () => {
  it("prefers the configured site URL", () => {
    expect(buildMembershipUrl("https://shop.example.com", "http://localhost:3000")).toBe(
      "https://shop.example.com/membership",
    );
  });

  it("falls back to the caller's origin when the site URL is unset or blank", () => {
    expect(buildMembershipUrl(undefined, "http://localhost:3000")).toBe(
      "http://localhost:3000/membership",
    );
    expect(buildMembershipUrl("   ", "http://localhost:3000")).toBe(
      "http://localhost:3000/membership",
    );
  });

  it("does not double up the slash on a base URL with a trailing one", () => {
    expect(buildMembershipUrl("https://shop.example.com/", "")).toBe(
      "https://shop.example.com/membership",
    );
  });
});

describe("validateCitizenshipPhoto", () => {
  it("accepts a normal JPEG snapshot", () => {
    expect(
      validateCitizenshipPhoto({ type: "image/jpeg", size: 400_000 }),
    ).toBeNull();
  });

  it("rejects a PDF or any other non-image", () => {
    expect(
      validateCitizenshipPhoto({ type: "application/pdf", size: 1000 }),
    ).toMatch(/JPG, PNG or WebP/);
  });

  it("rejects a photo over the bucket's size limit", () => {
    expect(
      validateCitizenshipPhoto({
        type: "image/png",
        size: CITIZENSHIP_PHOTO_MAX_BYTES + 1,
      }),
    ).toMatch(/too large/);
  });

  it("rejects an empty file", () => {
    expect(validateCitizenshipPhoto({ type: "image/jpeg", size: 0 })).toMatch(
      /could not be read/,
    );
  });
});

describe("citizenshipPhotoPath", () => {
  it("keys the object by customer id, so it neither collides nor leaks a phone", () => {
    expect(citizenshipPhotoPath("abc-123", "image/jpeg")).toBe(
      "citizenship/abc-123.jpg",
    );
  });

  it("keeps the real extension for the other accepted formats", () => {
    expect(citizenshipPhotoPath("c1", "image/png")).toBe("citizenship/c1.png");
    expect(citizenshipPhotoPath("c1", "image/webp")).toBe("citizenship/c1.webp");
  });
});
