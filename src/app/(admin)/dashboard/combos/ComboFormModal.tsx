"use client";

import { useMemo, useRef, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { ImageUploader } from "@/components/molecules/image-uploader/ImageUploader";
import { Modal } from "@/components/molecules/modal/Modal";
import { Checkbox, Field, Select, TextInput, Textarea } from "@/components/molecules/form";
import {
  useCreateCombo,
  useUpdateCombo,
} from "@/hooks/combos/use-combo-mutations";
import {
  deleteProductImage,
  uploadProductImage,
} from "@/services/upload.service";
import { notify } from "@/lib/toast";
import type { ComboWithItems, Product } from "@/types/product.types";
import { formatCurrency } from "@/utils/format-currency";

interface ComboFormModalProps {
  open: boolean;
  onClose: () => void;
  /** When provided the modal edits this combo; otherwise it creates a new one. */
  combo?: ComboWithItems | null;
  /** Simple products selectable as combo components. */
  products: Product[];
  currency: { code: string; locale: string };
}

interface ItemRow {
  componentId: string;
  quantity: number;
}

/**
 * Add/edit a combo. A combo bundles two or more simple products at a discounted
 * price. Image handling mirrors ProductFormModal: uploads hit storage
 * immediately, but the row and any deletions only commit on a successful save.
 */
export function ComboFormModal({
  open,
  onClose,
  combo,
  products,
  currency,
}: ComboFormModalProps) {
  const isEdit = Boolean(combo);
  const initialCover = combo?.imageUrl ?? null;
  const initialImages = combo?.images ?? [];

  const createCombo = useCreateCombo();
  const updateCombo = useUpdateCombo();
  const pending = createCombo.isPending || updateCombo.isPending;

  const [title, setTitle] = useState(combo?.title ?? "");
  const [price, setPrice] = useState(combo ? String(combo.price) : "");
  const [description, setDescription] = useState(combo?.description ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(initialCover);
  const [images, setImages] = useState<string[]>(initialImages);
  const [isFeatured, setIsFeatured] = useState(combo?.isFeatured ?? false);
  const [isVisible, setIsVisible] = useState(combo?.isVisible ?? true);
  const [items, setItems] = useState<ItemRow[]>(
    combo?.items.map((it) => ({ componentId: it.componentId, quantity: it.quantity })) ?? [],
  );

  const [pendingDeletions, setPendingDeletions] = useState<string[]>([]);
  const extraImageInput = useRef<HTMLInputElement>(null);

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products],
  );

  // Products not already added, for the "add component" picker.
  const available = products.filter((p) => !items.some((it) => it.componentId === p.id));

  const originalPrice = items.reduce((sum, it) => {
    const p = productById.get(it.componentId);
    return sum + (p ? p.price * it.quantity : 0);
  }, 0);
  const parsedPrice = parseFloat(price);
  const savings =
    Number.isFinite(parsedPrice) && originalPrice > 0
      ? originalPrice - parsedPrice
      : 0;

  function markForDeletion(url: string) {
    const wasPersisted = url === initialCover || initialImages.includes(url);
    if (wasPersisted) setPendingDeletions((prev) => [...prev, url]);
    else void deleteProductImage(url);
  }

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
    await Promise.all(sessionUploads().map((url) => deleteProductImage(url)));
    onClose();
  }

  function addComponent(componentId: string) {
    if (!componentId) return;
    setItems((prev) => [...prev, { componentId, quantity: 1 }]);
  }

  function setQuantity(componentId: string, quantity: number) {
    setItems((prev) =>
      prev.map((it) =>
        it.componentId === componentId ? { ...it, quantity } : it,
      ),
    );
  }

  function removeComponent(componentId: string) {
    setItems((prev) => prev.filter((it) => it.componentId !== componentId));
  }

  function handleSubmit() {
    if (!title.trim() || !price.trim()) {
      notify.error("Title and price are required.");
      return;
    }
    if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
      notify.error("Enter a valid combo price.");
      return;
    }
    const cleaned = items.filter((it) => it.componentId && it.quantity > 0);
    if (cleaned.length < 2) {
      notify.error("Add at least two component products.");
      return;
    }

    const data = {
      title: title.trim(),
      description: description.trim() || undefined,
      price: parsedPrice,
      imageUrl: imageUrl ?? (isEdit ? "" : undefined),
      images,
      isFeatured,
      isVisible,
      items: cleaned,
    };

    const action = isEdit
      ? updateCombo.mutateAsync({ id: combo!.id, data })
      : createCombo.mutateAsync(data);

    action
      .then(async () => {
        await Promise.all(pendingDeletions.map((url) => deleteProductImage(url)));
        notify.success(isEdit ? "Combo updated." : "Combo created.");
        onClose();
      })
      .catch(() => {
        // Error toast handled by the mutation's onError; keep the form open.
      });
  }

  return (
    <Modal
      open={open}
      onOpenChange={(next) => {
        if (!next && !pending) void handleCancel();
      }}
      size="lg"
      title={isEdit ? "Edit combo" : "New combo"}
      description={
        isEdit
          ? "Update the bundle, pricing, and imagery."
          : "Bundle products together at a discounted price."
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
            onClick={handleSubmit}
            disabled={pending}
            className="rounded-xl bg-admin-accent px-5 py-2 text-sm font-bold text-white transition-colors hover:bg-admin-accent-hover disabled:opacity-40"
          >
            {pending ? "Saving..." : isEdit ? "Save changes" : "Create combo"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Title" required>
          {(p) => (
            <TextInput
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Combo name"
              {...p}
            />
          )}
        </Field>
        <Field label="Combo price" required hint="The discounted price shoppers pay.">
          {(p) => (
            <TextInput
              type="number"
              step="0.01"
              min="0"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              {...p}
            />
          )}
        </Field>
        <Field label="Description" className="sm:col-span-2">
          {(p) => (
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Describe what's in the bundle"
              {...p}
            />
          )}
        </Field>

        {/* Cover image */}
        <div className="sm:col-span-2">
          <ImageUploader
            label="Cover Image"
            description="Main combo image. Square or 4:5 ratio recommended."
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
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-widest text-admin-text-muted">
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
                  <X className="h-4 w-4 text-white opacity-0 transition-opacity group-hover:opacity-100" strokeWidth={2} />
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
            description="Uncheck to keep this combo off your public storefront."
            checked={isVisible}
            onChange={(e) => setIsVisible(e.target.checked)}
          />
        </div>
        <div className="sm:col-span-2">
          <Checkbox
            label="Featured combo"
            description="Featured combos are highlighted on the storefront."
            checked={isFeatured}
            onChange={(e) => setIsFeatured(e.target.checked)}
          />
        </div>

        {/* Components */}
        <div className="sm:col-span-2 border-t border-admin-border pt-4">
          <label className="mb-2 block text-[11px] font-medium uppercase tracking-widest text-admin-text-muted">
            Components ({items.length})
          </label>

          {items.length > 0 && (
            <div className="mb-3 space-y-2">
              {items.map((it) => {
                const p = productById.get(it.componentId);
                return (
                  <div
                    key={it.componentId}
                    className="flex items-center gap-3 rounded-xl border border-admin-border bg-admin-card/30 px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-admin-text">
                        {p?.title ?? "Unknown product"}
                      </p>
                      {p && (
                        <p className="text-[11px] text-admin-text-muted">
                          {formatCurrency(p.price, currency.code, currency.locale)} each
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-admin-text-muted">Qty</span>
                      <input
                        type="number"
                        min="1"
                        value={it.quantity}
                        onChange={(e) =>
                          setQuantity(it.componentId, Math.max(1, parseInt(e.target.value, 10) || 1))
                        }
                        aria-label={`Quantity of ${p?.title ?? "component"}`}
                        className="w-16 rounded-lg border border-admin-border bg-admin-surface px-2 py-1 text-sm text-admin-text focus:outline-none"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeComponent(it.componentId)}
                      aria-label={`Remove ${p?.title ?? "component"}`}
                      className="cursor-pointer rounded-lg p-1.5 text-admin-danger/60 transition-colors hover:bg-admin-danger/10 hover:text-admin-danger"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <Select
            value=""
            onChange={(e) => {
              addComponent(e.target.value);
              e.target.value = "";
            }}
            disabled={available.length === 0}
            aria-label="Add a component product"
          >
            <option value="">
              {available.length === 0
                ? "No more simple products available"
                : "+ Add a product…"}
            </option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title} · {formatCurrency(p.price, currency.code, currency.locale)}
              </option>
            ))}
          </Select>

          {/* Savings hint */}
          {items.length > 0 && originalPrice > 0 && (
            <div className="mt-3 flex items-center justify-between rounded-xl bg-admin-card/40 px-3 py-2 text-sm">
              <span className="text-admin-text-muted">
                Components total{" "}
                <span className="font-semibold text-admin-text line-through">
                  {formatCurrency(originalPrice, currency.code, currency.locale)}
                </span>
              </span>
              {savings > 0 ? (
                <span className="font-bold text-admin-success">
                  Save {formatCurrency(savings, currency.code, currency.locale)}
                </span>
              ) : (
                <span className="text-admin-text-muted">No discount yet</span>
              )}
            </div>
          )}
          <p className="mt-2 text-[11px] text-admin-text-muted">
            Add at least two products. Stock is derived from components: the combo
            is in stock only while every component is available.
          </p>
        </div>
      </div>
    </Modal>
  );
}
