"use client";

import { useState } from "react";
import { FolderTree, Pencil, Plus, Tag, Trash2 } from "lucide-react";
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from "@/hooks/categories/use-categories";
import { useConfirm } from "@/components/molecules/confirm-dialog/confirm-context";
import {
  ActionMenu,
  type ActionMenuItem,
} from "@/components/molecules/action-menu/ActionMenu";
import { EmptyState, PageHeader } from "@/components/molecules/admin";
import { Modal } from "@/components/molecules/modal/Modal";
import { Field, TextInput } from "@/components/molecules/form";
import { notify } from "@/lib/toast";
import type { Category } from "@/types/product.types";

interface CategoryManagerProps {
  initialCategories: Category[];
  /** Titles of the products assigned to each category, keyed by category id. */
  categoryProducts: Record<string, string[]>;
  can: { create: boolean; edit: boolean; delete: boolean };
}

export function CategoryManager({
  initialCategories,
  categoryProducts,
  can,
}: CategoryManagerProps) {
  const { data: categories = initialCategories } = useCategories(initialCategories);
  const deleteCategory = useDeleteCategory();
  const confirm = useConfirm();

  // `formOpen` controls visibility; `editing` null = create mode.
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(category: Category) {
    setEditing(category);
    setFormOpen(true);
  }

  async function handleDelete(category: Category) {
    const count = (categoryProducts[category.id] ?? []).length;
    const ok = await confirm({
      title: "Delete category",
      description: (
        <>
          Delete{" "}
          <span className="font-semibold text-admin-text">{category.name}</span>?
          {count > 0 ? (
            <>
              {" "}
              {count} product{count === 1 ? "" : "s"} associated with this
              category will become uncategorized. The product
              {count === 1 ? " itself is" : "s themselves are"} not deleted.
            </>
          ) : (
            " This cannot be undone."
          )}
        </>
      ),
      confirmLabel: "Delete category",
      destructive: true,
    });
    if (!ok) return;

    deleteCategory.mutate(category.id, {
      onSuccess: () => notify.success("Category deleted."),
    });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title="Categories"
        description="Group your products into parent categories like Pants, Shirts, or Shoes."
        actions={
          can.create && (
            <button
              type="button"
              onClick={openCreate}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-admin-accent-hover"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add Category
            </button>
          )
        }
      />

      {categories.length === 0 ? (
        <EmptyState
          icon={FolderTree}
          title="No categories yet"
          description="Create your first category to start organizing your products."
          action={
            can.create && (
              <button
                type="button"
                onClick={openCreate}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Add Category
              </button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
          <div className="hidden border-b border-admin-border bg-admin-card/40 px-5 py-3 sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
            <p className="col-span-1 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">S.N</p>
            <p className="col-span-6 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Category</p>
            <p className="col-span-3 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Products</p>
            <p className="col-span-2 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Actions</p>
          </div>

          <div className="divide-y divide-admin-border">
            {categories.map((category, i) => {
              const count = (categoryProducts[category.id] ?? []).length;
              return (
                <div
                  key={category.id}
                  className="grid grid-cols-1 gap-3 px-5 py-3.5 transition-colors hover:bg-admin-card/30 sm:grid-cols-12 sm:items-center sm:gap-4"
                >
                  <div className="col-span-1 text-sm font-bold text-admin-text-muted">
                    {i + 1}
                  </div>

                  <div className="col-span-6 flex items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-admin-accent/10 text-admin-accent">
                      <Tag className="h-4 w-4" />
                    </span>
                    <p className="truncate text-sm font-bold text-admin-text">{category.name}</p>
                  </div>

                  <div className="col-span-3">
                    <span className="inline-flex rounded-lg bg-admin-card px-2.5 py-1 text-xs font-bold text-admin-text">
                      {count} product{count === 1 ? "" : "s"}
                    </span>
                  </div>

                  <div className="col-span-2 flex items-center justify-end gap-1">
                    {!can.edit && !can.delete && (
                      <span className="text-[11px] italic text-admin-text-muted">View only</span>
                    )}
                    <ActionMenu
                      label={`Actions for ${category.name}`}
                      items={[
                        {
                          key: "edit",
                          label: "Edit category",
                          icon: Pencil,
                          onSelect: () => openEdit(category),
                          hidden: !can.edit,
                        },
                        {
                          key: "delete",
                          label: "Delete category",
                          icon: Trash2,
                          onSelect: () => handleDelete(category),
                          disabled: deleteCategory.isPending,
                          destructive: true,
                          hidden: !can.delete,
                        },
                      ] satisfies ActionMenuItem[]}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {formOpen && (
        <CategoryFormModal
          key={editing?.id ?? "new"}
          category={editing}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}

interface CategoryFormModalProps {
  onClose: () => void;
  /** When provided the modal edits this category; otherwise it creates a new one. */
  category?: Category | null;
}

function CategoryFormModal({ onClose, category }: CategoryFormModalProps) {
  const isEdit = Boolean(category);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const pending = createCategory.isPending || updateCategory.isPending;

  const [name, setName] = useState(category?.name ?? "");

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) {
      notify.error("Category name is required.");
      return;
    }

    const action = isEdit
      ? updateCategory.mutateAsync({ id: category!.id, data: { name: trimmed } })
      : createCategory.mutateAsync({ name: trimmed });

    action
      .then(() => {
        notify.success(isEdit ? "Category updated." : "Category created.");
        onClose();
      })
      .catch(() => {
        // Error toast handled by the mutation's onError; keep the form open.
      });
  }

  return (
    <Modal
      open
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
      size="sm"
      title={isEdit ? "Edit category" : "New category"}
      description={
        isEdit ? "Rename this category." : "Add a category to group products under."
      }
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={pending}
            className="rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-text-secondary transition-colors hover:bg-admin-card disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={pending}
            className="rounded-xl bg-admin-accent px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover disabled:opacity-40"
          >
            {pending ? "Saving..." : isEdit ? "Save changes" : "Create category"}
          </button>
        </>
      }
    >
      <Field label="Category name" required>
        {(p) => (
          <TextInput
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Shirts"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSubmit();
            }}
            {...p}
          />
        )}
      </Field>
    </Modal>
  );
}
