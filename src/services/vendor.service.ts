"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import {
  getVendorBills,
  getVendorById,
  getVendors,
  getVendorTransactions,
  getVendorTransactionsForVendors,
} from "@/queries/vendor.query";
import {
  mapVendorRow,
  mapVendorTransactionRow,
  toVendorWithBalance,
} from "@/services/vendor-engine";
import { deleteVendorBill } from "@/services/upload.service";
import type {
  Vendor,
  VendorBillStatus,
  VendorInput,
  VendorPurchase,
  VendorTransaction,
  VendorTransactionInput,
  VendorTransactionRow,
  VendorWithBalance,
} from "@/types/vendor.types";

type Result = { success: boolean; error?: string };

function cleanText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toAmount(value: number | undefined | null): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

/** All vendors with their derived outstanding payable, name order. */
export async function fetchVendors(): Promise<VendorWithBalance[]> {
  await requirePermission("vendors.view");
  const rows = await getVendors();
  const vendors = rows.map(mapVendorRow);
  const txns = await getVendorTransactionsForVendors(vendors.map((v) => v.id));

  const byVendor = new Map<string, VendorTransactionRow[]>();
  for (const t of txns) {
    const list = byVendor.get(t.vendor_id) ?? [];
    list.push(t);
    byVendor.set(t.vendor_id, list);
  }
  return vendors.map((v) => toVendorWithBalance(v, byVendor.get(v.id) ?? []));
}

/** Every bill (amount + date) across all vendors, for date-range purchase reports. */
export async function fetchVendorPurchases(): Promise<VendorPurchase[]> {
  await requirePermission("vendors.view");
  const rows = await getVendorBills();
  return rows.map((r) => ({
    vendorId: r.vendor_id,
    amount: r.amount ?? 0,
    txnDate: r.txn_date,
  }));
}

/** A single vendor (or null when it does not exist). */
export async function fetchVendor(id: string): Promise<Vendor | null> {
  await requirePermission("vendors.view");
  const row = await getVendorById(id);
  return row ? mapVendorRow(row) : null;
}

/** A vendor's full ledger, newest first. */
export async function fetchVendorTransactions(
  vendorId: string,
): Promise<VendorTransaction[]> {
  await requirePermission("vendors.view");
  const rows = await getVendorTransactions(vendorId);
  return rows.map(mapVendorTransactionRow);
}

