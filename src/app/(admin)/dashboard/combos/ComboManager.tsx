"use client";

import { useState } from "react";
import {
  EyeOff,
  ImageIcon,
  Layers,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { useCombos } from "@/hooks/combos/use-combos";
import {
  useDeleteCombo,
  useToggleComboFeatured,
} from "@/hooks/combos/use-combo-mutations";
import { useConfirm } from "@/components/molecules/confirm-dialog/confirm-context";
import {
  ActionMenu,
  type ActionMenuItem,
} from "@/components/molecules/action-menu/ActionMenu";
import { EmptyState, PageHeader, Pagination, StatCard, TableRowsSkeleton } from "@/components/molecules/admin";
import { deleteProductImage } from "@/services/upload.service";
import { notify } from "@/lib/toast";
import type { ComboWithItems, Product } from "@/types/product.types";
import { formatCurrency } from "@/utils/format-currency";
import { ComboFormModal } from "./ComboFormModal";

const ITEMS_PER_PAGE = 8;

interface ComboManagerProps {
  initialCombos: ComboWithItems[];
  products: Product[];
  currency: { code: string; locale: string };
  can: { create: boolean; edit: boolean; delete: boolean };
}

export function ComboManager({
  initialCombos,
  products,
  currency,
  can,
}: ComboManagerProps) {
  const { data: combos, isFetching } = useCombos(initialCombos);

  const toggleFeatured = useToggleComboFeatured();
  const deleteCombo = useDeleteCombo();
  const confirm = useConfirm();

  const [filterText, setFilterText] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ComboWithItems | null>(null);

  const featuredCount = combos.filter((c) => c.isFeatured).length;
  const filtered = combos.filter((c) =>
    c.title.toLowerCase().includes(filterText.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(combo: ComboWithItems) {
    setEditing(combo);
    setFormOpen(true);
  }

  function handleToggleFeatured(combo: ComboWithItems) {
    toggleFeatured.mutate({ id: combo.id, isFeatured: !combo.isFeatured });
  }

  async function handleDelete(combo: ComboWithItems) {
    const ok = await confirm({
      title: "Delete combo",
      description: (
        <>
          Delete{" "}
          <span className="font-semibold text-admin-text">{combo.title}</span>?
          This removes the combo and its images. Component products are not
          affected. This cannot be undone.
        </>
      ),
      confirmLabel: "Delete combo",
      destructive: true,
    });
    if (!ok) return;

    if (combo.imageUrl) await deleteProductImage(combo.imageUrl);
    for (const img of combo.images ?? []) await deleteProductImage(img);
    deleteCombo.mutate(combo.id, {
      onSuccess: () => notify.success("Combo deleted."),
    });
  }

  const busy = toggleFeatured.isPending || deleteCombo.isPending;

  function savingsPct(combo: ComboWithItems): number {
    if (combo.originalPrice <= 0) return 0;
    return Math.round(((combo.originalPrice - combo.price) / combo.originalPrice) * 100);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title="Combos"
        description="Bundle products together at a discounted price and list them on your storefront."
        actions={
          can.create && (
            <button
              type="button"
              onClick={openCreate}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-admin-accent-hover"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add Combo
            </button>
          )
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-4">
        <StatCard label="Total Combos" value={combos.length} icon={Layers} />
        <StatCard
          label="Featured"
          value={featuredCount}
          icon={Star}
          tone="amber"
          hint={`of ${combos.length} total`}
        />
      </div>

      <div className="mb-6 flex h-11 items-center gap-2 rounded-xl border border-admin-border bg-admin-surface px-3.5">
        <Search className="h-4 w-4 shrink-0 text-admin-text-muted" />
        <input
          type="text"
          value={filterText}
          onChange={(e) => {
            setFilterText(e.target.value);
            setCurrentPage(1);
          }}
          placeholder="Search combos by name..."
          aria-label="Filter combos by name"
          className="h-full w-full bg-transparent text-sm text-admin-text placeholder:text-admin-text-muted focus:outline-none"
        />
      </div>

      {combos.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No combos yet"
          description="Create your first combo to bundle products at a discount."
          action={
            can.create && (
              <button
                type="button"
                onClick={openCreate}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Add Combo
              </button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
          <div className="hidden border-b border-admin-border bg-admin-card/40 px-5 py-3 sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
            <p className="col-span-1 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">S.N</p>
            <p className="col-span-3 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Combo</p>
            <p className="col-span-3 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Price</p>
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Stock</p>
            <p className="col-span-1 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Status</p>
            <p className="col-span-2 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Actions</p>
          </div>

          {isFetching && combos.length === 0 ? (
            <TableRowsSkeleton />
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-admin-text-muted">
              No combos match &ldquo;{filterText}&rdquo;.
            </div>
          ) : (
            <div className="divide-y divide-admin-border">
              {paginated.map((combo, i) => (
                <div
                  key={combo.id}
                  className="grid grid-cols-1 gap-3 px-5 py-3.5 transition-colors hover:bg-admin-card/30 sm:grid-cols-12 sm:items-center sm:gap-4"
                >
                  {/* S.N */}
                  <div className="col-span-1 text-sm font-bold text-admin-text-muted">
                    {(safePage - 1) * ITEMS_PER_PAGE + i + 1}
                  </div>

                  {/* Combo */}
                  <div className="col-span-3 flex items-center gap-3">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-admin-border bg-admin-card">
                      {combo.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={combo.imageUrl} alt={combo.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-admin-text-muted">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-admin-text">{combo.title}</p>
                      <p className="truncate text-[11px] text-admin-text-muted">
                        {combo.items
                          .map((it) => `${it.quantity}× ${it.component?.title ?? "N/A"}`)
                          .join(", ")}
                      </p>
                    </div>
                  </div>

                  {/* Price */}
                  <div className="col-span-3 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="inline-flex shrink-0 rounded-lg bg-admin-card px-2.5 py-1 text-xs font-bold text-admin-text">
                      {formatCurrency(combo.price, currency.code, currency.locale)}
                    </span>
                    {combo.originalPrice > combo.price && (
                      <>
                        <span className="shrink-0 text-[11px] text-admin-text-muted line-through">
                          {formatCurrency(combo.originalPrice, currency.code, currency.locale)}
                        </span>
                        <span className="inline-flex shrink-0 items-center rounded-full bg-admin-success/12 px-2 py-0.5 text-[10px] font-bold text-admin-success">
                          -{savingsPct(combo)}%
                        </span>
                      </>
                    )}
                  </div>

                  {/* Stock (derived) */}
                  <div className="col-span-2">
                    <span className="text-sm font-bold text-admin-text">{combo.comboAvailable}</span>
                    <span className="ml-1.5 text-[11px] text-admin-text-muted">available</span>
                  </div>

                  {/* Status */}
                  <div className="col-span-1 flex flex-col gap-1">
                    {combo.isFeatured && (
                      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-admin-accent/12 px-2 py-0.5 text-[10px] font-bold text-admin-accent">
                        <Star className="h-3 w-3" fill="currentColor" />
                        Featured
                      </span>
                    )}
                    {!combo.isVisible && (
                      <span className="inline-flex w-fit items-center gap-1 rounded-full bg-admin-text-muted/15 px-2 py-0.5 text-[10px] font-bold text-admin-text-muted">
                        <EyeOff className="h-3 w-3" />
                        Hidden
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    {!can.edit && !can.delete && (
                      <span className="text-[11px] italic text-admin-text-muted">View only</span>
                    )}
                    <ActionMenu
                      label={`Actions for ${combo.title}`}
                      items={[
                        {
                          key: "feature",
                          label: combo.isFeatured
                            ? "Remove from featured"
                            : "Mark as featured",
                          icon: Star,
                          onSelect: () => handleToggleFeatured(combo),
                          disabled: busy,
                          hidden: !can.edit,
                        },
                        {
                          key: "edit",
                          label: "Edit combo",
                          icon: Pencil,
                          onSelect: () => openEdit(combo),
                          hidden: !can.edit,
                        },
                        {
                          key: "delete",
                          label: "Delete combo",
                          icon: Trash2,
                          onSelect: () => handleDelete(combo),
                          disabled: busy,
                          destructive: true,
                          hidden: !can.delete,
                        },
                      ] satisfies ActionMenuItem[]}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}

          <Pagination
            page={safePage}
            totalPages={totalPages}
            totalItems={filtered.length}
            pageSize={ITEMS_PER_PAGE}
            itemLabel="combos"
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {formOpen && (
        <ComboFormModal
          key={editing?.id ?? "new"}
          open
          combo={editing}
          products={products}
          currency={currency}
          onClose={() => setFormOpen(false)}
        />
      )}
    </div>
  );
}
