"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { ImageUploader } from "@/components/molecules/image-uploader/ImageUploader";
import { Modal } from "@/components/molecules/modal/Modal";
import { Checkbox, Field, Select, TextInput, Textarea } from "@/components/molecules/form";
import {
  useCreateProduct,
  useUpdateProduct,
} from "@/hooks/products/use-product-mutations";
import { useCategories } from "@/hooks/categories/use-categories";
import {
  deleteProductImage,
  uploadProductImage,
} from "@/services/upload.service";
import {
  fetchProductWithVariants,
  type VariantInput,
} from "@/services/product.service";
import { notify } from "@/lib/toast";
import { usePermission } from "@/components/auth/permission-context";
import { useConfirm } from "@/components/molecules/confirm-dialog/confirm-context";
import { stockAtRisk } from "@/lib/products/stock-at-risk";
import type { Product, ProductVariant } from "@/types/product.types";
import { VariantsEditor } from "./VariantsEditor";

interface ProductFormModalProps {
  open: boolean;
  onClose: () => void;
  /** When provided the modal edits this product; otherwise it creates a new one. */
  product?: Product | null;
}

/**
 * Unified add/edit product form in a modal: all fields editable in place, no
 * page redirect. Mount with a `key` (e.g. the product id or "new") so its local
 * state initializes from the right product.
 *
 * Image handling: uploads hit storage immediately (returning a URL), but the
 * product row and any storage deletions are only committed on a successful
 * save. Cancelling/dismissing cleans up images uploaded during the session so
 * we don't orphan files, and never deletes images that were already persisted.
 */
