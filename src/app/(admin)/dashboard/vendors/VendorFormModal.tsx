"use client";

import { useState } from "react";
import { Modal } from "@/components/molecules/modal/Modal";
import { Checkbox, Field, TextInput, Textarea } from "@/components/molecules/form";
import { useCreateVendor, useUpdateVendor } from "@/hooks/vendors/use-vendors";
import { notify } from "@/lib/toast";
import type { Vendor } from "@/types/vendor.types";

interface VendorFormModalProps {
  open: boolean;
  onClose: () => void;
  /** When provided the modal edits this vendor; otherwise it creates a new one. */
  vendor?: Vendor | null;
  currency: { code: string; locale: string };
}

export function VendorFormModal({
  open,
  onClose,
  vendor,
  currency,
}: VendorFormModalProps) {
  const isEdit = Boolean(vendor);
  const createVendor = useCreateVendor();
  const updateVendor = useUpdateVendor();
  const pending = createVendor.isPending || updateVendor.isPending;

  const [name, setName] = useState(vendor?.name ?? "");
  const [code, setCode] = useState(vendor?.code ?? "");
  const [contactPerson, setContactPerson] = useState(vendor?.contactPerson ?? "");
  const [phone, setPhone] = useState(vendor?.phone ?? "");
  const [email, setEmail] = useState(vendor?.email ?? "");
  const [address, setAddress] = useState(vendor?.address ?? "");
  const [panNumber, setPanNumber] = useState(vendor?.panNumber ?? "");
  const [vatNumber, setVatNumber] = useState(vendor?.vatNumber ?? "");
  const [openingBalance, setOpeningBalance] = useState(
    vendor ? String(vendor.openingBalance) : "",
  );
  const [notes, setNotes] = useState(vendor?.notes ?? "");
  const [isActive, setIsActive] = useState(vendor?.isActive ?? true);

  function handleSubmit() {
    if (!name.trim()) {
      notify.error("Vendor name is required.");
      return;
    }
    const parsedBalance = openingBalance.trim()
      ? parseFloat(openingBalance)
      : 0;
    if (Number.isNaN(parsedBalance)) {
      notify.error("Enter a valid opening balance.");
      return;
    }

    const data = {
      name: name.trim(),
      code: code.trim() || null,
      contactPerson: contactPerson.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      panNumber: panNumber.trim() || null,
      vatNumber: vatNumber.trim() || null,
      openingBalance: parsedBalance,
      notes: notes.trim() || null,
      isActive,
    };

    const action = isEdit
      ? updateVendor.mutateAsync({ id: vendor!.id, data })
      : createVendor.mutateAsync(data);

    action
      .then(() => {
        notify.success(isEdit ? "Vendor updated." : "Vendor created.");
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
        if (!next && !pending) onClose();
      }}
      size="lg"
      title={isEdit ? "Edit vendor" : "New vendor"}
      description={
        isEdit
          ? "Update this vendor's contact and tax details."
          : "Add a supplier you buy from."
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
            {pending ? "Saving..." : isEdit ? "Save changes" : "Create vendor"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Vendor name" required>
          {(p) => (
            <TextInput
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Trading"
              {...p}
            />
          )}
        </Field>
        <Field label="Code" hint="Short unique code (optional).">
          {(p) => (
            <TextInput
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="e.g. ACME"
              {...p}
            />
          )}
        </Field>

        <Field label="Contact person">
          {(p) => (
            <TextInput
              type="text"
              value={contactPerson}
              onChange={(e) => setContactPerson(e.target.value)}
              placeholder="Full name"
              {...p}
            />
          )}
        </Field>
        <Field label="Phone">
          {(p) => (
            <TextInput
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone number"
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
              placeholder="name@example.com"
              {...p}
            />
          )}
        </Field>
        <Field label="Address">
          {(p) => (
            <TextInput
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street, city"
              {...p}
            />
          )}
        </Field>

        <Field label="PAN number" hint="For non-VAT vendors.">
          {(p) => (
            <TextInput
              type="text"
              value={panNumber}
              onChange={(e) => setPanNumber(e.target.value)}
              placeholder="PAN"
              {...p}
            />
          )}
        </Field>
        <Field label="VAT number" hint="For VAT-registered vendors.">
          {(p) => (
            <TextInput
              type="text"
              value={vatNumber}
              onChange={(e) => setVatNumber(e.target.value)}
              placeholder="VAT registration no."
              {...p}
            />
          )}
        </Field>

        <Field
          label={`Opening balance (${currency.code})`}
          hint="Amount already owed to this vendor when added."
          className="sm:col-span-2"
        >
          {(p) => (
            <TextInput
              type="number"
              step="0.01"
              value={openingBalance}
              onChange={(e) => setOpeningBalance(e.target.value)}
              placeholder="0.00"
              {...p}
            />
          )}
        </Field>

        <Field label="Notes" className="sm:col-span-2">
          {(p) => (
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any internal notes about this vendor"
              {...p}
            />
          )}
        </Field>

        <div className="sm:col-span-2">
          <Checkbox
            label="Active"
            description="Inactive vendors are hidden from pickers but keep their history."
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
        </div>
      </div>
    </Modal>
  );
}
