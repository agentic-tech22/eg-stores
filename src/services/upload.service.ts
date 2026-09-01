"use server";

import { createAdminClient } from "@/lib/supabase/server";
import {
  AuthorizationError,
  ctxHasPermission,
  requireAuth,
} from "@/lib/auth/session";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/svg+xml",
  "image/x-icon",
  "image/vnd.microsoft.icon",
];

interface UploadOptions {
  bucket: string;
  folder?: string;
  allowedTypes?: string[];
  maxSizeBytes?: number;
}

async function uploadImage(
  formData: FormData,
  options: UploadOptions,
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const file = formData.get("file") as File | null;
    const folderOverride = formData.get("folder") as string | null;

    if (!file) {
      return { success: false, error: "No file provided." };
    }

    const allowed = options.allowedTypes ?? IMAGE_TYPES;
    if (!allowed.includes(file.type)) {
      return {
        success: false,
        error: `Invalid file type. Accepted: ${allowed.map((t) => t.split("/")[1]).join(", ")}.`,
      };
    }

    const maxSize = options.maxSizeBytes ?? MAX_FILE_SIZE;
    if (file.size > maxSize) {
      return {
        success: false,
        error: `File too large. Maximum ${Math.round(maxSize / 1024 / 1024)}MB.`,
      };
    }

    // Plain service-role client (no user cookies). The SSR client would attach
    // the caller's JWT as the auth bearer, and Storage would enforce RLS as that
    // user, which fails since `storage.objects` has no policies. This client
    // acts as service_role and genuinely bypasses RLS.
    const supabase = createAdminClient();

    const ext = file.name.split(".").pop() ?? "png";
    const folder = folderOverride ?? options.folder ?? "assets";
    const fileName = `${folder}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(options.bucket)
      .upload(fileName, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type,
      });

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from(options.bucket).getPublicUrl(fileName);

    return { success: true, url: publicUrl };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed.";
    return { success: false, error: message };
  }
}

async function deleteImage(
  url: string,
  bucket: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createAdminClient();

    const bucketPath = url.split(
      `/storage/v1/object/public/${bucket}/`,
    )[1];
    if (!bucketPath) {
      return { success: false, error: "Invalid file URL." };
    }

    const { error } = await supabase.storage
      .from(bucket)
      .remove([bucketPath]);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Delete failed.";
    return { success: false, error: message };
  }
}

// ---- Branding uploads (logo, favicon) ----

export async function uploadBrandingImage(
  formData: FormData,
): Promise<{ success: boolean; url?: string; error?: string }> {
  return uploadImage(formData, { bucket: "branding" });
}

export async function deleteBrandingImage(
  url: string,
): Promise<{ success: boolean; error?: string }> {
  return deleteImage(url, "branding");
}

// ---- Product uploads ----

/** Product images can be touched by anyone allowed to create or edit products. */
async function assertCanManageProductImages(): Promise<void> {
  const ctx = await requireAuth();
  if (
    !ctxHasPermission(ctx, "products.create") &&
    !ctxHasPermission(ctx, "products.edit")
  ) {
    throw new AuthorizationError(
      "You do not have permission to manage product images.",
    );
  }
}

export async function uploadProductImage(
  formData: FormData,
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    await assertCanManageProductImages();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Not authorized.",
    };
  }
  return uploadImage(formData, {
    bucket: "products",
    folder: "images",
    allowedTypes: ["image/png", "image/jpeg", "image/webp"],
  });
}

export async function deleteProductImage(
  url: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertCanManageProductImages();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Not authorized.",
    };
  }
  return deleteImage(url, "products");
}

// ---- Vendor bill attachments (images + PDFs) ----

/** Vendor bills can be touched by anyone allowed to create or edit vendors. */
async function assertCanManageVendorBills(): Promise<void> {
  const ctx = await requireAuth();
  if (
    !ctxHasPermission(ctx, "vendors.create") &&
    !ctxHasPermission(ctx, "vendors.edit")
  ) {
    throw new AuthorizationError(
      "You do not have permission to manage vendor bills.",
    );
  }
}

export async function uploadVendorBill(
  formData: FormData,
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    await assertCanManageVendorBills();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Not authorized.",
    };
  }
  return uploadImage(formData, {
    bucket: "vendor-bills",
    folder: "bills",
    allowedTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "application/pdf",
    ],
    maxSizeBytes: 10 * 1024 * 1024,
  });
}

export async function deleteVendorBill(
  url: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertCanManageVendorBills();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Not authorized.",
    };
  }
  return deleteImage(url, "vendor-bills");
}

// ---- Expense receipts (images + PDFs) ----

/** Receipts can be touched by anyone allowed to record or edit expenses. */
async function assertCanManageExpenseReceipts(): Promise<void> {
  const ctx = await requireAuth();
  if (
    !ctxHasPermission(ctx, "expenses.create") &&
    !ctxHasPermission(ctx, "expenses.edit")
  ) {
    throw new AuthorizationError(
      "You do not have permission to manage expense receipts.",
    );
  }
}

export async function uploadExpenseReceipt(
  formData: FormData,
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    await assertCanManageExpenseReceipts();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Not authorized.",
    };
  }
  return uploadImage(formData, {
    bucket: "expense-receipts",
    folder: "receipts",
    allowedTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "application/pdf",
    ],
    maxSizeBytes: 10 * 1024 * 1024,
  });
}

export async function deleteExpenseReceipt(
  url: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertCanManageExpenseReceipts();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Not authorized.",
    };
  }
  return deleteImage(url, "expense-receipts");
}

// ---- User HR documents (images + PDFs, admin only) ----

/** User personnel documents are admin-only, matching the Users page. */
async function assertCanManageUserDocuments(): Promise<void> {
  const ctx = await requireAuth();
  if (!ctx.isAdmin) {
    throw new AuthorizationError(
      "You do not have permission to manage user documents.",
    );
  }
}

export async function uploadUserDocument(
  formData: FormData,
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    await assertCanManageUserDocuments();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Not authorized.",
    };
  }
  return uploadImage(formData, {
    bucket: "user-documents",
    folder: "documents",
    allowedTypes: [
      "image/png",
      "image/jpeg",
      "image/webp",
      "application/pdf",
    ],
    maxSizeBytes: 10 * 1024 * 1024,
  });
}

export async function deleteUserDocument(
  url: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await assertCanManageUserDocuments();
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Not authorized.",
    };
  }
  return deleteImage(url, "user-documents");
}

// ---- Avatar uploads (testimonials, team, etc.) ----

export async function uploadAvatarImage(
  formData: FormData,
): Promise<{ success: boolean; url?: string; error?: string }> {
  return uploadImage(formData, {
    bucket: "branding",
    folder: "avatars",
    allowedTypes: ["image/png", "image/jpeg", "image/webp"],
    maxSizeBytes: 2 * 1024 * 1024,
  });
}

export async function deleteAvatarImage(
  url: string,
): Promise<{ success: boolean; error?: string }> {
  return deleteImage(url, "branding");
}
