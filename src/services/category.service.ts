"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { requirePermission } from "@/lib/auth/session";
import { getCategories } from "@/queries/category.query";
import type { Category, CategoryRow } from "@/types/product.types";

function mapCategoryRow(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** All categories, ordered by sort order. Shared with the storefront. */
export async function fetchCategories(): Promise<Category[]> {
  const rows = await getCategories();
  return rows.map(mapCategoryRow);
}

export async function createCategory(data: {
  name: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("products.create");

    const name = data.name.trim();
    if (!name) {
      return { success: false, error: "Category name is required." };
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from("categories").insert({ name });

    if (error) {
      // Surface the unique-name constraint as a friendly message.
      const message = /duplicate|unique/i.test(error.message)
        ? "A category with that name already exists."
        : error.message;
      return { success: false, error: message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function updateCategory(
  categoryId: string,
  data: { name: string },
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("products.edit");

    const name = data.name.trim();
    if (!name) {
      return { success: false, error: "Category name is required." };
    }

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("categories")
      .update({ name, updated_at: new Date().toISOString() })
      .eq("id", categoryId);

    if (error) {
      const message = /duplicate|unique/i.test(error.message)
        ? "A category with that name already exists."
        : error.message;
      return { success: false, error: message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}

export async function deleteCategory(
  categoryId: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    await requirePermission("products.delete");
    const supabase = createAdminClient();

    // Products keep existing; their category_id is set NULL by the FK's
    // ON DELETE SET NULL, so they simply become uncategorized.
    const { error } = await supabase
      .from("categories")
      .delete()
      .eq("id", categoryId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
