"use client";

import { useState } from "react";
import { Modal } from "@/components/molecules/modal/Modal";
import { Checkbox, Field, TextInput, Textarea } from "@/components/molecules/form";
import {
  useCreateCustomer,
  useUpdateCustomer,
} from "@/hooks/customers/use-customers";
import { notify } from "@/lib/toast";
import type { Customer } from "@/types/customer.types";

interface CustomerFormModalProps {
  open: boolean;
  onClose: () => void;
  /** When provided the modal edits this customer; otherwise it creates a new one. */
  customer?: Customer | null;
}

export function CustomerFormModal({
  open,
  onClose,
  customer,
}: CustomerFormModalProps) {
  const isEdit = Boolean(customer);
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const pending = createCustomer.isPending || updateCustomer.isPending;

  const [name, setName] = useState(customer?.name ?? "");
  const [phone, setPhone] = useState(customer?.phone ?? "");
  const [email, setEmail] = useState(customer?.email ?? "");
  const [address, setAddress] = useState(customer?.address ?? "");
  const [notes, setNotes] = useState(customer?.notes ?? "");
  const [dob, setDob] = useState(customer?.dob ?? "");
  const [citizenshipNumber, setCitizenshipNumber] = useState(
    customer?.citizenshipNumber ?? "",
  );
  const [isActive, setIsActive] = useState(customer?.isActive ?? true);

  function handleSubmit() {
    if (!name.trim() && !phone.trim()) {
      notify.error("Enter a name or a phone number.");
      return;
    }

    const data = {
      name: name.trim() || null,
      phone: phone.trim() || null,
      email: email.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
      dob: dob.trim() || null,
      citizenshipNumber: citizenshipNumber.trim() || null,
      isActive,
    };

    const action = isEdit
      ? updateCustomer.mutateAsync({ id: customer!.id, data })
      : createCustomer.mutateAsync(data);

    action
      .then(() => {
        notify.success(isEdit ? "Customer updated." : "Customer created.");
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
      title={isEdit ? "Edit customer" : "New customer"}
      description={
        isEdit
          ? "Update this customer's contact details."
          : "Add a customer to your directory."
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
            {pending ? "Saving..." : isEdit ? "Save changes" : "Create customer"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Name">
          {(p) => (
            <TextInput
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              {...p}
            />
          )}
        </Field>
        <Field label="Phone" hint="The identity key used to match POS sales.">
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

        <Field label="Date of birth">
          {(p) => (
            <TextInput
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              {...p}
            />
          )}
        </Field>
        <Field label="Citizenship number">
          {(p) => (
            <TextInput
              type="text"
              value={citizenshipNumber}
              onChange={(e) => setCitizenshipNumber(e.target.value)}
              placeholder="Citizenship / ID number"
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
              placeholder="Any internal notes about this customer"
              {...p}
            />
          )}
        </Field>

        <div className="sm:col-span-2">
          <Checkbox
            label="Active"
            description="Inactive customers keep their history but are hidden from pickers."
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
          />
        </div>
      </div>
    </Modal>
  );
}
