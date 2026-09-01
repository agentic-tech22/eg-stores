"use server";

import { createAdminClient, createServerSupabaseClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { getComboItems, getComboItemsForCombos, getCombos } from "@/queries/combo.query";
import { getProducts } from "@/queries/product.query";
import type {
  ComboItem,
  ComboItemRow,
  ComboWithItems,
  Product,
  ProductRow,
} from "@/types/product.types";

// Local row → Product mapper. (product.service's mapper is internal to a
// "use server" module and can't be re-exported, so combos map their own rows.)
function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    sku: row.sku,
    price: row.price,
    costPrice: row.cost_price,
    imageUrl: row.image_url,
    images: row.images ?? [],
    isFeatured: row.is_featured,
    isVisible: row.is_visible,
    isCombo: row.is_combo,
    sortOrder: row.sort_order,
    categoryId: row.category_id,
    barcode: row.barcode,
    hasVariants: row.has_variants,
    stockQuantity: row.stock_quantity,
    reservedQuantity: row.reserved_quantity,
    available: row.stock_quantity - row.reserved_quantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Fetch the component products for a set of combo_items, keyed by id. */
async function fetchComponents(
  itemRows: ComboItemRow[],
): Promise<Map<string, Product>> {
  const ids = [...new Set(itemRows.map((r) => r.component_id))];
  if (ids.length === 0) return new Map();
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase.from("products").select("*").in("id", ids);
  const map = new Map<string, Product>();
  for (const row of (data ?? []) as ProductRow[]) {
    map.set(row.id, mapProductRow(row));
  }
  return map;
}

/**
 * Assemble a ComboWithItems from a combo product row, its component rows, and a
 * lookup of component products. Derives availability (min over components of
 * floor(available / qty)) and the pre-discount original price.
 */
function assembleCombo(
  comboRow: ProductRow,
  itemRows: ComboItemRow[],
  components: Map<string, Product>,
): ComboWithItems {
  const base = mapProductRow(comboRow);

  const items: ComboItem[] = itemRows.map((r) => ({
    id: r.id,
    comboId: r.combo_id,
    componentId: r.component_id,
    quantity: r.quantity,
    component: components.get(r.component_id),
  }));

  let originalPrice = 0;
  let available = items.length > 0 ? Infinity : 0;
  for (const item of items) {
    const c = item.component;
    if (!c) {
      available = 0;
      continue;
    }
    originalPrice += c.price * item.quantity;
    available = Math.min(available, Math.floor(c.available / item.quantity));
  }
  if (!Number.isFinite(available)) available = 0;
  available = Math.max(0, available);

  return {
    ...base,
    available, // override: combos derive availability from components
    comboAvailable: available,
    originalPrice,
    items,
  };
}

/** Admin list of all combos with components + derived availability. */
export async function fetchCombos(): Promise<ComboWithItems[]> {
  await requirePermission("products.view");
  const comboRows = await getCombos();
  if (comboRows.length === 0) return [];

  const itemRows = await getComboItemsForCombos(comboRows.map((c) => c.id));
  const components = await fetchComponents(itemRows);

  const byCombo = new Map<string, ComboItemRow[]>();
  for (const r of itemRows) {
    const arr = byCombo.get(r.combo_id);
    if (arr) arr.push(r);
    else byCombo.set(r.combo_id, [r]);
  }

  return comboRows.map((c) =>
    assembleCombo(c, byCombo.get(c.id) ?? [], components),
  );
}

/**
 * One combo with its components. Public (storefront detail): no permission
 * check. Returns null if the id is not a combo product.
 */
export async function fetchComboWithItems(
  id: string,
): Promise<ComboWithItems | null> {
  const supabase = await createServerSupabaseClient();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("id", id)
    .eq("is_combo", true)
    .single();
  if (!data) return null;

  const comboRow = data as ProductRow;
  const itemRows = await getComboItems(id);
  const components = await fetchComponents(itemRows);
  return assembleCombo(comboRow, itemRows, components);
}

/**
 * Simple products (non-variant, non-combo) eligible to be combo components.
 * Gated by products.view so the Combos page can populate its component picker.
 */
export async function fetchSimpleProducts(): Promise<Product[]> {
  await requirePermission("products.view");
  const rows = await getProducts();
  return rows
    .filter((r) => !r.is_combo && !r.has_variants)
    .map(mapProductRow);
}

/** A combo component as submitted from the combo form. */
export interface ComboItemInput {
  componentId: string;
  quantity: number;
}

interface ComboInput {
  title: string;
  description?: string;
  price: number;
  imageUrl?: string;
  images?: string[];
  isFeatured?: boolean;
  isVisible?: boolean;
  items: ComboItemInput[];
}

type SupabaseAdmin = ReturnType<typeof createAdminClient>;

/**
 * Validate combo components: at least two, all referencing existing simple
 * products (not variant products, not other combos). Returns normalized rows.
 */
async function validateComboItems(
  supabase: SupabaseAdmin,
  items: ComboItemInput[],
): Promise<{ rows?: { component_id: string; quantity: number }[]; error?: string }> {
  const cleaned = items
    .map((it) => ({ component_id: it.componentId, quantity: Math.floor(it.quantity) }))
    .filter((it) => it.component_id && it.quantity > 0);

  if (cleaned.length < 2) {
    return { error: "A combo needs at least two component products." };
  }
  const ids = cleaned.map((it) => it.component_id);
  if (new Set(ids).size !== ids.length) {
    return { error: "Each product can be added to a combo only once." };
  }

  const { data } = await supabase
    .from("products")
    .select("id, has_variants, is_combo")
    .in("id", ids);
  const found = (data ?? []) as { id: string; has_variants: boolean; is_combo: boolean }[];
  if (found.length !== ids.length) {
    return { error: "One or more selected products no longer exist." };
  }
  if (found.some((p) => p.is_combo)) {
    return { error: "A combo cannot contain another combo." };
  }
  if (found.some((p) => p.has_variants)) {
    return { error: "Combos can only contain simple products (no variants)." };
  }

  return { rows: cleaned };
}

export async function createCombo(
  data: ComboInput,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("products.create");
    if (!data.title?.trim()) return { success: false, error: "Title is required." };
    if (!(data.price >= 0)) return { success: false, error: "Enter a valid combo price." };

    const supabase = createAdminClient();
    const validated = await validateComboItems(supabase, data.items);
    if (validated.error || !validated.rows) {
      return { success: false, error: validated.error };
    }

    const { data: inserted, error } = await supabase
      .from("products")
      .insert({
        title: data.title.trim(),
        description: data.description ?? null,
        price: data.price,
        cost_price: 0,
        image_url: data.imageUrl ?? null,
        images: data.images ?? [],
        is_featured: data.isFeatured ?? false,
        is_visible: data.isVisible ?? true,
        is_combo: true,
        has_variants: false,
        stock_quantity: 0,
      })
      .select("id")
      .single();

    if (error || !inserted) {
      return { success: false, error: error?.message ?? "Insert failed" };
    }

    const comboId = (inserted as { id: string }).id;
    const { error: itemsError } = await supabase.from("combo_items").insert(
      validated.rows.map((r) => ({ combo_id: comboId, ...r })),
    );
    if (itemsError) {
      // Roll back the half-created combo so we don't leave an empty bundle.
      await supabase.from("products").delete().eq("id", comboId);
      return { success: false, error: itemsError.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function updateCombo(
  comboId: string,
  data: Partial<ComboInput>,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("products.edit");
    const supabase = createAdminClient();

    const updateData: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (data.title !== undefined) updateData.title = data.title.trim();
    if (data.description !== undefined) updateData.description = data.description;
    if (data.price !== undefined) {
      if (!(data.price >= 0)) return { success: false, error: "Enter a valid combo price." };
      updateData.price = data.price;
    }
    if (data.imageUrl !== undefined) updateData.image_url = data.imageUrl;
    if (data.images !== undefined) updateData.images = data.images;
    if (data.isFeatured !== undefined) updateData.is_featured = data.isFeatured;
    if (data.isVisible !== undefined) updateData.is_visible = data.isVisible;

    const { error } = await supabase
      .from("products")
      .update(updateData)
      .eq("id", comboId)
      .eq("is_combo", true);
    if (error) return { success: false, error: error.message };

    // Replace the component set wholesale when provided.
    if (data.items !== undefined) {
      const validated = await validateComboItems(supabase, data.items);
      if (validated.error || !validated.rows) {
        return { success: false, error: validated.error };
      }
      await supabase.from("combo_items").delete().eq("combo_id", comboId);
      const { error: itemsError } = await supabase.from("combo_items").insert(
        validated.rows.map((r) => ({ combo_id: comboId, ...r })),
      );
      if (itemsError) return { success: false, error: itemsError.message };
    }

    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function deleteCombo(
  comboId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("products.delete");
    const supabase = createAdminClient();
    // combo_items cascade on the combo's product row.
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", comboId)
      .eq("is_combo", true);
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}
