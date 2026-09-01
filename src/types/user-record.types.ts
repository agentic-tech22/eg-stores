/**
 * Admin-only HR records attached to a user account: uploaded documents, salary
 * history, and a notes timeline. Shown on the user detail page. All are
 * business-private (service-role reads/writes, gated by `admin` in app code).
 */

// ── Documents ──

export type UserDocumentCategory =
  | "id"
  | "contract"
  | "certificate"
  | "payslip"
  | "other";

export const USER_DOCUMENT_CATEGORIES: {
  value: UserDocumentCategory;
  label: string;
}[] = [
  { value: "id", label: "ID / KYC" },
  { value: "contract", label: "Contract" },
  { value: "certificate", label: "Certificate" },
  { value: "payslip", label: "Payslip" },
  { value: "other", label: "Other" },
];

export interface UserDocument {
  id: string;
  userId: string;
  title: string;
  category: UserDocumentCategory;
  fileUrl: string;
  fileName: string;
  fileType: string;
  notes: string | null;
  createdByEmail: string | null;
  createdAt: string;
}

export interface UserDocumentRow {
  id: string;
  user_id: string;
  title: string;
  category: UserDocumentCategory;
  file_url: string;
  file_name: string;
  file_type: string;
  notes: string | null;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
}

export interface CreateUserDocumentInput {
  title: string;
  category: UserDocumentCategory;
  fileUrl: string;
  fileName: string;
  fileType: string;
  notes?: string | null;
}

// ── Salary history ──

export type SalaryRecordType =
  | "salary"
  | "raise"
  | "bonus"
  | "advance"
  | "deduction";

export const SALARY_RECORD_TYPES: {
  value: SalaryRecordType;
  label: string;
}[] = [
  { value: "salary", label: "Salary" },
  { value: "raise", label: "Raise" },
  { value: "bonus", label: "Bonus" },
  { value: "advance", label: "Advance" },
  { value: "deduction", label: "Deduction" },
];

export interface SalaryRecord {
  id: string;
  userId: string;
  effectiveDate: string;
  amount: number;
  type: SalaryRecordType;
  note: string | null;
  createdByEmail: string | null;
  createdAt: string;
}

export interface SalaryRecordRow {
  id: string;
  user_id: string;
  effective_date: string;
  amount: number;
  type: SalaryRecordType;
  note: string | null;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
}

export interface CreateSalaryRecordInput {
  effectiveDate: string;
  amount: number;
  type: SalaryRecordType;
  note?: string | null;
}

// ── Notes ──

export interface UserNote {
  id: string;
  userId: string;
  body: string;
  createdByEmail: string | null;
  createdAt: string;
}

export interface UserNoteRow {
  id: string;
  user_id: string;
  body: string;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
}

/** A user's full personnel file, as loaded by the detail page. */
export interface UserHrRecords {
  documents: UserDocument[];
  salaryRecords: SalaryRecord[];
  notes: UserNote[];
}