export function ProductFormModal({ open, onClose, product }: ProductFormModalProps) {
  const isEdit = Boolean(product);
  const initialCover = product?.imageUrl ?? null;
  const initialImages = product?.images ?? [];

  const canViewFinance = usePermission("finances.view");

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const pending = createProduct.isPending || updateProduct.isPending;

  const [title, setTitle] = useState(product?.title ?? "");
  const [price, setPrice] = useState(product ? String(product.price) : "");
  const [costPrice, setCostPrice] = useState(
    product ? String(product.costPrice) : "",
  );
  const [description, setDescription] = useState(product?.description ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(initialCover);
  const [images, setImages] = useState<string[]>(initialImages);
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [isVisible, setIsVisible] = useState(product?.isVisible ?? true);
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? "");

  // Categories for the parent-category selector. Cached list; empty until loaded.
  const { data: categories = [] } = useCategories();
  const confirm = useConfirm();

  // Inventory & variants.
  const [stockQuantity, setStockQuantity] = useState(
    product ? String(product.stockQuantity) : "0",
  );
  const [hasVariants, setHasVariants] = useState(product?.hasVariants ?? false);
  const [variants, setVariants] = useState<VariantInput[]>([]);
  const [initialVariants, setInitialVariants] = useState<ProductVariant[]>([]);
  // For an existing variant product we must wait for the async fetch before
  // mounting the editor, otherwise it initializes from an empty list.
  const [variantsLoaded, setVariantsLoaded] = useState(
    !(isEdit && (product?.hasVariants ?? false)),
  );

  // Load existing variants when editing a variant product.
  useEffect(() => {
    if (isEdit && product?.hasVariants) {
      fetchProductWithVariants(product.id).then((full) => {
        if (full) setInitialVariants(full.variants);
        setVariantsLoaded(true);
      });
    }
  }, [isEdit, product?.id, product?.hasVariants]);

  // Persisted images that should be removed from storage, but only once the
  // form is saved successfully.
  const [pendingDeletions, setPendingDeletions] = useState<string[]>([]);
  const extraImageInput = useRef<HTMLInputElement>(null);

  function markForDeletion(url: string) {
    // Only persisted (pre-existing) images need deferred deletion; brand-new
    // session uploads can be removed immediately when discarded.
    const wasPersisted = url === initialCover || initialImages.includes(url);
    if (wasPersisted) setPendingDeletions((prev) => [...prev, url]);
    else void deleteProductImage(url);
  }

  /** Images uploaded this session that were never persisted (orphans on cancel). */
  function sessionUploads(): string[] {
    const orphans: string[] = [];
    if (imageUrl && imageUrl !== initialCover) orphans.push(imageUrl);
    for (const img of images) if (!initialImages.includes(img)) orphans.push(img);
    return orphans;
  }

  async function handleCoverUpload(formData: FormData) {
    const result = await uploadProductImage(formData);
    if (result.success && result.url) {
      if (imageUrl) markForDeletion(imageUrl);
      setImageUrl(result.url);
    }
    return result;
  }

  async function handleCoverRemove() {
    if (imageUrl) markForDeletion(imageUrl);
    setImageUrl(null);
    return { success: true };
  }

  async function handleAddExtraImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("folder", "images");
    const result = await uploadProductImage(formData);
    if (result.success && result.url) {
      setImages((prev) => [...prev, result.url!]);
    }
    if (extraImageInput.current) extraImageInput.current.value = "";
  }

  function handleRemoveExtraImage(index: number) {
    const url = images[index];
    if (url) markForDeletion(url);
    setImages((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleCancel() {
    // Drop any files uploaded this session that were never saved.
    await Promise.all(sessionUploads().map((url) => deleteProductImage(url)));
    onClose();
  }

  async function handleSubmit() {
    if (!title.trim() || !price.trim()) {
      notify.error("Title and selling price are required.");
      return;
    }
    const parsedPrice = parseFloat(price);
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      notify.error("Enter a valid selling price.");
      return;
    }

    if (hasVariants && variants.length === 0) {
      notify.error("Add at least one variant, or turn off variants.");
      return;
    }

    // Cost price is only entered/validated by users who can see finances. For
    // everyone else we omit it from the payload entirely so the stored cost is
    // preserved on edit (and defaults to 0 server-side on create).
    let costField: { costPrice: number } = {} as { costPrice: number };
    if (canViewFinance) {
      if (!costPrice.trim()) {
        notify.error("Cost price is required.");
        return;
      }
      const parsedCost = parseFloat(costPrice);
      if (Number.isNaN(parsedCost) || parsedCost < 0) {
        notify.error("Enter a valid cost price.");
        return;
      }
      if (parsedCost > parsedPrice) {
        notify.error("Cost price cannot be greater than the selling price.");
        return;
      }
      costField = { costPrice: parsedCost };
    }

    // Last gate before the write: name the units this save would retire and let
    // the user back out. Silent when nothing is at risk.
    const atRisk = stockAtRisk({
      product: product ?? null,
      existingVariants: initialVariants,
      nextHasVariants: hasVariants,
      keptVariantIds: variants
        .map((v) => v.id)
        .filter((id): id is string => Boolean(id)),
    });
    if (atRisk.length > 0) {
      const ok = await confirm({
        title: "This will clear stock",
        description: (
          <>
            Saving retires the stock held by the part of this product you are
            replacing. It is recorded in the product&rsquo;s history, but the
            counts go to zero:
            <ul className="mt-2 list-disc space-y-0.5 pl-5">
              {atRisk.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </>
        ),
        confirmLabel: "Save and clear stock",
        cancelLabel: "Go back",
        destructive: true,
      });
      if (!ok) return;
    }

    const data = {
      title: title.trim(),
      description: description.trim() || undefined,
      price: parsedPrice,
      ...costField,
      imageUrl: imageUrl ?? (isEdit ? "" : undefined),
      images,
      isFeatured,
      isVisible,
      categoryId: categoryId || null,
      hasVariants,
      stockQuantity: hasVariants ? undefined : parseInt(stockQuantity, 10) || 0,
      variants: hasVariants ? variants : undefined,
    };

    const action = isEdit
      ? updateProduct.mutateAsync({ id: product!.id, data })
      : createProduct.mutateAsync(data);

    action
      .then(async () => {
        // Safe to purge replaced/removed originals now that the row is saved.
        await Promise.all(
          pendingDeletions.map((url) => deleteProductImage(url)),
        );
        notify.success(isEdit ? "Product updated." : "Product created.");
        onClose();
      })
      .catch(() => {
        // Error toast is handled by the mutation's onError; keep the form open.
      });
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) void handleCancel();
      }}
      size="lg"
      title={isEdit ? "Edit product" : "New product"}
      description={
        isEdit
          ? "Update details, pricing, and imagery."
          : "Add a product to your catalog."
      }
      footer={
        <>
          <button
            type="button"
            onClick={() => void handleCancel()}
            disabled={pending}
            className="rounded-xl border border-admin-border px-4 py-2 text-sm font-bold text-admin-text-secondary transition-colors hover:bg-admin-card disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={pending}
            className="rounded-xl bg-admin-accent px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover disabled:opacity-40"
          >
            {pending
              ? "Saving..."
              : isEdit
                ? "Save changes"
                : "Create product"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Title" required className="sm:col-span-2">
          {(p) => (
            <TextInput
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Product title"
              {...p}
            />
          )}
        </Field>
        {/* The SKU field lived here. It was always read-only — the server
            generates the code on save — so on a new product it showed an empty
            disabled box, and on an edit it repeated a value the product list
            and detail page already show. Nothing to fill in, so it only cost a
            slot in the form. Uncomment to bring it back.
            <Field label="SKU" hint="Auto-generated and locked.">
              {(p) => (
                <TextInput
                  type="text"
                  value={isEdit ? (product?.sku ?? "") : ""}
                  readOnly
                  disabled
                  placeholder="Auto-generated on save"
                  {...p}
                />
              )}
            </Field>
        */}
        <Field label="Selling price" required>
          {(p) => (
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="29.99"
              {...p}
            />
          )}
        </Field>
        {canViewFinance && (
          <Field label="Cost price" required hint="Used to compute profit on sales.">
            {(p) => (
              <TextInput
                type="number"
                step="0.01"
                min="0"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="18.00"
                {...p}
              />
            )}
          </Field>
        )}
        {/* Category and stock sit together: the two things you reach for last
            when listing a product, and pairing "what kind of thing is it" with
            "how many have I got" saves a scroll to the bottom of the form.

            They get their own 2-column grid rather than being left to the
            parent's auto-flow, so they stay side by side even when the cost
            price above is hidden from users without finance access — which
            would otherwise shift every following cell by one. */}
        <div className="grid grid-cols-1 gap-4 sm:col-span-2 sm:grid-cols-2">
          <Field label="Category" hint="Optional parent category for this product.">
            {(p) => (
              <Select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                {...p}
              >
                <option value="">Uncategorized</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          {/* With variants on, stock is per-variant: the box would have nothing
              to edit, so the cell stays empty and the running total lives under
              the variant rows instead. */}
          {!hasVariants && (
            <Field label="Stock quantity">
              {(p) => (
                <TextInput
                  type="number"
                  min="0"
                  value={stockQuantity}
                  onChange={(e) => setStockQuantity(e.target.value)}
                  placeholder="0"
                  {...p}
                />
              )}
            </Field>
          )}
        </div>
        <Field label="Description" className="sm:col-span-2">
          {(p) => (
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Product description"
              {...p}
            />
          )}
        </Field>

        {/* Cover image */}
        <div className="sm:col-span-2">
          <ImageUploader
            label="Cover Image"
            description="Main product image. Square or 4:5 ratio recommended."
            currentImageUrl={imageUrl}
            aspectRatio={4 / 5}
            outputWidth={800}
            outputHeight={1000}
            acceptedTypes="image/png,image/jpeg,image/webp"
            onUpload={handleCoverUpload}
            onRemove={imageUrl ? handleCoverRemove : undefined}
          />
        </div>

        {/* Additional images */}
        <div className="sm:col-span-2">
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-[0.1em] text-admin-text-muted">
            Additional Images ({images.length})
          </label>
          <div className="flex flex-wrap gap-3">
            {images.map((url, i) => (
              <div
                key={url}
                className="group relative h-20 w-20 overflow-hidden rounded-xl border border-admin-border bg-admin-card/50"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt={`Extra ${i + 1}`} className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveExtraImage(i)}
                  aria-label={`Remove additional image ${i + 1}`}
                  className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/0 transition-colors group-hover:bg-black/50"
                >
                  <X
                    className="h-4 w-4 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    strokeWidth={2}
                  />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => extraImageInput.current?.click()}
              aria-label="Add additional image"
              className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-admin-border bg-admin-card/30 text-admin-text-muted transition-colors hover:border-admin-accent/40 hover:text-admin-accent"
            >
              <Plus className="h-6 w-6" />
            </button>
          </div>
          <input
            ref={extraImageInput}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={handleAddExtraImage}
            className="hidden"
          />
        </div>

        <div className="sm:col-span-2">
          <Checkbox
            label="Show on website"
            description="Uncheck to keep this product off your public storefront."
            checked={isVisible}
            onChange={(e) => setIsVisible(e.target.checked)}
          />
        </div>

        <div className="sm:col-span-2">
          <Checkbox
            label="Featured product"
            description="Featured products are highlighted on the storefront."
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
          />
        </div>

        {/* Inventory */}
        <div className="sm:col-span-2 border-t border-admin-border pt-4">
          <Checkbox
            label="This product has variants"
            description="Track stock per variant (e.g. Color / Size) instead of a single quantity."
            checked={hasVariants}
            onChange={(e) => setHasVariants(e.target.checked)}
          />
        </div>

        {/* Stock quantity used to live here. It now sits beside Category above;
            this slot is the variants editor only. */}
        {hasVariants && (
          <div className="sm:col-span-2">
            {variantsLoaded ? (
              <VariantsEditor
                key={initialVariants.map((v) => v.id).join(",") || "new"}
                initialVariants={initialVariants}
                onChange={setVariants}
              />
            ) : (
              <p className="text-sm text-admin-text-muted">
                Loading variants…
              </p>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
