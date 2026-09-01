"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import {
  getCustomerById,
  getCustomerByPhone,
  getCustomers,
  getCustomerSales,
  getLoyaltyTransactions,
  getLoyaltyTransactionsForCustomers,
} from "@/queries/customer.query";
import {
  removeCitizenshipPhoto,
  signCitizenshipPhotoUrl,
} from "@/lib/storage/citizenship-photo";
import {
  computeLoyaltyBalance,
  mapCustomerRow,
  mapLoyaltyTransactionRow,
  toCustomerWithBalance,
} from "@/services/customer-engine";
import type {
  Customer,
  CustomerInput,
  CustomerSale,
  CustomerWithBalance,
  LoyaltyTransaction,
  LoyaltyTransactionInput,
  LoyaltyTransactionRow,
} from "@/types/customer.types";

type Result = { success: boolean; error?: string };

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** All customers with their derived points balance, name order. */
export async function fetchCustomers(): Promise<CustomerWithBalance[]> {
  await requirePermission("customers.view");
  const rows = await getCustomers();
  const customers = rows.map(mapCustomerRow);
  const txns = await getLoyaltyTransactionsForCustomers(
    customers.map((c) => c.id),
  );

  const byCustomer = new Map<string, Pick<LoyaltyTransactionRow, "points">[]>();
  for (const t of txns) {
    const list = byCustomer.get(t.customer_id) ?? [];
    list.push(t);
    byCustomer.set(t.customer_id, list);
  }
  return customers.map((c) =>
    toCustomerWithBalance(c, byCustomer.get(c.id) ?? []),
  );
}

/** A single customer (or null when it does not exist). */
export async function fetchCustomer(id: string): Promise<Customer | null> {
  await requirePermission("customers.view");
  const row = await getCustomerById(id);
  return row ? mapCustomerRow(row) : null;
}

/** A customer's full loyalty ledger, newest first. */
export async function fetchLoyaltyTransactions(
  customerId: string,
): Promise<LoyaltyTransaction[]> {
  await requirePermission("customers.view");
  const rows = await getLoyaltyTransactions(customerId);
  return rows.map(mapLoyaltyTransactionRow);
}

/** A customer's linked sales (purchase history), newest first. */
export async function fetchCustomerSales(
  customerId: string,
): Promise<CustomerSale[]> {
  await requirePermission("customers.view");
  return getCustomerSales(customerId);
}

/**
 * Look up a customer by phone for the POS auto-fill. Returns a lean summary
 * (id, name, points balance) or null. Gated by sales.create so cashiers who can
 * record a sale can resolve the phone even without customers.view.
 */
export async function findCustomerByPhone(phone: string): Promise<{
  id: string;
  name: string | null;
  pointsBalance: number;
} | null> {
  await requirePermission("sales.create");
  const trimmed = phone.trim();
  if (!trimmed) return null;
  const row = await getCustomerByPhone(trimmed);
  if (!row) return null;
  const txns = await getLoyaltyTransactions(row.id);
  return {
    id: row.id,
    name: row.name,
    pointsBalance: computeLoyaltyBalance(txns),
  };
}

