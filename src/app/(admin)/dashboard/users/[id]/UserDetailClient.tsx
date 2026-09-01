"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Paperclip,
  Plus,
  StickyNote,
  Trash2,
  Upload,
  Wallet,
} from "lucide-react";
import { Button, PageHeader } from "@/components/molecules/admin";
import { Field, Select, TextInput, Textarea } from "@/components/molecules/form";
import { useConfirm } from "@/components/molecules/confirm-dialog/confirm-context";
import {
  useCreateSalaryRecord,
  useCreateUserDocument,
  useCreateUserNote,
  useDeleteSalaryRecord,
  useDeleteUserDocument,
  useDeleteUserNote,
  useUserRecords,
} from "@/hooks/users/use-user-records";
import { uploadUserDocument } from "@/services/upload.service";
import { notify } from "@/lib/toast";
import { cn } from "@/utils/cn";
import { formatCurrency } from "@/utils/format-currency";
import { toLocalDateStr } from "@/utils/date-range";
import type { ManagedUser } from "@/types/user.types";
import {
  SALARY_RECORD_TYPES,
  USER_DOCUMENT_CATEGORIES,
  type SalaryRecordType,
  type UserDocumentCategory,
  type UserHrRecords,
} from "@/types/user-record.types";

interface UserDetailClientProps {
  user: ManagedUser;
  initialRecords: UserHrRecords;
  currency: { code: string; locale: string };
}

const DOC_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";
const MAX_DOC_MB = 10;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

const SALARY_TYPE_LABELS: Record<SalaryRecordType, string> = Object.fromEntries(
  SALARY_RECORD_TYPES.map((t) => [t.value, t.label]),
) as Record<SalaryRecordType, string>;

export function UserDetailClient({
  user,
  initialRecords,
  currency,
}: UserDetailClientProps) {
  const { data: records } = useUserRecords(user.id, initialRecords);
  const documents = records?.documents ?? [];
  const salaryRecords = records?.salaryRecords ?? [];
  const notes = records?.notes ?? [];

  const initial = user.email.trim().charAt(0).toUpperCase() || "?";

  return (
    <div>
      <Link
        href="/dashboard/users"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-admin-text-muted transition-colors hover:text-admin-text"
      >
        <ArrowLeft className="h-4 w-4" /> Back to users
      </Link>

      <PageHeader
        eyebrow="Personnel file"
        title={user.email}
        description="Documents, salary history, and notes for this team member."
      />

      {/* Identity summary */}
      <div className="mb-6 flex flex-wrap items-center gap-4 rounded-2xl border border-admin-border bg-admin-surface p-5">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-admin-accent/10 text-lg font-bold text-admin-accent">
          {initial}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold text-admin-text">
            {user.email}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-admin-text-muted">
            <Badge
              className={
                user.role === "admin"
                  ? "bg-admin-accent/15 text-admin-accent"
                  : "bg-admin-card text-admin-text-secondary"
              }
            >
              {user.role}
            </Badge>
            <Badge
              className={
                user.isActive
                  ? "bg-admin-success/15 text-admin-success"
                  : "bg-admin-danger/15 text-admin-danger"
              }
            >
              {user.isActive ? "Active" : "Off"}
            </Badge>
            {user.isSuperAdmin && (
              <span className="text-admin-accent">Super admin</span>
            )}
            <span>· Joined {formatDate(user.createdAt)}</span>
            {user.lastSignInAt && (
              <span>· Last sign-in {formatDate(user.lastSignInAt)}</span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <SalarySection userId={user.id} records={salaryRecords} currency={currency} />
        <DocumentsSection userId={user.id} documents={documents} />
        <NotesSection userId={user.id} notes={notes} />
      </div>
    </div>
  );
}

function Badge({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest",
        className,
      )}
    >
      {children}
    </span>
  );
}

