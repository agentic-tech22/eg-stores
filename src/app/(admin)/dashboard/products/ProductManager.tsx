"use client";

import { useState } from "react";
import {
  Clock,
  Eye,
  ImageIcon,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Wallet,
} from "lucide-react";
import { useAdminProducts } from "@/hooks/products/use-products";
import {
  useDeleteProduct,
  useToggleFeatured,
} from "@/hooks/products/use-product-mutations";
import { useCategories } from "@/hooks/categories/use-categories";
import { useConfirm } from "@/components/molecules/confirm-dialog/confirm-context";
import { ActionMenu, type ActionMenuItem } from "@/components/molecules/action-menu/ActionMenu";
import { EmptyState, PageHeader, Pagination, RowLink, StatCard, TableRowsSkeleton } from "@/components/molecules/admin";
import { Select } from "@/components/molecules/form";
import { deleteProductImage } from "@/services/upload.service";
import { notify } from "@/lib/toast";
import type { Product } from "@/types/product.types";
import { formatCurrency } from "@/utils/format-currency";
import { ProductFormModal } from "./ProductFormModal";
import { RestockModal } from "./RestockModal";
import { HistoryModal } from "./HistoryModal";

const ITEMS_PER_PAGE = 8;

interface ProductManagerProps {
  initialProducts: Product[];
  variantStock: Record<string, { total: number; available: number }>;
  currency: { code: string; locale: string };
  can: {
    create: boolean;
    edit: boolean;
    delete: boolean;
    viewFinances: boolean;
  };
}

