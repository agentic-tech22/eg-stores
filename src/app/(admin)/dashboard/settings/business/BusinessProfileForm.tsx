"use client";

import { useState } from "react";
import { PageHeader } from "@/components/molecules/admin";
import {
  Checkbox,
  Field,
  Select,
  TextInput,
  Textarea,
} from "@/components/molecules/form";
import { ImageUploader } from "@/components/molecules/image-uploader/ImageUploader";
import { useUpsertBusinessProfile } from "@/hooks/business-profile/use-business-profile";
import { CURRENCIES, DEFAULT_CURRENCY_CODE } from "@/lib/currency";
import { notify } from "@/lib/toast";
import {
  deleteBrandingImage,
  uploadBrandingImage,
} from "@/services/upload.service";
import type { BusinessProfile } from "@/types/invoice.types";
import { InvoicePreview } from "./InvoicePreview";

interface BusinessProfileFormProps {
  initialProfile: BusinessProfile | null;
}

export function BusinessProfileForm({
  initialProfile,
}: BusinessProfileFormProps) {
  const upsert = useUpsertBusinessProfile();

  const [shopName, setShopName] = useState(initialProfile?.shopName ?? "");
  const [address, setAddress] = useState(initialProfile?.address ?? "");
  const [phone, setPhone] = useState(initialProfile?.phone ?? "");
  const [email, setEmail] = useState(initialProfile?.email ?? "");
  const [taxId, setTaxId] = useState(initialProfile?.taxId ?? "");
  const [logoUrl, setLogoUrl] = useState(initialProfile?.logoUrl ?? "");
  const [currency, setCurrency] = useState(
    initialProfile?.currency ?? DEFAULT_CURRENCY_CODE,
  );
  const [invoicePrefix, setInvoicePrefix] = useState(
    initialProfile?.invoicePrefix ?? "INV",
  );
  const [invoiceFooter, setInvoiceFooter] = useState(
    initialProfile?.invoiceFooter ?? "",
  );
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(
    initialProfile?.loyaltyEnabled ?? false,
  );
  const [loyaltyEarnMode, setLoyaltyEarnMode] = useState<"percent" | "flat">(
    initialProfile?.loyaltyEarnMode ?? "percent",
  );
  const [loyaltyEarnRate, setLoyaltyEarnRate] = useState(
    initialProfile ? String(initialProfile.loyaltyEarnRate) : "",
  );

  async function handleLogoUpload(formData: FormData) {
    const result = await uploadBrandingImage(formData);
    if (result.success && result.url) {
      const previous = logoUrl;
      setLogoUrl(result.url);
      // Drop the old file now that a new one has replaced it.
      if (previous) await deleteBrandingImage(previous);
      notify.success("Logo uploaded. Save the profile to apply it.");
    }
    return result;
  }

  async function handleLogoRemove() {
    if (logoUrl) await deleteBrandingImage(logoUrl);
    setLogoUrl("");
    return { success: true };
  }

  function handleSave() {
    if (!shopName.trim()) {
      notify.error("Shop name is required.");
      return;
    }
    upsert.mutate(
      {
        shopName,
        address,
        phone,
        email,
        taxId,
        logoUrl,
        currency,
        invoicePrefix,
        invoiceFooter,
        loyaltyEnabled,
        loyaltyEarnMode,
        loyaltyEarnRate: parseFloat(loyaltyEarnRate) || 0,
      },
      { onSuccess: () => notify.success("Business profile saved.") },
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Business profile"
        description="This information appears on the invoices you issue."
      />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
        <div className="border-admin-border bg-admin-surface rounded-2xl border p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Shop name" required className="sm:col-span-2">
              {(p) => (
                <TextInput
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="Acme Store"
                  {...p}
                />
              )}
            </Field>
            <Field label="Address" className="sm:col-span-2">
              {(p) => (
                <Textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={2}
                  placeholder="Street, city, country"
                  {...p}
                />
              )}
            </Field>
            <Field label="Phone">
              {(p) => (
                <TextInput
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="Optional"
                  {...p}
                />
              )}
            </Field>
            <Field label="Email">
              {(p) => (
                <TextInput
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Optional"
                  {...p}
                />
              )}
            </Field>
            <Field label="Tax ID">
              {(p) => (
                <TextInput
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  placeholder="VAT / GST / PAN"
                  {...p}
                />
              )}
            </Field>
            <div className="sm:col-span-2">
              <ImageUploader
                label="Logo"
                description="A square image reads best on invoices. PNG, JPG, WebP, or SVG."
                currentImageUrl={logoUrl || null}
                aspectRatio={1}
                outputWidth={512}
                outputHeight={512}
                onUpload={handleLogoUpload}
                onRemove={handleLogoRemove}
              />
            </div>
            <Field
              label="Currency"
              hint="Applied across the storefront and dashboard."
            >
              {(p) => (
                <Select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  {...p}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field
              label="Invoice prefix"
              hint="Invoices are numbered like PREFIX-0001."
            >
              {(p) => (
                <TextInput
                  value={invoicePrefix}
                  onChange={(e) => setInvoicePrefix(e.target.value)}
                  placeholder="INV"
                  {...p}
                />
              )}
            </Field>
            <Field label="Invoice footer" className="sm:col-span-2">
              {(p) => (
                <Textarea
                  value={invoiceFooter}
                  onChange={(e) => setInvoiceFooter(e.target.value)}
                  rows={2}
                  placeholder="Thank you for your business!"
                  {...p}
                />
              )}
            </Field>
          </div>

          <div className="border-admin-border mt-8 border-t pt-6">
            <p className="text-admin-text-muted text-[11px] font-bold tracking-[0.15em] uppercase">
              Loyalty program
            </p>
            <p className="text-admin-text-muted mt-1 mb-4 text-sm">
              When enabled, POS sales recorded with a customer phone number
              automatically earn loyalty points.
            </p>

            <Checkbox
              label="Enable loyalty points"
              description="Auto-earn points on point-of-sale transactions."
              checked={loyaltyEnabled}
              onChange={(e) => setLoyaltyEnabled(e.target.checked)}
            />

            {loyaltyEnabled && (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field
                  label="Earning mode"
                  hint="How points accrue on each sale."
                >
                  {(p) => (
                    <Select
                      value={loyaltyEarnMode}
                      onChange={(e) =>
                        setLoyaltyEarnMode(e.target.value as "percent" | "flat")
                      }
                      {...p}
                    >
                      <option value="percent">Percent of sale total</option>
                      <option value="flat">Flat points per sale</option>
                    </Select>
                  )}
                </Field>
                <Field
                  label={
                    loyaltyEarnMode === "percent"
                      ? "Points rate (% of total)"
                      : "Points per sale"
                  }
                  hint={
                    loyaltyEarnMode === "percent"
                      ? "e.g. 5 → a 1,000 sale earns 50 points."
                      : "e.g. 10 → every sale earns 10 points."
                  }
                >
                  {(p) => (
                    <TextInput
                      type="number"
                      step="0.01"
                      min="0"
                      value={loyaltyEarnRate}
                      onChange={(e) => setLoyaltyEarnRate(e.target.value)}
                      placeholder="0"
                      {...p}
                    />
                  )}
                </Field>
              </div>
            )}
          </div>

          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={upsert.isPending}
              className="bg-admin-accent hover:bg-admin-accent-hover rounded-xl px-5 py-2.5 text-sm font-bold text-white transition-colors disabled:opacity-40"
            >
              {upsert.isPending ? "Saving..." : "Save profile"}
            </button>
          </div>
        </div>

        <div className="lg:sticky lg:top-6">
          <InvoicePreview
            shopName={shopName}
            address={address}
            phone={phone}
            email={email}
            taxId={taxId}
            logoUrl={logoUrl}
            currency={currency}
            invoicePrefix={invoicePrefix}
            invoiceFooter={invoiceFooter}
            nextInvoiceNumber={initialProfile?.nextInvoiceNumber ?? 1}
          />
        </div>
      </div>
    </div>
  );
}
