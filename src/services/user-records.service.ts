"use server";

import { createAdminClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import type {
  CreateSalaryRecordInput,
  CreateUserDocumentInput,
  SalaryRecord,
  SalaryRecordRow,
  UserDocument,
  UserDocumentRow,
  UserHrRecords,
  UserNote,
  UserNoteRow,
} from "@/types/user-record.types";

type Result = { success: boolean; error?: string };

function authError(err: unknown): Result {
  return {
    success: false,
    error: err instanceof Error ? err.message : "Not authorized.",
  };
}

// ── Mappers ──

function mapDocument(row: UserDocumentRow): UserDocument {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    category: row.category,
    fileUrl: row.file_url,
    fileName: row.file_name,
    fileType: row.file_type,
    notes: row.notes,
    createdByEmail: row.created_by_email,
    createdAt: row.created_at,
  };
}

function mapSalary(row: SalaryRecordRow): SalaryRecord {
  return {
    id: row.id,
    userId: row.user_id,
    effectiveDate: row.effective_date,
    amount: Number(row.amount),
    type: row.type,
    note: row.note,
    createdByEmail: row.created_by_email,
    createdAt: row.created_at,
  };
}

function mapNote(row: UserNoteRow): UserNote {
  return {
    id: row.id,
    userId: row.user_id,
    body: row.body,
    createdByEmail: row.created_by_email,
    createdAt: row.created_at,
  };
}

// ── Bundled read for the detail page ──

/** Reads a user's full personnel file (documents, salary, notes). Admin only. */
export async function fetchUserRecords(userId: string): Promise<UserHrRecords> {
  await requireAdmin();
  const admin = createAdminClient();

  const [docs, salary, notes] = await Promise.all([
    admin
      .from("user_documents")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
    admin
      .from("user_salary_records")
      .select("*")
      .eq("user_id", userId)
      .order("effective_date", { ascending: false })
      .order("created_at", { ascending: false }),
    admin
      .from("user_notes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);

  return {
    documents: ((docs.data as UserDocumentRow[]) ?? []).map(mapDocument),
    salaryRecords: ((salary.data as SalaryRecordRow[]) ?? []).map(mapSalary),
    notes: ((notes.data as UserNoteRow[]) ?? []).map(mapNote),
  };
}

// ── Documents ──

export async function createUserDocument(
  userId: string,
  input: CreateUserDocumentInput,
): Promise<Result> {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (err) {
    return authError(err);
  }

  const title = input.title.trim();
  if (!title) return { success: false, error: "A document title is required." };
  if (!input.fileUrl) return { success: false, error: "Upload a file first." };

  const admin = createAdminClient();
  const { error } = await admin.from("user_documents").insert({
    user_id: userId,
    title,
    category: input.category,
    file_url: input.fileUrl,
    file_name: input.fileName,
    file_type: input.fileType,
    notes: input.notes?.trim() || null,
    created_by: ctx.userId,
    created_by_email: ctx.email,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteUserDocument(documentId: string): Promise<Result> {
  try {
    await requireAdmin();
  } catch (err) {
    return authError(err);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_documents")
    .delete()
    .eq("id", documentId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── Salary history ──

export async function createSalaryRecord(
  userId: string,
  input: CreateSalaryRecordInput,
): Promise<Result> {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (err) {
    return authError(err);
  }

  if (!input.effectiveDate) {
    return { success: false, error: "An effective date is required." };
  }
  if (!Number.isFinite(input.amount) || input.amount < 0) {
    return { success: false, error: "Enter a valid amount." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("user_salary_records").insert({
    user_id: userId,
    effective_date: input.effectiveDate,
    amount: input.amount,
    type: input.type,
    note: input.note?.trim() || null,
    created_by: ctx.userId,
    created_by_email: ctx.email,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteSalaryRecord(recordId: string): Promise<Result> {
  try {
    await requireAdmin();
  } catch (err) {
    return authError(err);
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("user_salary_records")
    .delete()
    .eq("id", recordId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

// ── Notes ──

export async function createUserNote(
  userId: string,
  body: string,
): Promise<Result> {
  let ctx;
  try {
    ctx = await requireAdmin();
  } catch (err) {
    return authError(err);
  }

  const trimmed = body.trim();
  if (!trimmed) return { success: false, error: "Write a note first." };

  const admin = createAdminClient();
  const { error } = await admin.from("user_notes").insert({
    user_id: userId,
    body: trimmed,
    created_by: ctx.userId,
    created_by_email: ctx.email,
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteUserNote(noteId: string): Promise<Result> {
  try {
    await requireAdmin();
  } catch (err) {
    return authError(err);
  }

  const admin = createAdminClient();
  const { error } = await admin.from("user_notes").delete().eq("id", noteId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}
