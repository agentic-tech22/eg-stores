-- ============================================================
-- Migration: partial payments / due tracking for sales
-- ============================================================
-- Run this ONCE against an existing database. `supabase-schema.sql` is a full
-- drop-and-recreate script and would destroy data, so it is not the right tool
-- for a live shop: it already contains everything below for fresh installs.
--
-- Safe to re-run: every step is guarded.
--
--   1. sale_payments  — the collection ledger (who took how much, and when)
--   2. payment_status — allow the new 'partial' state
--   3. backfill       — one ledger row per already-paid sale, so existing
--                       history doesn't suddenly read as fully unpaid
--
-- Wrapped in a transaction: if any step fails, nothing is applied.

BEGIN;

-- 1. Collection ledger -------------------------------------------------------
CREATE TABLE IF NOT EXISTS sale_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id          UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  amount           NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  paid_on          DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method   TEXT NOT NULL DEFAULT 'cash'
                     CHECK (payment_method IN ('cash','esewa','khalti','ime_pay','bank','credit','fonepay')),
  note             TEXT,
  received_by       UUID,
  received_by_email TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_payments_sale
  ON sale_payments(sale_id, paid_on DESC);

ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;

-- 2. Allow the 'partial' settlement state ------------------------------------
-- The original constraint is the inline CHECK from CREATE TABLE, which Postgres
-- auto-names <table>_<column>_check.
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_payment_status_check;
ALTER TABLE sales ADD CONSTRAINT sales_payment_status_check
  CHECK (payment_status IN ('pending','partial','paid','failed'));

-- 3. Backfill the ledger for sales already marked paid ------------------------
-- Without this, every historic paid sale would show its full total as due.
-- Attribution falls back to whoever recorded the sale, and the collection date
-- to the sale date, which is the best information we have retrospectively.
-- The NOT EXISTS guard makes re-running this a no-op.
INSERT INTO sale_payments (
  sale_id, amount, paid_on, payment_method, note, received_by, received_by_email
)
SELECT
  s.id,
  s.total,
  s.sale_date,
  s.payment_method,
  'Backfilled from sale payment status',
  s.created_by,
  s.created_by_email
FROM sales s
WHERE s.payment_status = 'paid'
  AND s.total > 0
  AND NOT EXISTS (SELECT 1 FROM sale_payments p WHERE p.sale_id = s.id);

COMMIT;