export async function createVendor(input: VendorInput): Promise<Result> {
  try {
    const ctx = await requirePermission("vendors.create");
    const name = input.name.trim();
    if (!name) return { success: false, error: "Vendor name is required." };

    const supabase = createAdminClient();
    const { error } = await supabase.from("vendors").insert({
      name,
      code: cleanText(input.code),
      contact_person: cleanText(input.contactPerson),
      phone: cleanText(input.phone),
      email: cleanText(input.email),
      address: cleanText(input.address),
      pan_number: cleanText(input.panNumber),
      vat_number: cleanText(input.vatNumber),
      opening_balance: toAmount(input.openingBalance),
      notes: cleanText(input.notes),
      is_active: input.isActive ?? true,
      created_by: ctx.userId,
      created_by_email: ctx.email,
    });

    if (error) {
      const message = /duplicate|unique/i.test(error.message)
        ? "A vendor with that code already exists."
        : error.message;
      return { success: false, error: message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function updateVendor(
  vendorId: string,
  input: VendorInput,
): Promise<Result> {
  try {
    await requirePermission("vendors.edit");
    const supabase = createAdminClient();

    const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) return { success: false, error: "Vendor name is required." };
      update.name = name;
    }
    if (input.code !== undefined) update.code = cleanText(input.code);
    if (input.contactPerson !== undefined)
      update.contact_person = cleanText(input.contactPerson);
    if (input.phone !== undefined) update.phone = cleanText(input.phone);
    if (input.email !== undefined) update.email = cleanText(input.email);
    if (input.address !== undefined) update.address = cleanText(input.address);
    if (input.panNumber !== undefined)
      update.pan_number = cleanText(input.panNumber);
    if (input.vatNumber !== undefined)
      update.vat_number = cleanText(input.vatNumber);
    if (input.openingBalance !== undefined)
      update.opening_balance = toAmount(input.openingBalance);
    if (input.notes !== undefined) update.notes = cleanText(input.notes);
    if (input.isActive !== undefined) update.is_active = input.isActive;

    const { error } = await supabase
      .from("vendors")
      .update(update)
      .eq("id", vendorId);

    if (error) {
      const message = /duplicate|unique/i.test(error.message)
        ? "A vendor with that code already exists."
        : error.message;
      return { success: false, error: message };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function deleteVendor(vendorId: string): Promise<Result> {
  try {
    await requirePermission("vendors.delete");
    const supabase = createAdminClient();

    // Refuse to delete a vendor that has ledger history; deactivate instead so
    // the payable record is preserved.
    const { count } = await supabase
      .from("vendor_transactions")
      .select("id", { count: "exact", head: true })
      .eq("vendor_id", vendorId);
    if ((count ?? 0) > 0) {
      return {
        success: false,
        error:
          "This vendor has recorded bills or payments and cannot be deleted. Deactivate it instead.",
      };
    }

    const { error } = await supabase.from("vendors").delete().eq("id", vendorId);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * A bill carries a settlement date only while it is marked paid; an unpaid bill
 * clears it. Falls back to the bill's own date when the caller doesn't say when
 * it was settled.
 */
function billPaidAt(input: VendorTransactionInput): string | null {
  if (input.type !== "bill" || (input.status ?? "unpaid") !== "paid") return null;
  return cleanText(input.paidAt) ?? input.txnDate;
}

function validateTransaction(input: VendorTransactionInput): string | null {
  if (!input.vendorId) return "A vendor is required.";
  if (input.type !== "bill" && input.type !== "payment")
    return "Invalid transaction type.";
  if (!input.txnDate) return "A date is required.";
  if (!Number.isFinite(input.amount) || input.amount <= 0)
    return "Amount must be greater than zero.";
  return null;
}

export async function createVendorTransaction(
  input: VendorTransactionInput,
): Promise<Result> {
  try {
    const ctx = await requirePermission("vendors.edit");
    const invalid = validateTransaction(input);
    if (invalid) return { success: false, error: invalid };

    const isBill = input.type === "bill";
    const supabase = createAdminClient();
    const { error } = await supabase.from("vendor_transactions").insert({
      vendor_id: input.vendorId,
      type: input.type,
      txn_date: input.txnDate,
      bill_number: isBill ? cleanText(input.billNumber) : null,
      reference: cleanText(input.reference),
      subtotal: isBill ? toAmount(input.subtotal) : 0,
      tax_amount: isBill ? toAmount(input.taxAmount) : 0,
      amount: toAmount(input.amount),
      payment_method: isBill ? null : (input.paymentMethod ?? null),
      status: isBill ? (input.status ?? "unpaid") : null,
      paid_at: billPaidAt(input),
      attachments: input.attachments ?? [],
      notes: cleanText(input.notes),
      created_by: ctx.userId,
      created_by_email: ctx.email,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function updateVendorTransaction(
  transactionId: string,
  input: VendorTransactionInput,
): Promise<Result> {
  try {
    await requirePermission("vendors.edit");
    const invalid = validateTransaction(input);
    if (invalid) return { success: false, error: invalid };

    const isBill = input.type === "bill";
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("vendor_transactions")
      .update({
        type: input.type,
        txn_date: input.txnDate,
        bill_number: isBill ? cleanText(input.billNumber) : null,
        reference: cleanText(input.reference),
        subtotal: isBill ? toAmount(input.subtotal) : 0,
        tax_amount: isBill ? toAmount(input.taxAmount) : 0,
        amount: toAmount(input.amount),
        payment_method: isBill ? null : (input.paymentMethod ?? null),
        status: isBill ? (input.status ?? "unpaid") : null,
        attachments: input.attachments ?? [],
        notes: cleanText(input.notes),
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/**
 * Flip a bill's settlement status straight from the ledger (no full edit). A
 * bill marked "paid" is treated as settled at source and drops out of the
 * vendor's outstanding payable, so no separate payment row is written.
 */
export async function setVendorBillStatus(
  transactionId: string,
  status: VendorBillStatus,
  paidAt?: string | null,
): Promise<Result> {
  try {
    await requirePermission("vendors.edit");
    const supabase = createAdminClient();

    const { data } = await supabase
      .from("vendor_transactions")
      .select("type, txn_date")
      .eq("id", transactionId)
      .maybeSingle();
    const row = data as { type: string; txn_date: string } | null;
    if (!row) return { success: false, error: "That entry no longer exists." };
    if (row.type !== "bill")
      return { success: false, error: "Only bills have a settlement status." };

    const { error } = await supabase
      .from("vendor_transactions")
      .update({
        status,
        paid_at:
          status === "paid" ? (cleanText(paidAt) ?? row.txn_date) : null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", transactionId);

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function deleteVendorTransaction(
  transactionId: string,
): Promise<Result> {
  try {
    await requirePermission("vendors.edit");
    const supabase = createAdminClient();

    // Fetch the row first so its bill attachments can be cleaned from storage.
    const { data } = await supabase
      .from("vendor_transactions")
      .select("attachments")
      .eq("id", transactionId)
      .maybeSingle();

    const { error } = await supabase
      .from("vendor_transactions")
      .delete()
      .eq("id", transactionId);
    if (error) return { success: false, error: error.message };

    const attachments = (data as { attachments: { url: string }[] } | null)
      ?.attachments;
    if (Array.isArray(attachments)) {
      await Promise.all(
        attachments.map((a) => deleteVendorBill(a.url).catch(() => undefined)),
      );
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
