/** A points ledger row: an auto-earned award, a manual redeem, or an adjustment. */
export type LoyaltyTransactionType = "earn" | "redeem" | "adjust";

export const LOYALTY_TRANSACTION_TYPES: {
  value: LoyaltyTransactionType;
  label: string;
}[] = [
  { value: "earn", label: "Earn" },
  { value: "redeem", label: "Redeem" },
  { value: "adjust", label: "Adjustment" },
];

export const LOYALTY_TYPE_LABELS: Record<LoyaltyTransactionType, string> = {
  earn: "Earned",
  redeem: "Redeemed",
  adjust: "Adjustment",
};

/** A person the shop sells to. */
export interface Customer {
  id: string;
  name: string | null;
  /** Identity key: POS sales are matched/linked by phone. Null when unset. */
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  /**
   * Subscribed to the shop's member program. Nothing acts on it yet: the member
   * perks (special pricing, discounts) are still to be built, so today it is
   * only recorded and displayed. Defaults to false for every customer.
   */
  isMember: boolean;
  /** Date of birth as `YYYY-MM-DD`. Collected at membership signup; optional. */
  dob: string | null;
  /** Government ID recorded at membership signup. Optional, not unique. */
  citizenshipNumber: string | null;
  /**
   * Object path of the citizenship photo in the PRIVATE `customer-documents`
   * bucket — not a URL. Viewing it requires a signed URL from
   * `fetchCitizenshipPhotoUrl`, so the document is never publicly readable.
   */
  citizenshipPhotoPath: string | null;
  sortOrder: number;
  createdByEmail: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerRow {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  is_member: boolean;
  dob: string | null;
  citizenship_number: string | null;
  citizenship_photo_path: string | null;
  sort_order: number;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

/** One points movement against a customer. */
export interface LoyaltyTransaction {
  id: string;
  customerId: string;
  type: LoyaltyTransactionType;
  /** Signed: earn/credit positive, redeem/debit negative. Balance = Σ points. */
  points: number;
  txnDate: string;
  /** Set on auto-earned rows, linking the award to its sale. */
  saleId: string | null;
  note: string | null;
  createdByEmail: string | null;
  createdAt: string;
}

export interface LoyaltyTransactionRow {
  id: string;
  customer_id: string;
  type: LoyaltyTransactionType;
  points: number;
  txn_date: string;
  sale_id: string | null;
  note: string | null;
  created_by: string | null;
  created_by_email: string | null;
  created_at: string;
}

/** A customer plus its derived points balance, for list/summary views. */
export interface CustomerWithBalance extends Customer {
  /** Σ(signed points) across the loyalty ledger. */
  pointsBalance: number;
  /** Number of ledger rows recorded against this customer. */
  transactionCount: number;
}

/** Fields accepted when creating/editing a customer. */
export interface CustomerInput {
  name?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  isActive?: boolean;
  isMember?: boolean;
  dob?: string | null;
  citizenshipNumber?: string | null;
}

/**
 * What the public membership form submits. Deliberately separate from
 * `CustomerInput`: it is filled in by an unauthenticated visitor, so it carries
 * no `isActive`/`isMember`/`notes` (the service decides those) and adds the
 * honeypot field used to drop bot submissions.
 */
export interface MembershipSignupInput {
  name: string;
  /** The member's WhatsApp number. Stored in `customers.phone`. */
  phone: string;
  email?: string;
  address?: string;
  /** `YYYY-MM-DD` from a native date input. */
  dob?: string;
  citizenshipNumber?: string;
  /**
   * Honeypot. Hidden from real users by CSS, so any non-empty value means a
   * bot filled the form in. Never stored.
   */
  website?: string;
}

/**
 * Every control the membership form can flag. The citizenship photo is not part
 * of `MembershipSignupInput` — a file cannot ride in a plain object, so it is
 * submitted alongside it as FormData — but it still needs to be addressable so
 * an upload error lands on the right control.
 */
export type MembershipFormField =
  | keyof MembershipSignupInput
  | "citizenshipPhoto";

/** Outcome of a public membership submission. */
export interface MembershipSignupResult {
  success: boolean;
  error?: string;
  /** Which field the error belongs to, so the form can highlight it. */
  field?: MembershipFormField;
}

/** Fields accepted when recording a manual loyalty entry. `points` is the
 * magnitude the user enters; the service applies the sign from `type`. */
export interface LoyaltyTransactionInput {
  customerId: string;
  type: LoyaltyTransactionType;
  /** Magnitude for earn/redeem; may be signed for `adjust`. */
  points: number;
  txnDate: string;
  note?: string | null;
}

/** A single sale linked to a customer, for the detail-page purchase history. */
export interface CustomerSale {
  id: string;
  saleNumber: number;
  total: number;
  saleDate: string;
  createdAt: string;
}
