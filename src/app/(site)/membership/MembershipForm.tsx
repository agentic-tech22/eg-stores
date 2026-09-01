"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, Sparkles, Upload, X } from "lucide-react";
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import { submitMembershipSignup } from "@/services/membership.service";
import {
  validateCitizenshipPhoto,
  validateMembershipSignup,
  CITIZENSHIP_PHOTO_TYPES,
  type MembershipField,
  type MembershipTextField,
} from "@/services/membership-engine";
import type { MembershipSignupInput } from "@/types/customer.types";
import { cn } from "@/utils/cn";
import { downscaleImage } from "@/utils/downscale-image";

interface MembershipFormProps {
  shopName: string | null;
}

const emptyForm: MembershipSignupInput = {
  name: "",
  phone: "",
  email: "",
  address: "",
  dob: "",
  citizenshipNumber: "",
  website: "",
};

export function MembershipForm({ shopName }: MembershipFormProps) {
  const [form, setForm] = useState<MembershipSignupInput>(emptyForm);
  const [error, setError] = useState<{
    field: MembershipField;
    message: string;
  } | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // The preview is an object URL, so it has to be handed back to the browser
  // when it is replaced or the page is left.
  useEffect(() => {
    if (!photoPreview) return;
    return () => URL.revokeObjectURL(photoPreview);
  }, [photoPreview]);

  const set = (field: MembershipTextField) => (value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Clear the message as soon as the offending field is edited.
    setError((prev) => (prev?.field === field ? null : prev));
  };

  function handlePhotoChange(file: File | null) {
    setError((prev) => (prev?.field === "citizenshipPhoto" ? null : prev));
    if (!file) {
      clearPhoto();
      return;
    }
    const invalid = validateCitizenshipPhoto(file);
    if (invalid) {
      setError({ field: "citizenshipPhoto", message: invalid });
      clearPhoto();
      return;
    }
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
  }

  function clearPhoto() {
    setPhoto(null);
    setPhotoPreview(null);
    if (photoInputRef.current) photoInputRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Same rules the server enforces, run here first so a mistake is caught
    // without a round trip.
    const invalid = validateMembershipSignup(form);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError(null);

    startTransition(async () => {
      let photoData: FormData | null = null;
      if (photo) {
        // Shrink before sending: a camera photo is far larger than the 1MB a
        // Server Action body allows.
        const resized = await downscaleImage(photo);
        photoData = new FormData();
        photoData.append("file", resized);
      }

      const result = await submitMembershipSignup(form, photoData);
      if (result.success) {
        setDone(true);
        return;
      }
      setError({
        field: result.field ?? "name",
        message: result.error ?? "Could not complete your registration.",
      });
    });
  }

  if (done) {
    return (
      <Container size="sm" className="py-20">
        <div className="mx-auto max-w-lg text-center">
          <CheckCircle2 className="mx-auto mb-6 h-16 w-16 text-secondary" />
          <Typography variant="h2" className="mb-3 italic">
            You&rsquo;re a member!
          </Typography>
          <Typography variant="bodyLarge" className="text-text-secondary">
            Thank you{form.name ? `, ${form.name.trim()}` : ""}. Your membership
            is registered{shopName ? ` with ${shopName}` : ""}. Just give your
            phone number at the counter and your purchases will be linked to
            your account.
          </Typography>
        </div>
      </Container>
    );
  }

  return (
    <Container size="sm" className="py-14 sm:py-20">
      <div className="mx-auto max-w-xl">
        <div className="mb-8 text-center">
          <Sparkles className="mx-auto mb-4 h-10 w-10 text-secondary" />
          <Typography variant="h2" className="mb-3 italic">
            Become a member
          </Typography>
          <Typography variant="body" className="text-text-secondary">
            Join {shopName ?? "our"} membership program to collect loyalty
            points on every purchase. It takes less than a minute — only your
            name and WhatsApp number are required.
          </Typography>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="rounded-2xl border border-border/50 bg-surface/50 p-6 sm:p-8"
        >
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <FormField
              label="Full name"
              required
              field="name"
              error={error}
              className="sm:col-span-2"
            >
              {(p) => (
                <input
                  {...p}
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => set("name")(e.target.value)}
                  placeholder="Your full name"
                />
              )}
            </FormField>

            <FormField
              label="WhatsApp number"
              required
              field="phone"
              error={error}
              hint="We use this to identify you at the counter."
            >
              {(p) => (
                <input
                  {...p}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={form.phone}
                  onChange={(e) => set("phone")(e.target.value)}
                  placeholder="98XXXXXXXX"
                />
              )}
            </FormField>

            <FormField label="Date of birth" field="dob" error={error}>
              {(p) => (
                <input
                  {...p}
                  type="date"
                  autoComplete="bday"
                  value={form.dob}
                  onChange={(e) => set("dob")(e.target.value)}
                />
              )}
            </FormField>

            <FormField label="Email" field="email" error={error}>
              {(p) => (
                <input
                  {...p}
                  type="email"
                  autoComplete="email"
                  value={form.email}
                  onChange={(e) => set("email")(e.target.value)}
                  placeholder="name@example.com"
                />
              )}
            </FormField>

            <FormField
              label="Citizenship number"
              field="citizenshipNumber"
              error={error}
            >
              {(p) => (
                <input
                  {...p}
                  type="text"
                  value={form.citizenshipNumber}
                  onChange={(e) => set("citizenshipNumber")(e.target.value)}
                  placeholder="Optional"
                />
              )}
            </FormField>

            <div className="flex flex-col gap-1.5 sm:col-span-2">
              <label
                htmlFor="membership-citizenshipPhoto"
                className="text-sm font-medium text-text-primary"
              >
                Citizenship photo
              </label>

              {photoPreview ? (
                <div className="flex items-center gap-4 rounded-xl border border-border/50 bg-background/60 p-3">
                  {/* eslint-disable-next-line @next/next/no-img-element --
                      a local object URL, which next/image cannot optimize. */}
                  <img
                    src={photoPreview}
                    alt="Citizenship photo preview"
                    className="h-20 w-28 rounded-lg object-cover"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text-primary">
                      {photo?.name}
                    </p>
                    <button
                      type="button"
                      onClick={clearPhoto}
                      className="mt-1 inline-flex cursor-pointer items-center gap-1 text-xs text-text-secondary transition-colors hover:text-red-500"
                    >
                      <X className="h-3.5 w-3.5" />
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed bg-background/60 px-4 py-6 text-sm text-text-secondary transition-colors hover:border-secondary hover:text-text-primary",
                    error?.field === "citizenshipPhoto"
                      ? "border-red-400"
                      : "border-border/50",
                  )}
                >
                  <Upload className="h-4 w-4" />
                  Take or choose a photo
                </button>
              )}

              <input
                id="membership-citizenshipPhoto"
                ref={photoInputRef}
                type="file"
                accept={CITIZENSHIP_PHOTO_TYPES.join(",")}
                // Deliberately no `capture`: that jumps straight to the camera
                // and takes away the gallery, and plenty of members already
                // have a photo of their card saved.
                className="sr-only"
                aria-describedby="membership-citizenshipPhoto-message"
                aria-invalid={error?.field === "citizenshipPhoto" || undefined}
                onChange={(e) => handlePhotoChange(e.target.files?.[0] ?? null)}
              />
              <p
                id="membership-citizenshipPhoto-message"
                className={cn(
                  "text-xs",
                  error?.field === "citizenshipPhoto"
                    ? "text-red-500"
                    : "text-text-secondary",
                )}
              >
                {error?.field === "citizenshipPhoto"
                  ? error.message
                  : "Optional. A clear photo of your citizenship card, kept private to the shop."}
              </p>
            </div>

            <FormField
              label="Address"
              field="address"
              error={error}
              className="sm:col-span-2"
            >
              {(p) => (
                <input
                  {...p}
                  type="text"
                  autoComplete="street-address"
                  value={form.address}
                  onChange={(e) => set("address")(e.target.value)}
                  placeholder="Street, city"
                />
              )}
            </FormField>
          </div>

          {/* Honeypot: hidden from people, irresistible to bots. A non-empty
              value makes the server discard the submission. */}
          <div aria-hidden="true" className="absolute left-[-9999px] h-0 w-0 overflow-hidden">
            <label htmlFor="membership-website">Website</label>
            <input
              id="membership-website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={form.website}
              onChange={(e) => set("website")(e.target.value)}
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="mt-7 w-full cursor-pointer rounded-xl bg-primary px-6 py-3.5 font-semibold text-background transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Registering..." : "Join the membership"}
          </button>

          <Typography
            variant="caption"
            className="mt-4 block text-center text-text-secondary"
          >
            Your details are stored only for your membership and are never
            shared.
          </Typography>
        </form>
      </div>
    </Container>
  );
}