export function ProductManager({
  initialProducts,
  variantStock: initialVariantStock,
  currency,
  can,
}: ProductManagerProps) {
  // Refetches through fetchProductsWithStock, so variant stock stays live after
  // a sale rather than being pinned to whatever the server rendered.
  const { data, isFetching } = useAdminProducts({
    products: initialProducts,
    variantStock: initialVariantStock,
  });
  const { products, variantStock } = data;
  const { data: categories = [] } = useCategories();
  const categoryName = new Map(categories.map((c) => [c.id, c.name]));

  function effectiveStock(product: Product): number {
    if (product.hasVariants) return variantStock[product.id]?.total ?? 0;
    return product.stockQuantity;
  }

  const toggleFeatured = useToggleFeatured();
  const deleteProductMutation = useDeleteProduct();
  const confirm = useConfirm();

  const [filterText, setFilterText] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal: `formOpen` controls visibility; `editingProduct` null = create mode.
  const [formOpen, setFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Restock + history modals are keyed by the product they target (null = closed).
  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [historyProduct, setHistoryProduct] = useState<Product | null>(null);

  const featuredCount = products.filter((p) => p.isFeatured).length;
  // Inventory value at cost: cost price × on-hand stock (variant-aware). Combos
  // carry no stock of their own, so they contribute nothing.
  const inventoryValue = products.reduce(
    (sum, p) => sum + p.costPrice * effectiveStock(p),
    0,
  );
  const filtered = products.filter((p) => {
    const q = filterText.toLowerCase();
    const matchesText =
      p.title.toLowerCase().includes(q) ||
      (p.sku ?? "").toLowerCase().includes(q);
    const matchesCategory =
      categoryFilter === "" ||
      (categoryFilter === "none"
        ? p.categoryId === null
        : p.categoryId === categoryFilter);
    return matchesText && matchesCategory;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProducts = filtered.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE,
  );

  function openCreate() {
    setEditingProduct(null);
    setFormOpen(true);
  }

  function openEdit(product: Product) {
    setEditingProduct(product);
    setFormOpen(true);
  }

  function handleToggleFeatured(product: Product) {
    toggleFeatured.mutate({ id: product.id, isFeatured: !product.isFeatured });
  }

  async function handleDelete(product: Product) {
    const ok = await confirm({
      title: "Delete product",
      description: (
        <>
          Delete{" "}
          <span className="font-semibold text-admin-text">{product.title}</span>?
          This also removes its images and cannot be undone.
        </>
      ),
      confirmLabel: "Delete product",
      destructive: true,
    });
    if (!ok) return;

    if (product.imageUrl) await deleteProductImage(product.imageUrl);
    for (const img of product.images ?? []) await deleteProductImage(img);
    deleteProductMutation.mutate(product.id, {
      onSuccess: () => notify.success("Product deleted."),
    });
  }

  const busy = toggleFeatured.isPending || deleteProductMutation.isPending;

  return (
    <div>
      <PageHeader
        eyebrow="Catalog"
        title="Products"
        description="Manage your inventory, pricing, and featured items."
        actions={
          can.create && (
            <button
              type="button"
              onClick={openCreate}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-admin-accent-hover"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} />
              Add Product
            </button>
          )
        }
      />

      {/* Stats */}
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Total Items" value={products.length} icon={Package} />
        <StatCard
          label="Featured"
          value={featuredCount}
          icon={Star}
          tone="amber"
          hint={`of ${products.length} total`}
        />
        {/* Derived from cost price, which the service zeroes for users without
            `finances.view`. Showing the card anyway would present a near-zero
            total as fact, so it is hidden rather than redacted. */}
        {can.viewFinances && (
          <StatCard
            label="Inventory Value"
            value={formatCurrency(inventoryValue, currency.code, currency.locale)}
            icon={Wallet}
            tone="emerald"
            hint="at cost price"
          />
        )}
      </div>

      {/* Search + category filter */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-2xl border border-admin-border bg-admin-surface px-4">
          <Search className="h-4 w-4 shrink-0 text-admin-text-muted" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => {
              setFilterText(e.target.value);
              setCurrentPage(1);
            }}
            placeholder="Filter by name or SKU..."
            aria-label="Filter products by name or SKU"
            className="w-full bg-transparent py-3.5 text-sm text-admin-text placeholder:text-admin-text-muted focus:outline-none"
          />
        </div>
        {categories.length > 0 && (
          <div className="sm:w-52">
            <Select
              value={categoryFilter}
              onChange={(e) => {
                setCategoryFilter(e.target.value);
                setCurrentPage(1);
              }}
              aria-label="Filter products by category"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
              <option value="none">Uncategorized</option>
            </Select>
          </div>
        )}
      </div>

      {/* Table */}
      {products.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No products yet"
          description="Add your first product to start building your catalog."
          action={
            can.create && (
              <button
                type="button"
                onClick={openCreate}
                className="flex cursor-pointer items-center gap-2 rounded-xl bg-admin-accent px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover"
              >
                <Plus className="h-4 w-4" strokeWidth={2.5} />
                Add Product
              </button>
            )
          }
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-admin-border bg-admin-surface">
          {/* Table header */}
          <div className="hidden border-b border-admin-border bg-admin-card/40 px-5 py-3 sm:grid sm:grid-cols-12 sm:items-center sm:gap-4">
            <p className="col-span-1 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">S.N</p>
            <p className="col-span-3 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Product</p>
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Price</p>
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Stock</p>
            <p className="col-span-2 text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Status</p>
            <p className="col-span-2 text-right text-[10px] font-bold uppercase tracking-[0.15em] text-admin-text-muted">Actions</p>
          </div>

          {isFetching && products.length === 0 ? (
            <TableRowsSkeleton />
          ) : filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-admin-text-muted">
              No products match &ldquo;{filterText}&rdquo;.
            </div>
          ) : (
            <div className="divide-y divide-admin-border">
              {paginatedProducts.map((product, i) => (
                <div
                  key={product.id}
                  className="grid grid-cols-1 gap-3 px-5 py-3.5 transition-colors hover:bg-admin-card/30 sm:grid-cols-12 sm:items-center sm:gap-4"
                >
                  {/* S.N */}
                  <div className="col-span-1 text-sm font-bold text-admin-text-muted">
                    {(safePage - 1) * ITEMS_PER_PAGE + i + 1}
                  </div>

                  {/* Product: image + title open the detail page */}
                  <RowLink
                    href={`/dashboard/products/${product.id}`}
                    label={`View ${product.title}`}
                    className="col-span-3"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl border border-admin-border bg-admin-card">
                      {product.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={product.imageUrl} alt={product.title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-admin-text-muted">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-admin-text transition-colors group-hover:text-admin-accent">
                        {product.title}
                      </p>
                      {product.description && (
                        <p className="truncate text-[11px] text-admin-text-muted">{product.description}</p>
                      )}
                      <div className="flex items-center gap-1.5">
                        {product.sku && (
                          <p className="truncate font-mono text-[10px] uppercase tracking-wide text-admin-text-muted">
                            {product.sku}
                          </p>
                        )}
                        {product.categoryId && categoryName.has(product.categoryId) && (
                          <span className="inline-flex shrink-0 rounded-full bg-admin-card px-2 py-0.5 text-[10px] font-bold text-admin-text-secondary">
                            {categoryName.get(product.categoryId)}
                          </span>
                        )}
                      </div>
                    </div>
                  </RowLink>

                  {/* Price */}
                  <div className="col-span-2">
                    <span className="inline-flex rounded-lg bg-admin-card px-2.5 py-1 text-xs font-bold text-admin-text">
                      {formatCurrency(product.price, currency.code, currency.locale)}
                    </span>
                  </div>

                  {/* Stock */}
                  <div className="col-span-2">
                    <span className="text-sm font-bold text-admin-text">
                      {effectiveStock(product)}
                    </span>
                    {product.hasVariants && (
                      <span className="ml-1.5 inline-flex items-center rounded-full bg-admin-accent/12 px-2 py-0.5 text-[10px] font-bold text-admin-accent">
                        Variants
                      </span>
                    )}
                  </div>

                  {/* Status */}
                  <div className="col-span-2">
                    {product.isFeatured ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-admin-accent/12 px-2.5 py-0.5 text-[11px] font-bold text-admin-accent">
                        <Star className="h-3 w-3" fill="currentColor" />
                        Featured
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[11px] text-admin-text-muted">
                        <span className="h-1.5 w-1.5 rounded-full bg-admin-text-muted/40" />
                        Standard
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="col-span-2 flex items-center justify-end gap-1">
                    <ActionMenu
                      label={`Actions for ${product.title}`}
                      items={[
                        {
                          key: "feature",
                          label: product.isFeatured ? "Remove from featured" : "Mark as featured",
                          icon: Star,
                          onSelect: () => handleToggleFeatured(product),
                          disabled: busy,
                          hidden: !can.edit,
                        },
                        {
                          key: "restock",
                          label: "Restock product",
                          icon: PackagePlus,
                          onSelect: () => setRestockProduct(product),
                          hidden: !can.edit,
                        },
                        {
                          key: "view",
                          label: "View details",
                          icon: Eye,
                          href: `/dashboard/products/${product.id}`,
                        },
                        {
                          key: "history",
                          label: "View history",
                          icon: Clock,
                          onSelect: () => setHistoryProduct(product),
                        },
                        {
                          key: "edit",
                          label: "Edit product",
                          icon: Pencil,
                          onSelect: () => openEdit(product),
                          hidden: !can.edit,
                        },
                        {
                          key: "delete",
                          label: "Delete product",
                          icon: Trash2,
                          onSelect: () => handleDelete(product),
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
            itemLabel="products"
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Unified add/edit modal */}
      {formOpen && (
        <ProductFormModal
          key={editingProduct?.id ?? "new"}
          open
          product={editingProduct}
          onClose={() => setFormOpen(false)}
        />
      )}

      {/* Restock modal */}
      {restockProduct && (
        <RestockModal
          key={restockProduct.id}
          product={restockProduct}
          onClose={() => setRestockProduct(null)}
        />
      )}

      {/* History modal */}
      {historyProduct && (
        <HistoryModal
          key={historyProduct.id}
          product={historyProduct}
          currency={currency}
          onClose={() => setHistoryProduct(null)}
        />
      )}
    </div>
  );
}