export async function createCustomer(input: CustomerInput): Promise<Result> {
  try {
    const ctx = await requirePermission("customers.create");
    const name = cleanText(input.name);
    const phone = cleanText(input.phone);
    if (!name && !phone) {
      return { success: false, error: "A name or phone number is required." };
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from("customers").insert({
      name,
      phone,
      email: cleanText(input.email),
      address: cleanText(input.address),
      notes: cleanText(input.notes),
      dob: cleanText(input.dob),
      citizenship_number: cleanText(input.citizenshipNumber),
      is_active: input.isActive ?? true,
      is_member: input.isMember ?? false,
      created_by: ctx.userId,
      created_by_email: ctx.email,
    });

    if (error) {
      const message = /duplicate|unique/i.test(error.message)
        ? "A customer with that phone number already exists."
        : error.message;
      return { success: false, error: message };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function updateCustomer(
  customerId: string,
  input: CustomerInput,
): Promise<Result> {
  try {
    await requirePermission("customers.edit");
    const supabase = createAdminClient();

    const update: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (input.name !== undefined) update.name = cleanText(input.name);
    if (input.phone !== undefined) update.phone = cleanText(input.phone);
    if (input.email !== undefined) update.email = cleanText(input.email);
    if (input.address !== undefined) update.address = cleanText(input.address);
    if (input.notes !== undefined) update.notes = cleanText(input.notes);
    if (input.dob !== undefined) update.dob = cleanText(input.dob);
    if (input.citizenshipNumber !== undefined)
      update.citizenship_number = cleanText(input.citizenshipNumber);
    if (input.isActive !== undefined) update.is_active = input.isActive;
    if (input.isMember !== undefined) update.is_member = input.isMember;

    const { error } = await supabase
      .from("customers")
      .update(update)
      .eq("id", customerId);

    if (error) {
      const message = /duplicate|unique/i.test(error.message)
        ? "A customer with that phone number already exists."
        : error.message;
      return { success: false, error: message };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/**
 * A short-lived link for viewing one member's citizenship photo. The bucket is
 * private, so this action is the only way to see the document, and it re-reads
 * the path from the database rather than trusting one from the caller — which
 * would otherwise let any signed-in user sign an arbitrary object.
 */
export async function fetchCitizenshipPhotoUrl(
  customerId: string,
): Promise<string | null> {
  await requirePermission("customers.view");
  const row = await getCustomerById(customerId);
  const path = row?.citizenship_photo_path;
  return path ? signCitizenshipPhotoUrl(path) : null;
}

export async function deleteCustomer(customerId: string): Promise<Result> {
  try {
    await requirePermission("customers.delete");
    const supabase = createAdminClient();

    // Refuse to delete a customer that has loyalty history; deactivate instead
    // so the points record is preserved.
    const { count } = await supabase
      .from("loyalty_transactions")
      .select("id", { count: "exact", head: true })
      .eq("customer_id", customerId);
    if ((count ?? 0) > 0) {
      return {
        success: false,
        error:
          "This customer has a loyalty history and cannot be deleted. Deactivate it instead.",
      };
    }

    // Read the photo path before the row goes, so the stored identity document
    // can be removed with it rather than lingering in the bucket.
    const { data: row } = await supabase
      .from("customers")
      .select("citizenship_photo_path")
      .eq("id", customerId)
      .maybeSingle();

    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customerId);
    if (error) return { success: false, error: error.message };

    const path = (row as { citizenship_photo_path: string | null } | null)
      ?.citizenship_photo_path;
    if (path) await removeCitizenshipPhoto(path);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

/** Convert a magnitude + type into the signed points stored in the ledger. */
function signedPoints(type: LoyaltyTransactionInput["type"], points: number) {
  if (type === "redeem") return -Math.abs(points);
  return Math.round(points); // earn: positive; adjust: caller-signed
}

function validateLoyalty(input: LoyaltyTransactionInput): string | null {
  if (!input.customerId) return "A customer is required.";
  if (!["earn", "redeem", "adjust"].includes(input.type))
    return "Invalid entry type.";
  if (!input.txnDate) return "A date is required.";
  if (!Number.isFinite(input.points) || input.points === 0)
    return "Points must be a non-zero number.";
  if (input.type !== "adjust" && input.points < 0)
    return "Points must be a positive number.";
  return null;
}

export async function createLoyaltyTransaction(
  input: LoyaltyTransactionInput,
): Promise<Result> {
  try {
    const ctx = await requirePermission("customers.edit");
    const invalid = validateLoyalty(input);
    if (invalid) return { success: false, error: invalid };

    const supabase = createAdminClient();
    const { error } = await supabase.from("loyalty_transactions").insert({
      customer_id: input.customerId,
      type: input.type,
      points: signedPoints(input.type, input.points),
      txn_date: input.txnDate,
      note: cleanText(input.note),
      created_by: ctx.userId,
      created_by_email: ctx.email,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function updateLoyaltyTransaction(
  transactionId: string,
  input: LoyaltyTransactionInput,
): Promise<Result> {
  try {
    await requirePermission("customers.edit");
    const invalid = validateLoyalty(input);
    if (invalid) return { success: false, error: invalid };

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("loyalty_transactions")
      .update({
        type: input.type,
        points: signedPoints(input.type, input.points),
        txn_date: input.txnDate,
        note: cleanText(input.note),
      })
      .eq("id", transactionId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function deleteLoyaltyTransaction(
  transactionId: string,
): Promise<Result> {
  try {
    await requirePermission("customers.edit");
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("loyalty_transactions")
      .delete()
      .eq("id", transactionId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
