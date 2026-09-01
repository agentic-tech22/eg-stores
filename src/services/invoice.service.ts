"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { requireAuth, requirePermission } from "@/lib/auth/session";
import {
  getBusinessProfile,
  getInvoiceById,
  getInvoiceBySaleId,
  getInvoices,
} from "@/queries/invoice.query";
import { getSaleById } from "@/queries/sale.query";
import {
  formatInvoiceNumber,
  type BusinessProfile,
  type BusinessProfileInput,
  type BusinessProfileRow,
  type Invoice,
  type InvoiceItem,
  type InvoiceItemRow,
  type InvoiceRow,
  type InvoiceStatus,
} from "@/types/invoice.types";

function mapInvoiceItemRow(row: InvoiceItemRow): InvoiceItem {
  return {
    id: row.id,
    invoiceId: row.invoice_id,
    productTitle: row.product_title,
    variantLabel: row.variant_label,
    sku: row.sku,
    quantity: row.quantity,
    unitPrice: row.unit_price,
    lineTotal: row.line_total,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function mapInvoiceRow(row: InvoiceRow): Invoice {
  const items = (row.invoice_items ?? [])
    .map(mapInvoiceItemRow)
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return {
    id: row.id,
    saleId: row.sale_id,
    invoiceNumber: row.invoice_number,
    issueDate: row.issue_date,
    dueDate: row.due_date,
    status: row.status,
    subtotal: row.subtotal,
    discountAmount: row.discount_amount,
    totalAmount: row.total_amount,
    customerName: row.customer_name,
    customerPhone: row.customer_phone,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    items,
  };
}

function mapBusinessProfileRow(row: BusinessProfileRow): BusinessProfile {
  return {
    shopName: row.shop_name,
    address: row.address,
    phone: row.phone,
    email: row.email,
    taxId: row.tax_id,
    logoUrl: row.logo_url,
    currency: row.currency,
    invoicePrefix: row.invoice_prefix,
    invoiceFooter: row.invoice_footer,
    nextInvoiceNumber: row.next_invoice_number,
    loyaltyEnabled: row.loyalty_enabled ?? false,
    loyaltyEarnMode: row.loyalty_earn_mode ?? "percent",
    loyaltyEarnRate: row.loyalty_earn_rate ?? 0,
    updatedAt: row.updated_at,
  };
}

export async function fetchInvoices(): Promise<Invoice[]> {
  await requirePermission("invoices.view");
  const rows = await getInvoices();
  return rows.map(mapInvoiceRow);
}

export async function fetchInvoiceById(id: string): Promise<Invoice | null> {
  await requirePermission("invoices.view");
  const row = await getInvoiceById(id);
  return row ? mapInvoiceRow(row) : null;
}

export async function fetchInvoiceForSale(
  saleId: string,
): Promise<Invoice | null> {
  await requirePermission("sales.view");
  const row = await getInvoiceBySaleId(saleId);
  return row ? mapInvoiceRow(row) : null;
}

/** Shop identity for invoice rendering: readable by any signed-in admin/member. */
export async function fetchBusinessProfile(): Promise<BusinessProfile | null> {
  await requireAuth();
  const row = await getBusinessProfile();
  return row ? mapBusinessProfileRow(row) : null;
}

/**
 * Generate an invoice from a sale. Idempotent: if one already exists for the
 * sale it is returned unchanged. Requires the business profile to be set up
 * (a shop name) so the invoice has a header. Line items, amounts, and customer
 * info are snapshotted so the invoice never drifts if the sale changes later.
 */
export async function generateInvoiceForSale(saleId: string): Promise<{
  success: boolean;
  error?: string;
  invoiceId?: string;
  warning?: string;
}> {
  try {
    await requirePermission("invoices.generate");
    const supabase = createAdminClient();

    // Idempotency: one invoice per sale.
    const existing = await getInvoiceBySaleId(saleId);
    if (existing) return { success: true, invoiceId: existing.id };

    const sale = await getSaleById(saleId);
    if (!sale) return { success: false, error: "Sale not found." };

    const profileRow = await getBusinessProfile();
    if (!profileRow?.shop_name?.trim()) {
      return {
        success: false,
        error:
          "Set up your business profile (shop name) before generating invoices.",
      };
    }

    // Atomically claim the next invoice number.
    const { data: claimed, error: claimError } = await supabase.rpc(
      "claim_invoice_number",
    );
    if (claimError || claimed == null) {
      return {
        success: false,
        error: claimError?.message ?? "Could not allocate an invoice number.",
      };
    }
    const invoiceNumber = formatInvoiceNumber(
      profileRow.invoice_prefix,
      claimed as number,
    );

    // The invoice is the customer's bill, so it lists everything they were
    // charged for: catalog lines first, then the extra (non-catalog) lines.
    // Those live in their own table for reporting reasons only — leaving them
    // off here would make the invoice subtotal disagree with the sale total.
    const items = [
      ...(sale.sale_items ?? []).map((it) => ({
        product_title: it.product_title,
        variant_label: it.variant_label,
        sku: it.sku,
        quantity: it.quantity,
        unit_price: it.unit_price,
        line_total: it.line_total,
      })),
      ...(sale.extra_sale_items ?? []).map((it) => ({
        product_title: it.title,
        variant_label: null,
        sku: null,
        quantity: it.quantity,
        unit_price: it.unit_price,
        line_total: it.line_total,
      })),
    ];
    const subtotal = items.reduce((sum, it) => sum + it.line_total, 0);

    // Issue the invoice paid when the sale is already settled at generation time
    // (Fonepay, via its QR callback). Other methods are still 'pending' here and
    // are confirmed by the cashier in the post-sale prompt, which marks both the
    // sale and this invoice paid.
    const invoiceStatus = sale.payment_status === "paid" ? "paid" : "issued";

    const { data: invoiceRow, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        sale_id: sale.id,
        invoice_number: invoiceNumber,
        status: invoiceStatus,
        subtotal,
        discount_amount: sale.discount_amount,
        total_amount: sale.total,
        customer_name: sale.customer_name,
        customer_phone: sale.customer_phone,
        notes: sale.notes,
      })
      .select("id")
      .single();

    if (invoiceError || !invoiceRow) {
      return {
        success: false,
        error: invoiceError?.message ?? "Could not create the invoice.",
      };
    }

    const invoiceId = (invoiceRow as { id: string }).id;

    // Snapshot the line items. Non-fatal: the invoice header still stands.
    let warning: string | undefined;
    if (items.length > 0) {
      const { error: itemsError } = await supabase.from("invoice_items").insert(
        items.map((it, index) => ({
          invoice_id: invoiceId,
          product_title: it.product_title,
          variant_label: it.variant_label,
          sku: it.sku,
          quantity: it.quantity,
          unit_price: it.unit_price,
          line_total: it.line_total,
          sort_order: index,
        })),
      );
      if (itemsError) {
        warning = "The invoice was created but its line items failed to save.";
      }
    }

    return { success: true, invoiceId, warning };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("invoices.edit");
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("invoices")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    return error ? { success: false, error: error.message } : { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function deleteInvoice(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("invoices.delete");
    const supabase = createAdminClient();
    const { error } = await supabase.from("invoices").delete().eq("id", id);
    return error ? { success: false, error: error.message } : { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function upsertBusinessProfile(
  input: BusinessProfileInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("settings.business");
    if (!input.shopName?.trim()) {
      return { success: false, error: "Shop name is required." };
    }
    const supabase = createAdminClient();
    const { error } = await supabase.from("business_profile").upsert(
      {
        id: true,
        shop_name: input.shopName.trim(),
        address: input.address?.trim() || null,
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        tax_id: input.taxId?.trim() || null,
        logo_url: input.logoUrl?.trim() || null,
        currency: input.currency?.trim() || "NPR",
        invoice_prefix: input.invoicePrefix?.trim() || "INV",
        invoice_footer: input.invoiceFooter?.trim() || null,
        loyalty_enabled: input.loyaltyEnabled ?? false,
        loyalty_earn_mode: input.loyaltyEarnMode ?? "percent",
        loyalty_earn_rate:
          input.loyaltyEarnRate != null && Number.isFinite(input.loyaltyEarnRate)
            ? Math.max(0, input.loyaltyEarnRate)
            : 0,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
    return error ? { success: false, error: error.message } : { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
