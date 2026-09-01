"use server";

import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { getBusinessProfile } from "@/queries/invoice.query";
import { getCustomerByPhone } from "@/queries/customer.query";
import {
  buildMembershipUrl,
  citizenshipPhotoPath,
  isHoneypotTripped,
  normalizeMembershipSignup,
  validateCitizenshipPhoto,
  validateMembershipSignup,
} from "@/services/membership-engine";
import {
  putCitizenshipPhoto,
  removeCitizenshipPhoto,
} from "@/lib/storage/citizenship-photo";
import type {
  MembershipSignupInput,
  MembershipSignupResult,
} from "@/types/customer.types";

/** Shop identity shown on the public membership page (no auth required). */
export interface MembershipShopInfo {
  shopName: string | null;
  logoUrl: string | null;
  address: string | null;
  phone: string | null;
}

/**
 * Branding for the public signup page. Unlike `fetchBusinessProfile` this is
 * deliberately ungated — the page is public — so it returns only the handful of
 * fields already printed on every invoice a customer receives, never the
 * invoice counters, tax ID, or loyalty configuration.
 */
export async function fetchMembershipShopInfo(): Promise<MembershipShopInfo> {
  const row = await getBusinessProfile();
  return {
    shopName: row?.shop_name ?? null,
    logoUrl: row?.logo_url ?? null,
    address: row?.address ?? null,
    phone: row?.phone ?? null,
  };
}

/**
 * Public membership enrolment: called from the unauthenticated /membership
 * page, so it takes no permission and re-validates everything the client
 * checked. Writes through the admin client because `customers` is
 * service-role-only (no public RLS insert policy), which keeps the table
 * closed to direct anon writes while still allowing this one narrow path.
 *
 * A phone number that already exists is refused rather than updated: the phone
 * is the identity key, and letting a public form write to an existing row would
 * let anyone overwrite another customer's details by guessing their number.
 */
export async function submitMembershipSignup(
  input: MembershipSignupInput,
  /**
   * Optional citizenship photo, carried as FormData under "file" because a File
   * cannot travel inside a plain action argument. Deliberately part of THIS
   * action rather than a standalone upload endpoint: an anonymous visitor can
   * only store a file as part of one accepted enrolment, and the phone-number
   * uniqueness check caps that at one per member.
   */
  photo?: FormData | null,
): Promise<MembershipSignupResult> {
  try {
    // Bots get a success response so they cannot tell they were filtered out.
    if (isHoneypotTripped(input)) return { success: true };

    const invalid = validateMembershipSignup(input);
    if (invalid) {
      return { success: false, error: invalid.message, field: invalid.field };
    }

    // Re-check the file server-side; the picker's `accept` filter is a hint the
    // client can bypass.
    const file = photo?.get("file");
    const photoFile = file instanceof File && file.size > 0 ? file : null;
    if (photoFile) {
      const badPhoto = validateCitizenshipPhoto(photoFile);
      if (badPhoto) {
        return { success: false, error: badPhoto, field: "citizenshipPhoto" };
      }
    }

    const data = normalizeMembershipSignup(input);

    const existing = await getCustomerByPhone(data.phone);
    if (existing) {
      return {
        success: false,
        field: "phone",
        error:
          "This number is already registered with us. Please ask at the counter and our staff will help you.",
      };
    }

    const supabase = createAdminClient();
    const { data: created, error } = await supabase
      .from("customers")
      .insert({
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        dob: data.dob,
        citizenship_number: data.citizenshipNumber,
        is_active: true,
        is_member: true,
        notes: "Enrolled via the membership signup form.",
      })
      .select("id")
      .single();

    if (error) {
      // The uniqueness check above races with a simultaneous submission of the
      // same number; the DB constraint is the real guard, so map it to the same
      // message rather than leaking a Postgres error to a shopper.
      if (/duplicate|unique/i.test(error.message)) {
        return {
          success: false,
          field: "phone",
          error:
            "This number is already registered with us. Please ask at the counter and our staff will help you.",
        };
      }
      console.error("Membership signup failed:", error.message);
      return {
        success: false,
        error: "Could not complete your registration. Please try again.",
      };
    }

    // The photo is stored last, keyed by the id the database just assigned. The
    // member is already enrolled at this point, so a storage failure is logged
    // and swallowed rather than failing a signup that otherwise succeeded — the
    // photo is optional, and staff can collect it at the counter.
    if (photoFile && created?.id) {
      const path = citizenshipPhotoPath(created.id, photoFile.type);
      const { error: uploadError } = await putCitizenshipPhoto(path, photoFile);
      if (uploadError) {
        console.error("Citizenship photo upload failed:", uploadError);
      } else {
        const { error: linkError } = await supabase
          .from("customers")
          .update({ citizenship_photo_path: path })
          .eq("id", created.id);
        if (linkError) {
          console.error("Citizenship photo link failed:", linkError.message);
          await removeCitizenshipPhoto(path);
        }
      }
    }

    return { success: true };
  } catch (err) {
    console.error("Membership signup failed:", err);
    return {
      success: false,
      error: "Could not complete your registration. Please try again.",
    };
  }
}

/**
 * QR code for the public signup link, for printing as a counter/poster card.
 * `origin` is the dashboard's own origin, used only when NEXT_PUBLIC_SITE_URL
 * is unset. Gated on customers.view since it is a dashboard-only action.
 */
export async function generateMembershipQr(origin: string): Promise<{
  success: boolean;
  error?: string;
  url?: string;
  qrDataUrl?: string;
}> {
  try {
    await requirePermission("customers.view");
    const url = buildMembershipUrl(process.env.NEXT_PUBLIC_SITE_URL, origin);
    const qrDataUrl = await QRCode.toDataURL(url, { margin: 1, width: 512 });
    return { success: true, url, qrDataUrl };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Could not generate the QR code.",
    };
  }
}
