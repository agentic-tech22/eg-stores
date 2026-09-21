-- ============================================================
-- Migration: sales/order channel + order-level discount
-- ============================================================
-- Run this ONCE against an existing database. `supabase-schema.sql` is a full
-- drop-and-recreate script and would destroy data, so it is not the right tool
-- for a live shop: it already contains everything below for fresh installs.
--
-- Safe to re-run: every step is guarded.
--
--   1. sales.channel    — 'shop' | 'online', how the sale was made
--   2. orders.channel   — same vocabulary, carried onto the sale at conversion
--   3. orders.discount_amount — order-level discount, so total = subtotal - discount
--   4. backfill         — converted sales adopt 'online' so they agree with
--                         the order they came from
--
-- Wrapped in a transaction: if any step fails, nothing is applied.
--
-- DEPLOY ORDER: run this BEFORE deploying the app. The new app code writes
-- these columns, so shipping the code first would break sale creation. In this
-- order the currently-deployed code keeps working untouched, because every new
-- column has a default.
--
-- NOTE on `channel` vs `orders.source`: they are different questions and are
-- NOT interchangeable. `orders.source` ('admin'|'storefront') records who keyed
-- an order in. `channel` ('shop'|'online') records how the customer bought.

BEGIN;

-- 1. Sales channel -----------------------------------------------------------
-- Existing rows land on 'shop', corrected for converted sales in step 4.
ALTER TABLE sales
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'shop';

-- Idempotent: the original constraint would be the inline CHECK from
-- CREATE TABLE, which Postgres auto-names <table>_<column>_check.
ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_channel_check;
ALTER TABLE sales ADD CONSTRAINT sales_channel_check
  CHECK (channel IN ('shop','online'));

CREATE INDEX IF NOT EXISTS idx_sales_channel ON sales(channel);

-- 2. Order channel -----------------------------------------------------------
-- Every existing order shipped to a customer address, so 'online' is correct
-- for all of them.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'online';

ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_channel_check;
ALTER TABLE orders ADD CONSTRAINT orders_channel_check
  CHECK (channel IN ('shop','online'));

CREATE INDEX IF NOT EXISTS idx_orders_channel ON orders(channel);

-- 3. Order-level discount -----------------------------------------------------
-- Existing orders have no discount, so 0 leaves their totals untouched.
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0;

-- 4. Backfill converted sales -------------------------------------------------
-- The defaults above put every existing sale on 'shop'. The one correction: a
-- sale that came from an order is an online sale, and should agree with the
-- order it was converted from. Re-running is a no-op (those rows already read
-- 'online' after the first pass).
UPDATE sales
SET channel = 'online'
WHERE order_id IS NOT NULL
  AND channel <> 'online';

COMMIT;

-- ============================================================
-- Not done here, on purpose
-- ============================================================
-- Order totals corrupted by the old NCM ship step (which rewrote
-- `total = subtotal + cod_charge`, doubling it) are NOT repaired by this
-- migration. The application fix stops it happening again; existing damage is
-- a separate, deliberate decision. To see what is affected:
--
--   SELECT id, order_number, subtotal, cod_charge, total
--   FROM orders
--   WHERE total <> subtotal - discount_amount;
