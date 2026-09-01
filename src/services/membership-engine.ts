/**
 * Membership signup validation + normalization: pure functions shared by the
 * public form (client-side, for inline errors) and the server action (which
 * re-runs them because the client is untrusted). NOT a "use server" module, so
 * it can export plain synchronous functions and be unit-tested directly.
 */

import type {
  MembershipFormField,
  MembershipSignupInput,
} from "@/types/customer.types";

/** Trim a value down to null when it is blank. */
export function cleanOptional(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Compact a phone number down to the form the rest of the app matches on:
 * digits only, keeping a leading `+` when the visitor typed one.
 *
 * This is not cosmetic. POS sale linking and `getCustomerByPhone` compare
 * `customers.phone` as an exact string, so storing "98 1234-5678" verbatim
 * would leave that member unmatched the moment a cashier types "9812345678" —
 * the member would silently earn no loyalty points. Compacting on the way in
 * makes the separators a visitor happens to type irrelevant.
 *
 * Note this does NOT reconcile country codes: "+9779812345678" and
 * "9812345678" remain different customers, matching how the POS, checkout, and
 * customer form already treat the number.
 */
export function compactPhone(phone: string): string {
  const trimmed = phone.trim();
  const digits = trimmed.replace(/\D/g, "");
  return trimmed.startsWith("+") ? `+${digits}` : digits;
}

/** Fields the form can flag, in the order they appear on the page. */
export type MembershipField = MembershipFormField;

/** The subset that maps to a text control, i.e. what `validate` can reject. */
export type MembershipTextField = keyof MembershipSignupInput;

export interface MembershipValidationError {
  field: MembershipField;
  message: string;
}

/**
 * Only `name` and `phone` are required — everything else is optional and is
 * validated for shape only when the visitor actually filled it in. Returns the
 * first problem found, or null when the submission is acceptable.
 */
export function validateMembershipSignup(
  input: MembershipSignupInput,
): MembershipValidationError | null {
  const name = cleanOptional(input.name);
  if (!name) {
    return { field: "name", message: "Please enter your full name." };
  }
  if (name.length > 120) {
    return { field: "name", message: "That name is too long." };
  }

  const phone = cleanOptional(input.phone);
  if (!phone) {
    return { field: "phone", message: "Please enter your WhatsApp number." };
  }
  if (!/^\+?[0-9\s\-()]+$/.test(phone)) {
    return {
      field: "phone",
      message: "A phone number can only contain digits, spaces, + and -.",
    };
  }
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) {
    return { field: "phone", message: "Please enter a valid phone number." };
  }

  const email = cleanOptional(input.email);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    return { field: "email", message: "Please enter a valid email address." };
  }

  const dob = cleanOptional(input.dob);
  if (dob) {
    // A native date input always yields YYYY-MM-DD; anything else was forged
    // or came from a browser that fell back to a text input.
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      return { field: "dob", message: "Please enter your date of birth as YYYY-MM-DD." };
    }
    const parsed = new Date(`${dob}T00:00:00Z`);
    // `Date` silently rolls overflow forward (2026-02-31 becomes 2026-03-03)
    // instead of failing, so compare the round-trip rather than checking NaN.
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.toISOString().slice(0, 10) !== dob
    ) {
      return { field: "dob", message: "That date of birth is not a real date." };
    }
    // Reject dates in the future and implausibly old ones, which are almost
    // always a typo in the year.
    const year = parsed.getUTCFullYear();
    if (parsed.getTime() > Date.now()) {
      return { field: "dob", message: "Date of birth cannot be in the future." };
    }
    if (year < 1900) {
      return { field: "dob", message: "Please check the year of birth." };
    }
  }

  const citizenship = cleanOptional(input.citizenshipNumber);
  if (citizenship && citizenship.length > 50) {
    return {
      field: "citizenshipNumber",
      message: "That citizenship number is too long.",
    };
  }

  const address = cleanOptional(input.address);
  if (address && address.length > 300) {
    return { field: "address", message: "That address is too long." };
  }

  return null;
}

/**
 * The DB-ready shape of a validated submission. Blank optional fields collapse
 * to null so an empty form field never stores an empty string.
 */
export interface NormalizedMembershipSignup {
  name: string;
  phone: string;
  email: string | null;
  address: string | null;
  dob: string | null;
  citizenshipNumber: string | null;
}

/** Trim and null-out a submission that has already passed validation. */
export function normalizeMembershipSignup(
  input: MembershipSignupInput,
): NormalizedMembershipSignup {
  return {
    name: input.name.trim(),
    phone: compactPhone(input.phone),
    email: cleanOptional(input.email),
    address: cleanOptional(input.address),
    dob: cleanOptional(input.dob),
    citizenshipNumber: cleanOptional(input.citizenshipNumber),
  };
}

/* ---------------------------------------------------------------------------
 * Citizenship photo
 * ------------------------------------------------------------------------- */

/** Image formats accepted for the citizenship photo. PDFs are not: it is a snapshot. */
export const CITIZENSHIP_PHOTO_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
] as const;

/** Server-side cap, matching the `customer-documents` bucket's file_size_limit. */
export const CITIZENSHIP_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Bucket holding citizenship photos. PRIVATE: read only via a signed URL. */
export const CITIZENSHIP_PHOTO_BUCKET = "customer-documents";

/**
 * Check an uploaded photo before it reaches storage. The form filters the file
 * picker too, but the action re-runs this because a submission can be forged.
 * Returns an error message, or null when the file is acceptable.
 */
export function validateCitizenshipPhoto(file: {
  type: string;
  size: number;
}): string | null {
  if (!(CITIZENSHIP_PHOTO_TYPES as readonly string[]).includes(file.type)) {
    return "Please upload the photo as a JPG, PNG or WebP image.";
  }
  if (file.size > CITIZENSHIP_PHOTO_MAX_BYTES) {
    return "That photo is too large. Please upload one under 5MB.";
  }
  if (file.size === 0) {
    return "That photo could not be read. Please try another file.";
  }
  return null;
}

/**
 * Where a member's photo lives in the bucket. Keyed by customer id (assigned by
 * the database), so the path is neither guessable from a phone number nor
 * collides across members, and re-uploading replaces the previous file.
 */
export function citizenshipPhotoPath(
  customerId: string,
  contentType: string,
): string {
  const ext = contentType === "image/png" ? "png"
    : contentType === "image/webp" ? "webp"
    : "jpg";
  return `citizenship/${customerId}.${ext}`;
}

/**
 * True when the hidden honeypot field was filled in, which only a bot does.
 * The caller answers such submissions with a generic success so the bot gets
 * no signal that it was dropped.
 */
export function isHoneypotTripped(input: MembershipSignupInput): boolean {
  return Boolean(input.website?.trim());
}

/** The public signup path. Kept here so the page and the QR agree on it. */
export const MEMBERSHIP_SIGNUP_PATH = "/membership";

/**
 * Absolute URL the QR code encodes. Prefers the configured site URL and falls
 * back to the origin the dashboard is being viewed from, so the QR still works
 * on a deployment where NEXT_PUBLIC_SITE_URL was never set.
 */
export function buildMembershipUrl(
  configuredSiteUrl: string | undefined,
  fallbackOrigin: string,
): string {
  const base = (configuredSiteUrl?.trim() || fallbackOrigin).replace(/\/+$/, "");
  return `${base}${MEMBERSHIP_SIGNUP_PATH}`;
}
