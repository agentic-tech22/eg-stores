/**
 * Storage helpers for member citizenship photos.
 *
 * Deliberately NOT a "use server" module: every export of one is a callable
 * endpoint, and an ungated upload endpoint is exactly what these documents must
 * not have. The functions here are plain server-side helpers, reachable only
 * through the two callers that gate them — the public signup action (which
 * writes at most one photo per successful enrolment) and the
 * `customers.view`-gated action that mints a signed URL for the dashboard.
 *
 * The `customer-documents` bucket is private, so an object URL alone grants
 * nothing; reads go through a short-lived signed link.
 */

import { createAdminClient } from "@/lib/supabase/server";
import { CITIZENSHIP_PHOTO_BUCKET } from "@/services/membership-engine";

/** How long a dashboard view link stays valid. Long enough to open the image. */
const SIGNED_URL_TTL_SECONDS = 300;

/** Upload (or replace) the photo at `path`. Returns an error message on failure. */
export async function putCitizenshipPhoto(
  path: string,
  file: File,
): Promise<{ error?: string }> {
  const supabase = createAdminClient();
  const { error } = await supabase.storage
    .from(CITIZENSHIP_PHOTO_BUCKET)
    .upload(path, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: file.type,
    });
  return error ? { error: error.message } : {};
}

/** Remove a stored photo; used when its customer is deleted. */
export async function removeCitizenshipPhoto(path: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.storage.from(CITIZENSHIP_PHOTO_BUCKET).remove([path]);
}

/**
 * A time-limited URL for viewing one photo, or null when the object is missing.
 * Callers must check the viewer's permission first: this helper does not.
 */
export async function signCitizenshipPhotoUrl(
  path: string,
): Promise<string | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase.storage
    .from(CITIZENSHIP_PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return null;
  return data.signedUrl;
}