interface FormFieldProps {
  label: string;
  field: MembershipField;
  required?: boolean;
  hint?: string;
  className?: string;
  error: { field: MembershipField; message: string } | null;
  children: (props: {
    id: string;
    className: string;
    "aria-invalid"?: boolean;
    "aria-describedby"?: string;
  }) => React.ReactNode;
}

/**
 * Site-themed sibling of the admin `Field`: label + control + message. Kept
 * local to this page because the shared form molecules are styled with the
 * static `admin-*` tokens, which would clash with the storefront theme.
 */
function FormField({
  label,
  field,
  required,
  hint,
  className,
  error,
  children,
}: FormFieldProps) {
  const id = `membership-${field}`;
  const messageId = `${id}-message`;
  const invalid = error?.field === field;
  const message = invalid ? error.message : hint;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-sm font-medium text-text-primary">
        {label}
        {required && <span className="ml-0.5 text-secondary">*</span>}
      </label>
      {children({
        id,
        className: cn(
          "w-full rounded-xl border bg-background/60 px-4 py-3 text-text-primary transition-colors focus:outline-none",
          invalid
            ? "border-red-400 focus:border-red-400"
            : "border-border/50 focus:border-secondary",
        ),
        "aria-invalid": invalid || undefined,
        "aria-describedby": message ? messageId : undefined,
      })}
      {message && (
        <p
          id={messageId}
          className={cn(
            "text-xs",
            invalid ? "text-red-500" : "text-text-secondary",
          )}
        >
          {message}
        </p>
      )}
    </div>
  );
}