function SectionCard({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-admin-border bg-admin-surface p-5 sm:p-6">
      <div className="mb-4 flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-admin-accent/10 text-admin-accent">
          {icon}
        </span>
        <div>
          <h2 className="text-base font-bold text-admin-text">{title}</h2>
          <p className="text-xs text-admin-text-muted">{description}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

// ── Salary history ──

function SalarySection({
  userId,
  records,
  currency,
}: {
  userId: string;
  records: UserHrRecords["salaryRecords"];
  currency: { code: string; locale: string };
}) {
  const createSalary = useCreateSalaryRecord(userId);
  const deleteSalary = useDeleteSalaryRecord(userId);
  const confirm = useConfirm();

  const [effectiveDate, setEffectiveDate] = useState(toLocalDateStr(new Date()));
  const [amount, setAmount] = useState("");
  const [type, setType] = useState<SalaryRecordType>("salary");
  const [note, setNote] = useState("");

  // The latest salary/raise entry represents the current base pay.
  const current = records.find((r) => r.type === "salary" || r.type === "raise");

  function handleAdd() {
    const value = parseFloat(amount);
    if (!Number.isFinite(value) || value < 0) {
      notify.error("Enter a valid amount.");
      return;
    }
    if (!effectiveDate) {
      notify.error("Choose an effective date.");
      return;
    }
    createSalary.mutate(
      { effectiveDate, amount: value, type, note: note.trim() || null },
      {
        onSuccess: () => {
          notify.success("Salary entry added.");
          setAmount("");
          setNote("");
          setType("salary");
          setEffectiveDate(toLocalDateStr(new Date()));
        },
      },
    );
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Delete salary entry?",
      description: "This removes the record permanently.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (ok) deleteSalary.mutate(id);
  }

  return (
    <SectionCard
      icon={<Wallet className="h-5 w-5" />}
      title="Salary history"
      description="Pay changes and one-off payments, newest first."
    >
      {current && (
        <div className="mb-4 flex items-baseline gap-2 rounded-xl border border-admin-border bg-admin-card/30 px-4 py-3">
          <span className="text-[11px] font-bold uppercase tracking-wide text-admin-text-muted">
            Current base pay
          </span>
          <span className="text-lg font-extrabold text-admin-text">
            {formatCurrency(current.amount, currency.code, currency.locale)}
          </span>
          <span className="text-xs text-admin-text-muted">
            since {formatDate(current.effectiveDate)}
          </span>
        </div>
      )}

      {/* Add form */}
      <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-admin-border bg-admin-card/20 p-4 sm:grid-cols-12">
        <div className="sm:col-span-3">
          <Field label="Effective date">
            {(p) => (
              <TextInput
                type="date"
                value={effectiveDate}
                onChange={(e) => setEffectiveDate(e.target.value)}
                {...p}
              />
            )}
          </Field>
        </div>
        <div className="sm:col-span-3">
          <Field label="Type">
            {(p) => (
              <Select
                value={type}
                onChange={(e) => setType(e.target.value as SalaryRecordType)}
                {...p}
              >
                {SALARY_RECORD_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="sm:col-span-3">
          <Field label={`Amount (${currency.code})`}>
            {(p) => (
              <TextInput
                type="number"
                min="0"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                {...p}
              />
            )}
          </Field>
        </div>
        <div className="sm:col-span-3">
          <Field label="Note">
            {(p) => (
              <TextInput
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional"
                {...p}
              />
            )}
          </Field>
        </div>
        <div className="flex justify-end sm:col-span-12">
          <Button
            variant="primary"
            onClick={handleAdd}
            loading={createSalary.isPending}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add entry
          </Button>
        </div>
      </div>

      {records.length === 0 ? (
        <EmptyRow>No salary history yet.</EmptyRow>
      ) : (
        <div className="divide-y divide-admin-border">
          {records.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-3 py-3 text-sm"
            >
              <span className="w-24 shrink-0 text-admin-text-muted">
                {formatDate(r.effectiveDate)}
              </span>
              <Badge
                className={
                  r.type === "deduction"
                    ? "bg-admin-danger/15 text-admin-danger"
                    : "bg-admin-card text-admin-text-secondary"
                }
              >
                {SALARY_TYPE_LABELS[r.type]}
              </Badge>
              <span className="font-bold text-admin-text">
                {r.type === "deduction" ? "−" : ""}
                {formatCurrency(r.amount, currency.code, currency.locale)}
              </span>
              {r.note && (
                <span className="min-w-0 flex-1 truncate text-admin-text-muted">
                  {r.note}
                </span>
              )}
              <button
                type="button"
                onClick={() => handleDelete(r.id)}
                aria-label="Delete entry"
                className="ml-auto rounded-lg p-1.5 text-admin-danger/60 transition-colors hover:bg-admin-danger/10 hover:text-admin-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ── Documents ──

function DocumentsSection({
  userId,
  documents,
}: {
  userId: string;
  documents: UserHrRecords["documents"];
}) {
  const createDoc = useCreateUserDocument(userId);
  const deleteDoc = useDeleteUserDocument(userId);
  const confirm = useConfirm();
  const inputRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<UserDocumentCategory>("id");
  const [uploading, setUploading] = useState(false);
  const [pending, setPending] = useState<{
    url: string;
    name: string;
    type: string;
  } | null>(null);

  async function handleFile(file: File) {
    if (!DOC_ACCEPT.split(",").includes(file.type)) {
      notify.error("Only images and PDFs are allowed.");
      return;
    }
    if (file.size > MAX_DOC_MB * 1024 * 1024) {
      notify.error(`File must be under ${MAX_DOC_MB}MB.`);
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const result = await uploadUserDocument(formData);
      if (result.success && result.url) {
        setPending({ url: result.url, name: file.name, type: file.type });
        if (!title.trim()) setTitle(file.name.replace(/\.[^.]+$/, ""));
      } else {
        notify.error(result.error ?? "Upload failed.");
      }
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function handleSave() {
    if (!title.trim()) {
      notify.error("Give the document a title.");
      return;
    }
    if (!pending) {
      notify.error("Upload a file first.");
      return;
    }
    createDoc.mutate(
      {
        title: title.trim(),
        category,
        fileUrl: pending.url,
        fileName: pending.name,
        fileType: pending.type,
      },
      {
        onSuccess: () => {
          notify.success("Document added.");
          setTitle("");
          setCategory("id");
          setPending(null);
        },
      },
    );
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Delete document?",
      description: "This removes the document record permanently.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (ok) deleteDoc.mutate(id);
  }

  return (
    <SectionCard
      icon={<FileText className="h-5 w-5" />}
      title="Documents"
      description="ID, contracts, certificates, and other files. Images and PDFs up to 10MB."
    >
      {/* Add form */}
      <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-admin-border bg-admin-card/20 p-4 sm:grid-cols-12">
        <div className="sm:col-span-5">
          <Field label="Title">
            {(p) => (
              <TextInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Citizenship front"
                {...p}
              />
            )}
          </Field>
        </div>
        <div className="sm:col-span-3">
          <Field label="Category">
            {(p) => (
              <Select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as UserDocumentCategory)
                }
                {...p}
              >
                {USER_DOCUMENT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        </div>
        <div className="sm:col-span-4">
          <Field label="File">
            {() => (
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                disabled={uploading}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-admin-border bg-admin-card/30 px-3 py-2.5 text-xs font-semibold text-admin-text transition-colors hover:border-admin-accent/40 disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Upload className="h-4 w-4 animate-pulse text-admin-accent" />
                    Uploading…
                  </>
                ) : pending ? (
                  <>
                    <Paperclip className="h-4 w-4 text-admin-accent" />
                    <span className="max-w-40 truncate">
                      {pending.name}
                    </span>
                  </>
                ) : (
                  <>
                    <Paperclip className="h-4 w-4 text-admin-text-muted" />
                    Choose file
                  </>
                )}
              </button>
            )}
          </Field>
        </div>
        <div className="flex justify-end sm:col-span-12">
          <Button
            variant="primary"
            onClick={handleSave}
            loading={createDoc.isPending}
            disabled={!pending}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add document
          </Button>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept={DOC_ACCEPT}
          onChange={(e) => {
            if (e.target.files?.length) void handleFile(e.target.files[0]);
          }}
          className="hidden"
        />
      </div>

      {documents.length === 0 ? (
        <EmptyRow>No documents uploaded yet.</EmptyRow>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center gap-3 rounded-xl border border-admin-border bg-admin-card/30 p-3"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-admin-accent/10 text-admin-accent">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 truncate text-sm font-semibold text-admin-text transition-colors hover:text-admin-accent"
                  title={doc.title}
                >
                  <span className="truncate">{doc.title}</span>
                  <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
                <p className="truncate text-[11px] text-admin-text-muted">
                  {USER_DOCUMENT_CATEGORIES.find((c) => c.value === doc.category)
                    ?.label ?? doc.category}
                  {" · "}
                  {formatDate(doc.createdAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(doc.id)}
                aria-label={`Delete ${doc.title}`}
                className="rounded-lg p-1.5 text-admin-danger/60 transition-colors hover:bg-admin-danger/10 hover:text-admin-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </SectionCard>
  );
}

// ── Notes ──

function NotesSection({
  userId,
  notes,
}: {
  userId: string;
  notes: UserHrRecords["notes"];
}) {
  const createNote = useCreateUserNote(userId);
  const deleteNote = useDeleteUserNote(userId);
  const confirm = useConfirm();
  const [body, setBody] = useState("");

  function handleAdd() {
    if (!body.trim()) {
      notify.error("Write a note first.");
      return;
    }
    createNote.mutate(body, {
      onSuccess: () => {
        notify.success("Note added.");
        setBody("");
      },
    });
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: "Delete note?",
      description: "This removes the note permanently.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (ok) deleteNote.mutate(id);
  }

  return (
    <SectionCard
      icon={<StickyNote className="h-5 w-5" />}
      title="Notes"
      description="Freeform notes about this team member, with an audit trail."
    >
      <div className="mb-5">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={2}
          placeholder="Add a note…"
        />
        <div className="mt-2 flex justify-end">
          <Button
            variant="primary"
            onClick={handleAdd}
            loading={createNote.isPending}
          >
            <Plus className="mr-1.5 h-4 w-4" /> Add note
          </Button>
        </div>
      </div>

      {notes.length === 0 ? (
        <EmptyRow>No notes yet.</EmptyRow>
      ) : (
        <ul className="space-y-3">
          {notes.map((n) => (
            <li
              key={n.id}
              className="flex gap-3 rounded-xl border border-admin-border bg-admin-card/30 p-3"
            >
              <div className="min-w-0 flex-1">
                <p className="whitespace-pre-wrap text-sm text-admin-text">
                  {n.body}
                </p>
                <p className="mt-1 text-[11px] text-admin-text-muted">
                  {formatDate(n.createdAt)}
                  {n.createdByEmail ? ` · ${n.createdByEmail}` : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(n.id)}
                aria-label="Delete note"
                className="rounded-lg p-1.5 text-admin-danger/60 transition-colors hover:bg-admin-danger/10 hover:text-admin-danger"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-admin-border bg-admin-card/20 px-4 py-6 text-center text-sm text-admin-text-muted">
      {children}
    </p>
  );
}
