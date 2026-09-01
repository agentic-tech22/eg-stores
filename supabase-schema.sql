-- ============================================================
-- Up Site: Database Schema (Product Catalog)
-- ============================================================
-- This file is IDEMPOTENT. Run it on a fresh DB or re-run
-- anytime to reset to the default structure + seed data.
--
-- RULE: Any future migration must be added to this file.
-- AI agents must append new tables/columns here, never
-- create separate migration files.
-- ============================================================

-- ============================================================
-- 1. DROP ALL (safe reset)
-- ============================================================

-- Order/courier tables first (children before parents). product_variants must
-- drop before products is recreated below.
DROP TABLE IF EXISTS app_subscription CASCADE;
DROP TABLE IF EXISTS pending_esewa_checkouts CASCADE;
DROP TABLE IF EXISTS invoice_items CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS business_profile CASCADE;
DROP TABLE IF EXISTS sale_payments CASCADE;
DROP TABLE IF EXISTS extra_sale_items CASCADE;
DROP TABLE IF EXISTS sale_items CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS combo_items CASCADE;
DROP TABLE IF EXISTS order_items CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
-- Warehouse tables: stock_movements/warehouse_stock reference products, variants
-- and warehouses; drop them before those parents. warehouses is dropped after
-- everything that references it (warehouse_stock, stock_movements, orders, sales,
-- product_stock_entries, all CASCADE-dropped above/below).
-- User HR records (admin-only personnel file); independent of each other.
DROP TABLE IF EXISTS user_documents CASCADE;
DROP TABLE IF EXISTS user_salary_records CASCADE;
DROP TABLE IF EXISTS user_notes CASCADE;

-- Vendor tables: vendor_transactions references vendors, so drop it first.
DROP TABLE IF EXISTS vendor_transactions CASCADE;
DROP TABLE IF EXISTS vendors CASCADE;
-- Business expenses stand alone (no FKs), so ordering does not matter here.
DROP TABLE IF EXISTS business_expenses CASCADE;
-- Customer tables: loyalty_transactions references customers (and sales), so
-- drop it first. CASCADE clears the sales.customer_id FK regardless of order.
DROP TABLE IF EXISTS loyalty_transactions CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS stock_movements CASCADE;
DROP TABLE IF EXISTS warehouse_stock CASCADE;
DROP TABLE IF EXISTS product_price_changes CASCADE;
DROP TABLE IF EXISTS product_stock_entries CASCADE;
DROP TABLE IF EXISTS product_variants CASCADE;
DROP TABLE IF EXISTS ncm_branches CASCADE;
DROP TABLE IF EXISTS ncm_settings CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS warehouses CASCADE;
-- categories is referenced by products.category_id; dropping products above
-- (CASCADE) clears the FK, so categories can be dropped right after.
DROP TABLE IF EXISTS categories CASCADE;
-- The product SKU sequence is referenced by a column DEFAULT (not owned by the
-- table), so dropping products doesn't remove it, so drop it explicitly, after
-- the table that depends on it.
DROP SEQUENCE IF EXISTS product_sku_seq;
-- Same for the shared barcode sequence (products + product_variants DEFAULTs).
DROP SEQUENCE IF EXISTS barcode_seq;
-- NOTE: We intentionally do NOT drop `profiles` on reset because it
-- references auth.users (managed by Supabase Auth) and holds the
-- role/permission grants for real accounts. Dropping it would wipe
-- every user's access. To reset profiles, do it manually.

-- ============================================================
-- 2. TABLE DEFINITIONS
-- ============================================================

-- 2.0 Categories
-- Parent categories for products (e.g. Pants, Shirts, Shoes). A product belongs
-- to at most one category via products.category_id. Managed in the dashboard;
-- publicly readable so the storefront can group/filter by category.
CREATE TABLE categories (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT categories_name_unique UNIQUE (name)
);

-- 2.0b Warehouses
-- Physical stock locations. The same product/variant can be stocked in several
-- warehouses, each with its own count (see warehouse_stock). Exactly one row is
-- the default (partial unique index idx_warehouses_one_default), used to prefill
-- the warehouse selector on sales/orders and as the fulfillment location for
-- public storefront checkout (customers don't pick one). Publicly readable so the
-- storefront can compute per-warehouse availability; writes via service role.
CREATE TABLE warehouses (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  -- Short human code (e.g. "MAIN", "KTM"). Optional but unique when set.
  code       TEXT,
  address    TEXT,
  phone      TEXT,
  -- Exactly one warehouse has is_default = TRUE (enforced by a partial unique
  -- index). Soft-disable a location with is_active = FALSE instead of deleting.
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT warehouses_code_unique UNIQUE (code)
);

-- 2.0c Vendors
-- Suppliers the business buys from. A master record holding contact + tax
-- details plus an opening payable balance carried forward at onboarding. The
-- amount currently owed is NOT stored here: it is derived from the ledger in
-- vendor_transactions (opening_balance + Σ bills − Σ payments) to avoid drift.
-- Business-private: service-role only (no RLS policies), gated by vendors.* in
-- app code. Soft-disable a vendor with is_active = FALSE instead of deleting.
CREATE TABLE vendors (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT NOT NULL,
  -- Short human code (e.g. "ACME"). Optional but unique when set.
  code           TEXT,
  contact_person TEXT,
  phone          TEXT,
  email          TEXT,
  address        TEXT,
  -- Nepal tax identifiers. PAN for non-VAT vendors, VAT number for VAT-registered.
  pan_number     TEXT,
  vat_number     TEXT,
  -- Payable balance owed to this vendor at the time it was added to the system.
  opening_balance NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes          TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order     INTEGER DEFAULT 0,
  created_by       UUID,
  created_by_email TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT vendors_code_unique UNIQUE (code)
);

-- 2.0d Vendor transactions (accounts-payable ledger)
-- One row per bill received from a vendor OR payment made to them. A `bill`
-- increases the payable, a `payment` decreases it. The vendor's outstanding
-- balance is computed from these rows, never stored. Bills may carry scanned
-- attachments (photos/PDFs) in the `attachments` JSONB array, each an object
-- { url, name, type } pointing at the public `vendor-bills` storage bucket.
CREATE TABLE vendor_transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id      UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  type           TEXT NOT NULL DEFAULT 'bill'
                   CHECK (type IN ('bill','payment')),
  txn_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Supplier's bill/invoice number (bills) or cheque/reference no. (payments).
  bill_number    TEXT,
  reference      TEXT,
  -- Bills: subtotal + tax_amount = amount. Payments: only `amount` is used.
  subtotal       NUMERIC(10,2) NOT NULL DEFAULT 0,
  tax_amount     NUMERIC(10,2) NOT NULL DEFAULT 0,
  amount         NUMERIC(10,2) NOT NULL DEFAULT 0,
  -- How a payment was made; null on bills. Paying a supplier is a two-way
  -- choice in practice, so the form offers only 'cash' and 'online' (which
  -- wallet or bank is noted in `reference`). The POS methods stay in the list
  -- for rows written before it was narrowed.
  payment_method TEXT
                   CHECK (payment_method IN ('cash','online','esewa','khalti','ime_pay','bank','credit','fonepay')),
  -- Per-bill settlement state; null on payments. A 'paid' bill was settled when
  -- it was recorded (no separate payment row), so it is excluded from the
  -- vendor's outstanding payable.
  status         TEXT
                   CHECK (status IN ('unpaid','paid')),
  -- The date a bill was settled. Set when status flips to 'paid', cleared when
  -- it goes back to 'unpaid'. Always null on payments (they carry txn_date).
  paid_at        DATE,
  attachments    JSONB NOT NULL DEFAULT '[]',
  notes          TEXT,
  created_by       UUID,
  created_by_email TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- `vendor_transactions` IS dropped on reset, so the CHECK above covers a fresh
-- DB. A provisioned one can't be reset, and its constraint predates 'online',
-- so every vendor payment recorded from the narrowed form would be rejected.
-- Re-stating the constraint here lets an existing database take the new value
-- on its own; it is a no-op immediately after a full reset. DROP ... IF EXISTS
-- first because ADD CONSTRAINT has no IF NOT EXISTS form.
ALTER TABLE vendor_transactions
  DROP CONSTRAINT IF EXISTS vendor_transactions_payment_method_check;
ALTER TABLE vendor_transactions
  ADD CONSTRAINT vendor_transactions_payment_method_check
  CHECK (payment_method IN ('cash','online','esewa','khalti','ime_pay','bank','credit','fonepay'));

-- `vendor_transactions` IS dropped on reset, so the definition above is enough
-- for a fresh DB. A provisioned one holding a real payable ledger can't be
-- reset, though, and every bill write now sets paid_at, so these idempotent
-- statements let an existing database take the settlement date and the
-- two-state status on its own. No-ops immediately after a full reset.
ALTER TABLE vendor_transactions ADD COLUMN IF NOT EXISTS paid_at DATE;
-- 'partial' carried no paid amount, so it weighed on the payable in full,
-- exactly like 'unpaid'. Collapse it there before tightening the constraint.
UPDATE vendor_transactions SET status = 'unpaid' WHERE status = 'partial';
ALTER TABLE vendor_transactions DROP CONSTRAINT IF EXISTS vendor_transactions_status_check;
ALTER TABLE vendor_transactions ADD CONSTRAINT vendor_transactions_status_check
  CHECK (status IN ('unpaid','paid'));
-- Bills already marked paid predate the column; their own bill date is the best
-- settlement date available in hindsight.
UPDATE vendor_transactions SET paid_at = txn_date
 WHERE type = 'bill' AND status = 'paid' AND paid_at IS NULL;

-- 2.0d-ii Business expenses (operating cost ledger)
-- One row per cost the business pays that is NOT stock and NOT payroll: rent,
-- utilities, transport, repairs, fees. Deliberately separate from
-- vendor_transactions (which tracks what is OWED to a supplier) — an expense is
-- money already spent, so it has no settlement state and no balance.
--
-- Employee pay is NOT stored here either. The Expenses page derives its salary
-- total from `user_salary_records`, the existing personnel file, so payroll has
-- exactly one home and cannot drift between two tables.
--
-- `category` is deliberately free text: shops name their costs differently, and
-- a fixed enum would need a migration every time one is added. Totals group on
-- the trimmed value.
CREATE TABLE business_expenses (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  category       TEXT,
  amount         NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (amount >= 0),
  expense_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  -- How it was paid. Mirrors the vendor payment list (cash or online); which
  -- wallet or bank moved the money belongs in `reference`.
  payment_method TEXT NOT NULL DEFAULT 'cash'
                   CHECK (payment_method IN ('cash','online')),
  reference      TEXT,
  notes          TEXT,
  -- Receipt photos/PDFs in the public `expense-receipts` bucket, each an object
  -- { url, name, type }; same shape as vendor bill attachments.
  attachments    JSONB NOT NULL DEFAULT '[]',
  created_by       UUID,
  created_by_email TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- 2.0e Customers (loyalty master record)
-- People the shop sells to. Created/linked automatically from POS sales when a
-- phone number is entered (phone is the identity key), and manageable directly
-- in the dashboard. Their loyalty-points balance is NOT stored here: it is
-- derived from the ledger in loyalty_transactions (Σ signed points) to avoid
-- drift, exactly like the vendor payable model. Business-private: service-role
-- only (no RLS policies), gated by customers.* in app code. Soft-disable with
-- is_active = FALSE instead of deleting.
CREATE TABLE customers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           TEXT,
  -- Phone is the identity key: POS sales are matched/linked by it. Unique when set.
  phone          TEXT,
  email          TEXT,
  address        TEXT,
  notes          TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  -- Membership flag: a customer who has subscribed to the shop's member program.
  -- Nothing acts on it yet; the perks (special pricing, member discounts) are
  -- still to be built. Defaults FALSE so every existing customer, and every one
  -- the POS auto-creates from a phone number, starts as a non-member.
  is_member      BOOLEAN NOT NULL DEFAULT FALSE,
  -- Membership enrolment details, collected by the public /membership signup
  -- form (QR poster in the shop) and editable in the dashboard. Both optional:
  -- name + phone are the only fields the form requires, and POS-created
  -- customers never have them.
  dob                 DATE,
  citizenship_number  TEXT,
  -- Object PATH (not a URL) of the citizenship photo inside the PRIVATE
  -- `customer-documents` bucket, e.g. 'citizenship/<customer-id>.jpg'. It is an
  -- identity document, so it is never public: the dashboard renders it through
  -- a short-lived signed URL minted server-side by a customers.view-gated action.
  citizenship_photo_path TEXT,
  sort_order     INTEGER DEFAULT 0,
  created_by       UUID,
  created_by_email TEXT,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT customers_phone_unique UNIQUE (phone)
);

-- `customers` IS dropped on reset, so the column above is enough for a fresh
-- DB. A provisioned one holding real customers can't be reset, though, and
-- createCustomer writes is_member on every insert, so without the column every
-- new customer save fails. This idempotent ALTER lets an existing database take
-- the column on its own; it is a no-op immediately after a full reset.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS is_member BOOLEAN NOT NULL DEFAULT FALSE;

-- Same reasoning for the membership enrolment fields: the public signup form
-- writes both on every submission, so an existing database needs them before
-- the first member can enrol. No-ops immediately after a full reset.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS citizenship_number TEXT;
ALTER TABLE customers ADD COLUMN IF NOT EXISTS citizenship_photo_path TEXT;

-- 2.1 Products
-- Auto-generated, locked product SKU counter. Drives the products.sku DEFAULT
-- so every product (simple, variant-parent, combo) gets a unique base SKU with
-- no app involvement. Re-created on every reset (dropped in Section 1).
CREATE SEQUENCE product_sku_seq START 1;

-- Auto-barcode counter, SHARED by products.barcode and product_variants.barcode
-- so an auto-assigned code is unique across both tables (a scan maps to one
-- item). Used only when a row is inserted without an explicit barcode.
CREATE SEQUENCE barcode_seq START 1;

CREATE TABLE products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  description TEXT,
  price       NUMERIC(10,2) NOT NULL,
  -- Auto-generated, locked, unique base SKU. Assigned entirely DB-side via the
  -- product_sku_seq DEFAULT; app code never sets or edits it. Variant products
  -- ALSO keep their own per-variant product_variants.sku (unchanged).
  sku         TEXT NOT NULL UNIQUE DEFAULT ('SKU-' || lpad(nextval('product_sku_seq')::text, 5, '0')),
  -- Purchase/cost price, used to compute profit on sales. Required so profit is
  -- always derivable; defaults to 0 only as a safety net for direct inserts.
  cost_price  NUMERIC(10,2) NOT NULL DEFAULT 0,
  image_url   TEXT,
  images      JSONB NOT NULL DEFAULT '[]'::JSONB,
  is_featured BOOLEAN DEFAULT FALSE,
  -- Storefront visibility. When FALSE the product is kept in the catalog but
  -- hidden from the public website (grid, homepage, and direct detail URL).
  -- Defaults TRUE so products are listed unless explicitly hidden.
  is_visible  BOOLEAN NOT NULL DEFAULT TRUE,
  -- A combo is a product that bundles other products at a discounted price. Its
  -- own stock columns are unused: availability is derived from its components
  -- (see combo_items). `price` holds the discounted combo price.
  is_combo    BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order  INTEGER DEFAULT 0,
  -- Optional parent category. ON DELETE SET NULL so removing a category simply
  -- un-categorizes its products rather than deleting them.
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  -- Scannable barcode for point-of-sale (UPC/EAN or custom). Distinct from `sku`.
  -- Auto-assigned from barcode_seq when a product is inserted without one, so
  -- every product is always scannable; can be overridden with a real barcode.
  -- Unique (see index). For variant products the scannable code also lives on
  -- each product_variants row.
  barcode     TEXT DEFAULT (lpad(nextval('barcode_seq')::text, 8, '0')),
  -- Inventory. When has_variants = TRUE, stock lives on product_variants and
  -- these two columns are ignored; otherwise stock is tracked here.
  has_variants      BOOLEAN NOT NULL DEFAULT FALSE,
  stock_quantity    INTEGER NOT NULL DEFAULT 0,
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  -- When this product's barcode label was last printed from the Barcodes page
  -- (NULL = never printed). Lets the admin see, at a glance, which codes have
  -- already been run off. For variant products the flag lives per-variant instead.
  barcode_printed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 2.3 Product variants
-- Optional per-product variations (e.g. Color/Size). `attributes` is a flexible
-- key/value map; `display_name` is the human label ("Red / M"). Stock + the
-- reservation counter live here when products.has_variants = TRUE.
CREATE TABLE product_variants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  attributes        JSONB NOT NULL DEFAULT '{}'::JSONB,
  display_name      TEXT NOT NULL,
  sku               TEXT,
  -- Scannable barcode for this variant. Auto-assigned from the shared barcode_seq
  -- when inserted without one; unique (see index). Can be overridden.
  barcode           TEXT DEFAULT (lpad(nextval('barcode_seq')::text, 8, '0')),
  price_override    NUMERIC(10,2),
  image_url         TEXT,
  stock_quantity    INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  -- When this variant's barcode label was last printed (NULL = never printed).
  barcode_printed_at TIMESTAMPTZ,
  archived          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT product_variants_unique_combo UNIQUE (product_id, attributes)
);

-- 2.3b Combo items
-- The components of a combo product. `combo_id` is the bundling product
-- (products.is_combo = TRUE); `component_id` is a simple (non-variant, non-combo)
-- product included `quantity` times. A combo's availability is derived from the
-- scarcest component (see computeComboAvailability); combos have no stock of
-- their own. ON DELETE RESTRICT stops a product being deleted while it is still
-- part of a combo.
CREATE TABLE combo_items (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  combo_id     UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  component_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  quantity     INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at   TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT combo_items_unique UNIQUE (combo_id, component_id)
);

-- 2.x Product stock entries (restock history)
-- One row per restock: a positive batch of units imported from a supplier,
-- with the per-unit cost paid at that moment. Kept as an append-only ledger so
-- the admin can review when and at what cost stock was replenished. `variant_id`
-- is set when the restocked stock lives on a specific variant. The actual stock
-- counter is bumped via adjust_product_stock / adjust_variant_stock alongside
-- the insert.
CREATE TABLE product_stock_entries (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id       UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity         INTEGER NOT NULL CHECK (quantity > 0),
  -- Per-unit cost paid to the supplier for this batch. Financial data, so it is
  -- only recorded/returned for callers with the `finances.view` grant; null when
  -- unknown or withheld.
  unit_cost        NUMERIC(10,2),
  note             TEXT,
  -- Which warehouse this batch was restocked into. Nullable/SET NULL so the
  -- ledger survives a warehouse being removed.
  warehouse_id     UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  -- Who recorded the restock (denormalized email so history survives profile
  -- deletion). created_by has no FK so the ledger is never cascade-deleted.
  created_by       UUID,
  created_by_email TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 2.x Warehouse stock (per-location inventory: SOURCE OF TRUTH)
-- One row per (warehouse, product) for simple products and per (warehouse,
-- variant) for variant products. This is the authoritative on-hand + reserved
-- count per location. The scalar stock_quantity/reserved_quantity columns on
-- products/product_variants are kept as CACHED TOTALS (sum across warehouses),
-- maintained by the stock RPCs in the same transaction, so every existing read
-- path (storefront, combos, lists, barcode search) keeps working unchanged.
-- NULL-variant uniqueness needs two partial unique indexes (see Section 3);
-- those are also the ON CONFLICT inference targets for upserts.
CREATE TABLE warehouse_stock (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- RESTRICT: a warehouse holding stock rows cannot be hard-deleted.
  warehouse_id      UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  product_id        UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id        UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  stock_quantity    INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
  reserved_quantity INTEGER NOT NULL DEFAULT 0 CHECK (reserved_quantity >= 0),
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- 2.x Stock movements (unified audit ledger)
-- Append-only history of manual stock EDITS, TRANSFERS between warehouses, and
-- DELETIONS, so a product's full history is reconstructable from one place
-- (restocks stay in product_stock_entries; price changes in
-- product_price_changes). FKs are ON DELETE SET NULL, NOT cascade, and the
-- product_title/variant_label snapshots preserve the label, so a 'deletion'
-- event survives the very deletion it records.
CREATE TABLE stock_movements (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type              TEXT NOT NULL CHECK (type IN ('edit','transfer','deletion')),
  product_id        UUID REFERENCES products(id) ON DELETE SET NULL,
  variant_id        UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  product_title     TEXT,            -- snapshot, survives product deletion
  variant_label     TEXT,            -- snapshot of the variant display name
  -- warehouse_id: the location for 'edit'/'deletion'. from/to: the two sides of
  -- a 'transfer'. All SET NULL so the ledger survives a warehouse removal.
  warehouse_id      UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  from_warehouse_id UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  to_warehouse_id   UUID REFERENCES warehouses(id) ON DELETE SET NULL,
  quantity          INTEGER,         -- units moved (transfer) or last-known stock (deletion)
  old_value         INTEGER,         -- pre-edit count (edit)
  new_value         INTEGER,         -- post-edit count (edit)
  note              TEXT,
  created_by        UUID,
  created_by_email  TEXT,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- 2.x Product price changes (price history)
-- Append-only audit of changes to a product's selling price (`price`) or
-- purchase/cost price (`cost_price`), written automatically whenever either
-- field is edited. Lets the admin see how pricing moved over time.
CREATE TABLE product_price_changes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id       UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  field            TEXT NOT NULL CHECK (field IN ('price', 'cost_price')),
  old_value        NUMERIC(10,2),
  new_value        NUMERIC(10,2) NOT NULL,
  created_by       UUID,
  created_by_email TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 2.4 Orders (business-wide; gated by permissions in app code, not per-user)
CREATE TABLE orders (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number    BIGSERIAL UNIQUE,
  customer_name   TEXT NOT NULL,
  customer_phone  TEXT NOT NULL,
  customer_phone2 TEXT,
  customer_address TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','processing','shipped','delivered','cancelled')),
  source          TEXT NOT NULL DEFAULT 'admin' CHECK (source IN ('admin','storefront')),
  -- Warehouse this order draws stock from (reserve/commit/release all target it).
  -- Admin orders pick it; storefront orders use the default warehouse. RESTRICT so
  -- a warehouse referenced by order history cannot be hard-deleted.
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  -- Payment: 'cod' = pay on delivery (default), 'esewa' = prepaid online checkout.
  payment_method  TEXT NOT NULL DEFAULT 'cod' CHECK (payment_method IN ('cod','esewa')),
  payment_status  TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','paid','refunded')),
  -- eSewa transaction references (set when payment_method = 'esewa').
  esewa_transaction_code TEXT,   -- eSewa's reference code from the success response
  esewa_transaction_uuid TEXT,   -- our transaction_uuid sent to eSewa at initiation
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  cod_charge      NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  notes           TEXT,
  -- NCM courier shipment fields
  ncm_order_id     BIGINT UNIQUE,
  ncm_status       TEXT,
  ncm_from_branch  TEXT,
  ncm_to_branch    TEXT,
  ncm_delivery_type TEXT,
  ncm_synced_at    TIMESTAMPTZ,
  ncm_shipped_at   TIMESTAMPTZ,
  ncm_delivered_at TIMESTAMPTZ,
  -- Inventory guards (idempotent stock transitions)
  stock_committed BOOLEAN NOT NULL DEFAULT FALSE,
  stock_released  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- 2.5 Order line items (multi-product, optionally variant-specific)
CREATE TABLE order_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id         UUID REFERENCES products(id) ON DELETE SET NULL,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  -- Set when this line belongs to a combo. A "combo header" line carries the
  -- combo's title/price and has product_id = NULL (no stock); its component
  -- lines share this combo_id, have a real product_id, unit_price 0, and bear
  -- the stock. Display surfaces show the header and hide the component lines.
  combo_id           UUID REFERENCES products(id) ON DELETE SET NULL,
  product_title      TEXT NOT NULL,   -- snapshot, survives product deletion
  variant_label      TEXT,            -- snapshot of the variant display name
  sku                TEXT,            -- snapshot of the effective product/variant SKU at creation
  quantity           INTEGER NOT NULL CHECK (quantity > 0),
  unit_price         NUMERIC(10,2) NOT NULL,
  line_total         NUMERIC(10,2) NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- 2.5b Sales (point-of-sale records; business-wide, gated by permissions in
-- app code, not per-user). Unlike orders, a sale deducts stock immediately on
-- creation: there is no reserve/commit lifecycle and no courier.
CREATE TABLE sales (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_number     BIGSERIAL UNIQUE,
  customer_name   TEXT,
  customer_phone  TEXT,
  -- Optional link to the customer directory. Set automatically when the sale is
  -- recorded with a phone (find-or-create by phone). The free-text name/phone
  -- above are kept as snapshots. SET NULL so deleting a customer keeps the sale.
  customer_id     UUID REFERENCES customers(id) ON DELETE SET NULL,
  payment_method  TEXT NOT NULL DEFAULT 'cash'
                    CHECK (payment_method IN ('cash','esewa','khalti','ime_pay','bank','credit','fonepay')),
  -- Payment settlement state, derived from the sale_payments ledger whenever a
  -- payment is recorded or the total changes: 'pending' when nothing has been
  -- collected, 'partial' when some of the total is still due, 'paid' once the
  -- ledger covers the total. 'failed' is Fonepay-only, set when a QR is
  -- rejected or abandoned. Stored (not computed) so lists can filter on it.
  payment_status  TEXT NOT NULL DEFAULT 'paid'
                    CHECK (payment_status IN ('pending','partial','paid','failed')),
  -- Fonepay dynamic-QR references (set only when payment_method = 'fonepay').
  -- fonepay_prn is our unique payment reference number sent to Fonepay at QR
  -- generation and used to poll status; fonepay_trace_id is Fonepay's trace id,
  -- stored once the payment is confirmed successful.
  fonepay_prn      TEXT,
  fonepay_trace_id TEXT,
  -- Warehouse this sale deducted stock from. RESTRICT so a warehouse referenced
  -- by sale history cannot be hard-deleted.
  warehouse_id    UUID NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total           NUMERIC(10,2) NOT NULL DEFAULT 0,
  sale_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  -- When set, this sale was converted from the given order (revenue is
  -- recognized at fulfillment). UNIQUE so an order maps to at most one sale,
  -- which also makes conversion idempotent at the DB. ON DELETE SET NULL keeps
  -- the sale (a revenue record) even if the source order is later removed.
  order_id        UUID UNIQUE REFERENCES orders(id) ON DELETE SET NULL,
  -- Who recorded the sale (the creator; unchanged on edit). Denormalized email so
  -- attribution survives profile deletion; created_by has no FK for the same reason.
  created_by       UUID,
  created_by_email TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Sale line items (multi-product, optionally variant-specific). `cost_at_sale`
-- snapshots the product's cost_price at sale time so profit stays accurate even
-- if the cost changes later.
CREATE TABLE sale_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id            UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  product_id         UUID REFERENCES products(id) ON DELETE SET NULL,
  product_variant_id UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  product_title      TEXT NOT NULL,   -- snapshot, survives product deletion
  variant_label      TEXT,            -- snapshot of the variant display name
  sku                TEXT,            -- snapshot of the effective SKU at sale time
  quantity           INTEGER NOT NULL CHECK (quantity > 0),
  unit_price         NUMERIC(10,2) NOT NULL,
  cost_at_sale       NUMERIC(10,2) NOT NULL DEFAULT 0,  -- snapshot of product cost_price for profit
  line_total         NUMERIC(10,2) NOT NULL,
  created_at         TIMESTAMPTZ DEFAULT now()
);

-- 2.5a-ii Extra sale items ("extra sales")
-- One-off lines the cashier types at the counter for things that aren't in the
-- catalog: service charges, repair labour, delivery fees. They ride on the same
-- sale (one bill, one payment, one invoice) but live in their own table so they
-- can never reach product reporting: no product_id, no SKU, no cost snapshot,
-- and no stock movement. Product revenue, profit and Top Products are computed
-- from `sale_items` alone, and these are reported separately under
-- Point of Sale → Extra Sales.
--
-- IF NOT EXISTS so this single statement can also be run on a provisioned
-- database that can't be reset (see the backfill immediately below).
CREATE TABLE IF NOT EXISTS extra_sale_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id     UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,        -- what the cashier typed
  quantity    INTEGER NOT NULL CHECK (quantity > 0),
  unit_price  NUMERIC(10,2) NOT NULL,
  line_total  NUMERIC(10,2) NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- Backfill: custom lines recorded before this table existed sit in `sale_items`
-- with a NULL product_id. Move them across so historical product figures are
-- corrected too.
--
-- The NULL-product test alone is not enough: a sale converted from an order
-- stores a combo's priced header line the same way (product_id and
-- product_variant_id both NULL), and that one IS product revenue. Converted
-- sales are exactly those with a non-null `order_id`, and custom lines only
-- ever come from direct POS sales, so restricting to `order_id IS NULL` keeps
-- combo headers where they belong.
--
-- Re-runnable: after the first pass no matching sale_items rows remain, so a
-- second run moves nothing.
INSERT INTO extra_sale_items (sale_id, title, quantity, unit_price, line_total, created_at)
SELECT si.sale_id, si.product_title, si.quantity, si.unit_price, si.line_total, si.created_at
FROM sale_items si
JOIN sales s ON s.id = si.sale_id
WHERE si.product_id IS NULL
  AND si.product_variant_id IS NULL
  AND s.order_id IS NULL;

DELETE FROM sale_items si
USING sales s
WHERE s.id = si.sale_id
  AND si.product_id IS NULL
  AND si.product_variant_id IS NULL
  AND s.order_id IS NULL;

-- 2.5b Sale payments (collection ledger; amount paid derived, never stored)
-- One row per amount actually collected against a sale. A fully-paid sale has a
-- single row for its total; a partial sale has the amount taken at the counter
-- plus one row per later settlement of the outstanding due. The amount paid is
-- SUM(amount) and the due is sales.total - that sum, so the ledger stays the
-- single source of truth (mirrors the vendor and loyalty ledgers).
--
-- `received_by` records WHICH member took the money, denormalized to an email
-- so attribution survives profile deletion (no FK, same as sales.created_by).
CREATE TABLE sale_payments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id          UUID NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  -- Always positive: this ledger only records collections, never reversals.
  -- A wrongly-entered payment is deleted, not offset.
  amount           NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  -- When the money changed hands: the sale date for the counter payment, and
  -- the later settlement date for each subsequent collection.
  paid_on          DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method   TEXT NOT NULL DEFAULT 'cash'
                     CHECK (payment_method IN ('cash','esewa','khalti','ime_pay','bank','credit','fonepay')),
  note             TEXT,
  received_by       UUID,
  received_by_email TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- 2.5c Loyalty transactions (points ledger; balance derived, never stored)
-- One row per points movement for a customer. `points` is SIGNED: earn and
-- adjust-credit are positive, redeem and adjust-debit are negative, so the
-- balance is simply SUM(points) (mirrors the vendor_transactions model). Rows
-- with type 'earn' and a `sale_id` are auto-created by the POS when a sale is
-- recorded for a phone-identified customer; the rest are manual entries logged
-- from the customer's page. Defined after `sales` so its sale_id FK resolves.
CREATE TABLE loyalty_transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id    UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  type           TEXT NOT NULL DEFAULT 'earn'
                   CHECK (type IN ('earn','redeem','adjust')),
  points         INTEGER NOT NULL DEFAULT 0,
  txn_date       DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Set on auto-earned rows so the award is tied to (and reversible with) its
  -- sale. SET NULL so the ledger row survives if the sale is later removed.
  sale_id        UUID REFERENCES sales(id) ON DELETE SET NULL,
  note           TEXT,
  created_by       UUID,
  created_by_email TEXT,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- 2.6 NCM settings (single app-level row for the whole business)
CREATE TABLE ncm_settings (
  id                    BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  api_token             TEXT,
  environment           TEXT NOT NULL DEFAULT 'demo' CHECK (environment IN ('demo','production')),
  default_from_branch   TEXT,
  default_delivery_type TEXT NOT NULL DEFAULT 'Door2Door',
  default_cod_charge    NUMERIC(10,2) NOT NULL DEFAULT 0,
  webhook_secret        TEXT,
  updated_at            TIMESTAMPTZ DEFAULT now()
);

-- 2.7 NCM branches cache (refreshed from the NCM API on demand)
CREATE TABLE ncm_branches (
  name      TEXT PRIMARY KEY,
  district  TEXT,
  region    TEXT,
  phone     TEXT,
  raw       JSONB,
  cached_at TIMESTAMPTZ DEFAULT now()
);

-- 2.9 Business profile (single app-level row, like ncm_settings). Holds the
-- shop identity printed on invoices plus the running invoice counter.
CREATE TABLE business_profile (
  id                  BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  shop_name           TEXT,
  address             TEXT,
  phone               TEXT,
  email               TEXT,
  tax_id              TEXT,
  logo_url            TEXT,
  -- Currency code (e.g. NPR, USD) applied across the storefront and dashboard.
  currency            TEXT NOT NULL DEFAULT 'NPR',
  invoice_prefix      TEXT NOT NULL DEFAULT 'INV',
  invoice_footer      TEXT,
  next_invoice_number INTEGER NOT NULL DEFAULT 1 CHECK (next_invoice_number >= 1),
  -- Loyalty program config. When loyalty_enabled, each POS sale for a
  -- phone-identified customer auto-earns points: `percent` mode grants
  -- floor(total * rate / 100) points; `flat` mode grants `rate` points per sale.
  loyalty_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  loyalty_earn_mode   TEXT NOT NULL DEFAULT 'percent'
                        CHECK (loyalty_earn_mode IN ('percent','flat')),
  loyalty_earn_rate   NUMERIC(10,2) NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ DEFAULT now()
);

-- 2.10 Invoices: an immutable snapshot generated from a sale. One invoice per
-- sale (sale_id UNIQUE), which also enforces idempotent generation at the DB.
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id         UUID NOT NULL UNIQUE REFERENCES sales(id) ON DELETE CASCADE,
  invoice_number  TEXT NOT NULL UNIQUE,
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  status          TEXT NOT NULL DEFAULT 'issued'
                    CHECK (status IN ('issued','paid','cancelled')),
  subtotal        NUMERIC(10,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount    NUMERIC(10,2) NOT NULL DEFAULT 0,
  customer_name   TEXT,
  customer_phone  TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Invoice line items: a frozen copy of the sale's items at generation time.
CREATE TABLE invoice_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id    UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  product_title TEXT NOT NULL,   -- snapshot
  variant_label TEXT,            -- snapshot of the variant display name
  sku           TEXT,            -- frozen copy of the sale item's SKU
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  unit_price    NUMERIC(10,2) NOT NULL,
  line_total    NUMERIC(10,2) NOT NULL,
  sort_order    INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 2.11 Pending eSewa checkouts: a transient snapshot of the cart for an
-- in-flight eSewa payment, keyed by the transaction_uuid we send to eSewa.
-- Why this exists: eSewa caps the length of the success_url (~250 chars), so we
-- CANNOT round-trip the cart through the redirect URL. Instead we persist it
-- here and put only the transaction_uuid in success_url. On a verified success
-- callback we look the row up, place the order, and delete it. No stock is
-- reserved here, so abandoned payments just leave a short-lived row to be swept.
CREATE TABLE pending_esewa_checkouts (
  transaction_uuid TEXT PRIMARY KEY,        -- our transaction_uuid sent to eSewa
  payload          JSONB NOT NULL,          -- customer + line items to recreate the order
  total            NUMERIC(10,2) NOT NULL,  -- server-priced total presented at initiation
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2.12 App subscription (single app-level row, like ncm_settings). Controls
-- whether the whole admin dashboard is locked. Managed ONLY from the hidden,
-- PIN-gated /sm-control panel, never from the normal admin Settings UI. When
-- `disabled` is TRUE, or `expires_at` is in the past, the dashboard layout
-- replaces all content with a "subscription ended" lock screen.
CREATE TABLE app_subscription (
  id             BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  -- When the subscription ends. NULL = no expiry (active indefinitely).
  expires_at     TIMESTAMPTZ,
  -- Hard kill-switch: when TRUE the dashboard is locked regardless of date.
  disabled       BOOLEAN NOT NULL DEFAULT FALSE,
  -- Optional message shown on the lock screen (overrides the default copy).
  locked_message TEXT,
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 2.8 Stock RPCs (atomic, SECURITY DEFINER): WAREHOUSE-AWARE
-- ============================================================
-- warehouse_stock is the source of truth; the scalar stock_quantity/
-- reserved_quantity columns on products/product_variants are CACHED TOTALS
-- (sum across warehouses). Every function below mutates the warehouse_stock row
-- AND mirrors the exact same delta onto the product/variant total in the SAME
-- transaction. The total is moved by an incremental delta (a locked read-
-- modify-write on the product/variant row), NEVER by recomputing SUM(
-- warehouse_stock): a SUM recompute is not concurrency-safe across two
-- warehouses of the same product under READ COMMITTED (lost update -> drift).
--
-- reserve_*/deduct_* keep the single atomic conditional UPDATE on the
-- warehouse_stock row as the per-warehouse oversell guard (RETURN FALSE when the
-- row is missing or has insufficient available stock).
--
-- The old two-arg (non-warehouse) signatures are dropped first: Postgres keys
-- functions by argument types, so CREATE OR REPLACE with a new arg list would
-- create an overload rather than replace.

DROP FUNCTION IF EXISTS reserve_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS reserve_variant_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS release_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS release_variant_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS commit_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS commit_variant_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS deduct_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS deduct_variant_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS adjust_product_stock(UUID, INTEGER);
DROP FUNCTION IF EXISTS adjust_variant_stock(UUID, INTEGER);

-- ---- reserve (order placement) --------------------------------------------
CREATE OR REPLACE FUNCTION reserve_stock(p_warehouse_id UUID, p_product_id UUID, p_qty INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE warehouse_stock
     SET reserved_quantity = reserved_quantity + p_qty, updated_at = now()
   WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id AND variant_id IS NULL
     AND (stock_quantity - reserved_quantity) >= p_qty;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  UPDATE products SET reserved_quantity = reserved_quantity + p_qty WHERE id = p_product_id;
  RETURN TRUE;
END; $$;

CREATE OR REPLACE FUNCTION reserve_variant_stock(p_warehouse_id UUID, p_variant_id UUID, p_qty INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE warehouse_stock
     SET reserved_quantity = reserved_quantity + p_qty, updated_at = now()
   WHERE warehouse_id = p_warehouse_id AND variant_id = p_variant_id
     AND (stock_quantity - reserved_quantity) >= p_qty;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  UPDATE product_variants SET reserved_quantity = reserved_quantity + p_qty WHERE id = p_variant_id;
  RETURN TRUE;
END; $$;

-- ---- release (order cancellation before delivery) -------------------------
CREATE OR REPLACE FUNCTION release_stock(p_warehouse_id UUID, p_product_id UUID, p_qty INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old INTEGER; v_new INTEGER;
BEGIN
  SELECT reserved_quantity INTO v_old FROM warehouse_stock
   WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id AND variant_id IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  v_new := GREATEST(v_old - p_qty, 0);
  UPDATE warehouse_stock SET reserved_quantity = v_new, updated_at = now()
   WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id AND variant_id IS NULL;
  UPDATE products SET reserved_quantity = GREATEST(reserved_quantity - (v_old - v_new), 0) WHERE id = p_product_id;
END; $$;

CREATE OR REPLACE FUNCTION release_variant_stock(p_warehouse_id UUID, p_variant_id UUID, p_qty INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old INTEGER; v_new INTEGER;
BEGIN
  SELECT reserved_quantity INTO v_old FROM warehouse_stock
   WHERE warehouse_id = p_warehouse_id AND variant_id = p_variant_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  v_new := GREATEST(v_old - p_qty, 0);
  UPDATE warehouse_stock SET reserved_quantity = v_new, updated_at = now()
   WHERE warehouse_id = p_warehouse_id AND variant_id = p_variant_id;
  UPDATE product_variants SET reserved_quantity = GREATEST(reserved_quantity - (v_old - v_new), 0) WHERE id = p_variant_id;
END; $$;

-- ---- commit (order delivered: reserved -> shipped out) --------------------
CREATE OR REPLACE FUNCTION commit_stock(p_warehouse_id UUID, p_product_id UUID, p_qty INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_os INTEGER; v_or INTEGER; v_ns INTEGER; v_nr INTEGER;
BEGIN
  SELECT stock_quantity, reserved_quantity INTO v_os, v_or FROM warehouse_stock
   WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id AND variant_id IS NULL FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  v_ns := GREATEST(v_os - p_qty, 0);
  v_nr := GREATEST(v_or - p_qty, 0);
  UPDATE warehouse_stock SET stock_quantity = v_ns, reserved_quantity = v_nr, updated_at = now()
   WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id AND variant_id IS NULL;
  UPDATE products
     SET stock_quantity    = GREATEST(stock_quantity    - (v_os - v_ns), 0),
         reserved_quantity = GREATEST(reserved_quantity - (v_or - v_nr), 0)
   WHERE id = p_product_id;
END; $$;

CREATE OR REPLACE FUNCTION commit_variant_stock(p_warehouse_id UUID, p_variant_id UUID, p_qty INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_os INTEGER; v_or INTEGER; v_ns INTEGER; v_nr INTEGER;
BEGIN
  SELECT stock_quantity, reserved_quantity INTO v_os, v_or FROM warehouse_stock
   WHERE warehouse_id = p_warehouse_id AND variant_id = p_variant_id FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  v_ns := GREATEST(v_os - p_qty, 0);
  v_nr := GREATEST(v_or - p_qty, 0);
  UPDATE warehouse_stock SET stock_quantity = v_ns, reserved_quantity = v_nr, updated_at = now()
   WHERE warehouse_id = p_warehouse_id AND variant_id = p_variant_id;
  UPDATE product_variants
     SET stock_quantity    = GREATEST(stock_quantity    - (v_os - v_ns), 0),
         reserved_quantity = GREATEST(reserved_quantity - (v_or - v_nr), 0)
   WHERE id = p_variant_id;
END; $$;

-- ---- deduct (immediate POS sale) ------------------------------------------
-- Atomic check-and-decrement, respecting reserved so a walk-in sale can't
-- consume units held for a pending order. FALSE when the warehouse lacks stock.
CREATE OR REPLACE FUNCTION deduct_stock(p_warehouse_id UUID, p_product_id UUID, p_qty INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE warehouse_stock
     SET stock_quantity = stock_quantity - p_qty, updated_at = now()
   WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id AND variant_id IS NULL
     AND (stock_quantity - reserved_quantity) >= p_qty;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  UPDATE products SET stock_quantity = stock_quantity - p_qty WHERE id = p_product_id;
  RETURN TRUE;
END; $$;

CREATE OR REPLACE FUNCTION deduct_variant_stock(p_warehouse_id UUID, p_variant_id UUID, p_qty INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE warehouse_stock
     SET stock_quantity = stock_quantity - p_qty, updated_at = now()
   WHERE warehouse_id = p_warehouse_id AND variant_id = p_variant_id
     AND (stock_quantity - reserved_quantity) >= p_qty;
  IF NOT FOUND THEN RETURN FALSE; END IF;
  UPDATE product_variants SET stock_quantity = stock_quantity - p_qty WHERE id = p_variant_id;
  RETURN TRUE;
END; $$;

-- ---- adjust (signed delta upsert; restock / sale restore) -----------------
-- Serves both product and variant (variant_id nullable). Upserts the warehouse
-- row when it doesn't exist yet, then mirrors the clamped delta onto the total.
CREATE OR REPLACE FUNCTION adjust_warehouse_stock(
  p_warehouse_id UUID, p_product_id UUID, p_variant_id UUID, p_delta INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old INTEGER; v_new INTEGER;
BEGIN
  IF p_variant_id IS NULL THEN
    SELECT stock_quantity INTO v_old FROM warehouse_stock
     WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id AND variant_id IS NULL FOR UPDATE;
    IF NOT FOUND THEN
      v_old := 0; v_new := GREATEST(p_delta, 0);
      INSERT INTO warehouse_stock (warehouse_id, product_id, variant_id, stock_quantity)
      VALUES (p_warehouse_id, p_product_id, NULL, v_new);
    ELSE
      v_new := GREATEST(v_old + p_delta, 0);
      UPDATE warehouse_stock SET stock_quantity = v_new, updated_at = now()
       WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id AND variant_id IS NULL;
    END IF;
    UPDATE products SET stock_quantity = GREATEST(stock_quantity + (v_new - v_old), 0) WHERE id = p_product_id;
  ELSE
    SELECT stock_quantity INTO v_old FROM warehouse_stock
     WHERE warehouse_id = p_warehouse_id AND variant_id = p_variant_id FOR UPDATE;
    IF NOT FOUND THEN
      v_old := 0; v_new := GREATEST(p_delta, 0);
      INSERT INTO warehouse_stock (warehouse_id, product_id, variant_id, stock_quantity)
      VALUES (p_warehouse_id, p_product_id, p_variant_id, v_new);
    ELSE
      v_new := GREATEST(v_old + p_delta, 0);
      UPDATE warehouse_stock SET stock_quantity = v_new, updated_at = now()
       WHERE warehouse_id = p_warehouse_id AND variant_id = p_variant_id;
    END IF;
    UPDATE product_variants SET stock_quantity = GREATEST(stock_quantity + (v_new - v_old), 0) WHERE id = p_variant_id;
  END IF;
END; $$;

-- ---- set (absolute admin override from the product form) ------------------
-- Sets the warehouse row's on-hand to p_new_qty and moves the cached total by
-- exactly (new - old), so SUM(warehouse_stock) == the total stays invariant even
-- when the same product is stocked in other warehouses.
CREATE OR REPLACE FUNCTION set_warehouse_stock(
  p_warehouse_id UUID, p_product_id UUID, p_variant_id UUID, p_new_qty INTEGER)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_old INTEGER; v_new INTEGER := GREATEST(p_new_qty, 0);
BEGIN
  IF p_variant_id IS NULL THEN
    SELECT stock_quantity INTO v_old FROM warehouse_stock
     WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id AND variant_id IS NULL FOR UPDATE;
    IF NOT FOUND THEN
      v_old := 0;
      INSERT INTO warehouse_stock (warehouse_id, product_id, variant_id, stock_quantity)
      VALUES (p_warehouse_id, p_product_id, NULL, v_new);
    ELSE
      UPDATE warehouse_stock SET stock_quantity = v_new, updated_at = now()
       WHERE warehouse_id = p_warehouse_id AND product_id = p_product_id AND variant_id IS NULL;
    END IF;
    UPDATE products SET stock_quantity = GREATEST(stock_quantity + (v_new - v_old), 0) WHERE id = p_product_id;
  ELSE
    SELECT stock_quantity INTO v_old FROM warehouse_stock
     WHERE warehouse_id = p_warehouse_id AND variant_id = p_variant_id FOR UPDATE;
    IF NOT FOUND THEN
      v_old := 0;
      INSERT INTO warehouse_stock (warehouse_id, product_id, variant_id, stock_quantity)
      VALUES (p_warehouse_id, p_product_id, p_variant_id, v_new);
    ELSE
      UPDATE warehouse_stock SET stock_quantity = v_new, updated_at = now()
       WHERE warehouse_id = p_warehouse_id AND variant_id = p_variant_id;
    END IF;
    UPDATE product_variants SET stock_quantity = GREATEST(stock_quantity + (v_new - v_old), 0) WHERE id = p_variant_id;
  END IF;
END; $$;

-- ---- transfer (move free stock between warehouses) ------------------------
-- Guarded atomic move: deduct the source only if it has enough FREE (non-
-- reserved) stock, then upsert the destination. Net-zero on the product/variant
-- cached total, so it touches only warehouse_stock. FALSE on same-warehouse,
-- non-positive qty, or insufficient source stock.
CREATE OR REPLACE FUNCTION transfer_stock(
  p_from UUID, p_to UUID, p_product_id UUID, p_variant_id UUID, p_qty INTEGER)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_from = p_to OR p_qty <= 0 THEN RETURN FALSE; END IF;

  UPDATE warehouse_stock
     SET stock_quantity = stock_quantity - p_qty, updated_at = now()
   WHERE warehouse_id = p_from AND product_id = p_product_id
     AND variant_id IS NOT DISTINCT FROM p_variant_id
     AND (stock_quantity - reserved_quantity) >= p_qty;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF p_variant_id IS NULL THEN
    INSERT INTO warehouse_stock (warehouse_id, product_id, variant_id, stock_quantity)
    VALUES (p_to, p_product_id, NULL, p_qty)
    ON CONFLICT (warehouse_id, product_id) WHERE variant_id IS NULL
    DO UPDATE SET stock_quantity = warehouse_stock.stock_quantity + p_qty, updated_at = now();
  ELSE
    INSERT INTO warehouse_stock (warehouse_id, product_id, variant_id, stock_quantity)
    VALUES (p_to, p_product_id, p_variant_id, p_qty)
    ON CONFLICT (warehouse_id, variant_id) WHERE variant_id IS NOT NULL
    DO UPDATE SET stock_quantity = warehouse_stock.stock_quantity + p_qty, updated_at = now();
  END IF;
  RETURN TRUE;
END; $$;

-- ---- set default warehouse (exactly one is_default = TRUE) -----------------
-- Clears the old default then sets the new one in a single transaction, so the
-- partial unique index idx_warehouses_one_default is never momentarily violated.
CREATE OR REPLACE FUNCTION set_default_warehouse(p_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE warehouses SET is_default = FALSE, updated_at = now() WHERE is_default AND id <> p_id;
  UPDATE warehouses SET is_default = TRUE,  updated_at = now() WHERE id = p_id;
END; $$;

-- Atomically claim the current invoice number and advance the counter, so two
-- concurrent generations can never collide on the same number.
CREATE OR REPLACE FUNCTION claim_invoice_number()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE claimed INTEGER;
BEGIN
  UPDATE business_profile
     SET next_invoice_number = next_invoice_number + 1,
         updated_at = now()
   WHERE id = TRUE
  RETURNING next_invoice_number - 1 INTO claimed;
  RETURN claimed;
END; $$;

-- 2.2 Profiles (role-based access control)
-- One row per Supabase Auth user. `role` is the coarse tier; `permissions`
-- is the granular grant list for members. Admins implicitly have every
-- permission (enforced in app code), so their `permissions` array is ignored.
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  permissions JSONB NOT NULL DEFAULT '[]'::JSONB,
  -- Per-user default warehouse, prefilled on the POS sale form. Deliberately has
  -- NO foreign key: `profiles` is preserved across resets while `warehouses` is
  -- dropped/recreated, so an FK would dangle. App code resolves it defensively
  -- (falls back to the global default when the id is missing/stale).
  default_warehouse_id UUID,
  -- Account on/off switch. When FALSE the user cannot sign in and every server
  -- action is denied (enforced in app code: signIn, requireAuth, and the admin
  -- layout). Reversible; distinct from a hard delete. Super admins are always
  -- treated as active regardless of this flag.
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- `profiles` is created with IF NOT EXISTS and never dropped on reset, so new
-- columns must also be added via an idempotent ALTER for already-provisioned DBs.
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS default_warehouse_id UUID;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2.3 User HR records (admin-only personnel file)
-- Per-user documents, salary history, and dated notes shown on the user detail
-- page. All reference auth.users (which every account has, unlike `profiles`
-- which a super admin can lack) and CASCADE when the account is deleted.
-- Business-private: service-role only (no RLS policies), gated by `admin` in
-- app code, the same tier that guards the whole Users page.

-- Uploaded documents (ID cards, contracts, salary slips). Files live in the
-- public `user-documents` bucket; this row keeps the metadata + link.
CREATE TABLE user_documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title            TEXT NOT NULL,
  -- Coarse bucket for filtering/grouping in the UI.
  category         TEXT NOT NULL DEFAULT 'other'
                     CHECK (category IN ('id','contract','certificate','payslip','other')),
  file_url         TEXT NOT NULL,
  file_name        TEXT NOT NULL,
  file_type        TEXT NOT NULL,
  notes            TEXT,
  created_by       UUID,
  created_by_email TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Salary history: one row per pay change or one-off payment.
CREATE TABLE user_salary_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  effective_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  amount           NUMERIC(12,2) NOT NULL DEFAULT 0,
  type             TEXT NOT NULL DEFAULT 'salary'
                     CHECK (type IN ('salary','raise','bonus','advance','deduction')),
  note             TEXT,
  created_by       UUID,
  created_by_email TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Free-text notes timeline (who wrote what, when).
CREATE TABLE user_notes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body             TEXT NOT NULL,
  created_by       UUID,
  created_by_email TEXT,
  created_at       TIMESTAMPTZ DEFAULT now()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================

CREATE INDEX idx_products_featured ON products(is_featured);
CREATE INDEX idx_products_order ON products(sort_order);
CREATE INDEX idx_products_category ON products(category_id);
CREATE INDEX idx_categories_order ON categories(sort_order);
-- Barcode lookups for point-of-sale scanning; unique so a code maps to one item.
CREATE UNIQUE INDEX idx_products_barcode ON products(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);

-- User HR records: fetched per user, newest first.
CREATE INDEX idx_user_documents_user ON user_documents(user_id, created_at DESC);
CREATE INDEX idx_user_salary_records_user ON user_salary_records(user_id, effective_date DESC);
CREATE INDEX idx_user_notes_user ON user_notes(user_id, created_at DESC);

-- Variants, orders & line items
CREATE INDEX idx_variants_product ON product_variants(product_id);
CREATE UNIQUE INDEX idx_variants_sku ON product_variants(sku) WHERE sku IS NOT NULL;
CREATE UNIQUE INDEX idx_variants_barcode ON product_variants(barcode) WHERE barcode IS NOT NULL;
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
CREATE INDEX idx_orders_ncm ON orders(ncm_order_id);
CREATE INDEX idx_orders_esewa_uuid ON orders(esewa_transaction_uuid) WHERE esewa_transaction_uuid IS NOT NULL;
CREATE INDEX idx_order_items_order ON order_items(order_id);

-- Combo items
CREATE INDEX idx_combo_items_combo ON combo_items(combo_id);
CREATE INDEX idx_combo_items_component ON combo_items(component_id);

-- Stock & price history (newest-first reads per product)
CREATE INDEX idx_stock_entries_product ON product_stock_entries(product_id, created_at DESC);
CREATE INDEX idx_stock_entries_warehouse ON product_stock_entries(warehouse_id);
CREATE INDEX idx_price_changes_product ON product_price_changes(product_id, created_at DESC);

-- Warehouses & per-location stock
-- Exactly one default warehouse (partial unique on the TRUE rows only).
CREATE UNIQUE INDEX idx_warehouses_one_default ON warehouses(is_default) WHERE is_default;
CREATE INDEX idx_warehouses_sort ON warehouses(sort_order);
-- NULL variant_id needs two partial unique indexes (a plain composite UNIQUE
-- treats NULLs as distinct); these are also the ON CONFLICT inference targets.
CREATE UNIQUE INDEX idx_wh_stock_product ON warehouse_stock(warehouse_id, product_id) WHERE variant_id IS NULL;
CREATE UNIQUE INDEX idx_wh_stock_variant ON warehouse_stock(warehouse_id, variant_id) WHERE variant_id IS NOT NULL;
CREATE INDEX idx_wh_stock_lookup ON warehouse_stock(product_id, variant_id);
CREATE INDEX idx_orders_warehouse ON orders(warehouse_id);
CREATE INDEX idx_sales_warehouse ON sales(warehouse_id);

-- Vendors & their payable ledger
CREATE INDEX idx_vendors_sort ON vendors(sort_order);
CREATE INDEX idx_vendor_transactions_vendor ON vendor_transactions(vendor_id, txn_date DESC);
CREATE INDEX idx_vendor_transactions_created ON vendor_transactions(created_at DESC);

-- Business expenses: always read newest-first, and filtered by date range.
CREATE INDEX idx_business_expenses_date ON business_expenses(expense_date DESC);
CREATE INDEX idx_business_expenses_category ON business_expenses(category);

-- Customers & their loyalty-points ledger
CREATE INDEX idx_customers_sort ON customers(sort_order);
-- Phone is the identity key; unique when set (matches customers_phone_unique but
-- also the find-or-create lookup path). Partial so many null-phone rows are allowed.
CREATE UNIQUE INDEX idx_customers_phone ON customers(phone) WHERE phone IS NOT NULL;
CREATE INDEX idx_loyalty_txns_customer ON loyalty_transactions(customer_id, txn_date DESC);
CREATE INDEX idx_loyalty_txns_created ON loyalty_transactions(created_at DESC);
-- Idempotent auto-earn: at most one 'earn' row per sale (ON CONFLICT target).
CREATE UNIQUE INDEX idx_loyalty_earn_per_sale ON loyalty_transactions(sale_id)
  WHERE type = 'earn' AND sale_id IS NOT NULL;
CREATE INDEX idx_sales_customer ON sales(customer_id);

-- Stock movements audit (newest-first, per product + global)
CREATE INDEX idx_stock_movements_product ON stock_movements(product_id, created_at DESC);
CREATE INDEX idx_stock_movements_created ON stock_movements(created_at DESC);

-- Sales & line items
CREATE INDEX idx_sales_date ON sales(sale_date DESC);
CREATE INDEX idx_sales_created ON sales(created_at DESC);
CREATE INDEX idx_sales_created_by ON sales(created_by);
-- Fonepay status polling looks the sale up by its payment reference number.
CREATE INDEX idx_sales_fonepay_prn ON sales(fonepay_prn) WHERE fonepay_prn IS NOT NULL;
CREATE INDEX idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_extra_sale_items_sale ON extra_sale_items(sale_id);

-- Sale payments: always read per sale, newest collection first.
CREATE INDEX idx_sale_payments_sale ON sale_payments(sale_id, paid_on DESC);

-- Invoices & line items
CREATE INDEX idx_invoices_sale ON invoices(sale_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_invoices_created ON invoices(created_at DESC);
CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);

-- Sweep abandoned pending checkouts by age.
CREATE INDEX idx_pending_esewa_created ON pending_esewa_checkouts(created_at);

-- ============================================================
-- 4. ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- products: public read, authenticated write
CREATE POLICY "products_public_read" ON products FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "products_auth_insert" ON products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "products_auth_update" ON products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "products_auth_delete" ON products FOR DELETE TO authenticated USING (true);

-- categories: public read (storefront groups/filters by category), authenticated
-- write. Mirrors the products model.
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "categories_public_read" ON categories FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "categories_auth_insert" ON categories FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "categories_auth_update" ON categories FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "categories_auth_delete" ON categories FOR DELETE TO authenticated USING (true);

-- profiles: a user may read their own profile. All writes and admin-wide
-- reads happen through the service-role client (which bypasses RLS) and are
-- gated in application code, so no broad write policies are granted here.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_self_read" ON profiles;
CREATE POLICY "profiles_self_read" ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);

-- user_documents / user_salary_records / user_notes: admin-only personnel file.
-- NEVER client-readable: all reads and writes go through the service-role
-- client inside server actions, gated by `admin` in app code. No policies granted.
ALTER TABLE user_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_salary_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;

-- product_variants: public read (storefront needs them), writes via service role.
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "variants_public_read" ON product_variants FOR SELECT TO anon, authenticated USING (true);

-- combo_items: public read (storefront combo detail needs them), writes via
-- service role inside server actions.
ALTER TABLE combo_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "combo_items_public_read" ON combo_items FOR SELECT TO anon, authenticated USING (true);

-- orders / order_items: NEVER client-readable. All reads use the authenticated
-- SSR client gated in app code; all writes (including public checkout) go
-- through the service-role client inside server actions, which bypasses RLS.
-- No anon/authenticated policies are granted, so direct client access is denied.
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- product_stock_entries / product_price_changes: service-role only (no policies
-- granted). Written and read solely through server actions, gated by
-- products.edit / products.view in app code; cost data is further redacted for
-- callers without finances.view.
ALTER TABLE product_stock_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_price_changes ENABLE ROW LEVEL SECURITY;

-- warehouses / warehouse_stock: public read (storefront can compute per-warehouse
-- availability; admin lists read them too), writes via service role inside gated
-- server actions. Mirrors the products/product_variants model.
ALTER TABLE warehouses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warehouses_public_read" ON warehouses FOR SELECT TO anon, authenticated USING (true);
ALTER TABLE warehouse_stock ENABLE ROW LEVEL SECURITY;
CREATE POLICY "warehouse_stock_public_read" ON warehouse_stock FOR SELECT TO anon, authenticated USING (true);

-- stock_movements: service-role only (no policies granted), like the other audit
-- ledgers. Read/written through server actions gated by products.view/edit and
-- warehouses.edit; cost is never stored here.
ALTER TABLE stock_movements ENABLE ROW LEVEL SECURITY;

-- sales / sale_items: same model as orders: never client-readable. All reads
-- and writes go through the service-role client inside server actions, gated by
-- permissions in app code. No anon/authenticated policies are granted.
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE extra_sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_payments ENABLE ROW LEVEL SECURITY;

-- vendors / vendor_transactions: business-private, service-role only (no
-- policies granted), like sales. All reads and writes go through the
-- service-role client inside server actions, gated by vendors.* in app code.
ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_transactions ENABLE ROW LEVEL SECURITY;

-- business_expenses: same model. Service-role only (no policies granted), gated
-- by expenses.* in app code.
ALTER TABLE business_expenses ENABLE ROW LEVEL SECURITY;

-- customers / loyalty_transactions: business-private, service-role only (no
-- policies granted), like vendors. All reads and writes go through the
-- service-role client inside server actions, gated by customers.* in app code.
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;

-- business_profile / invoices / invoice_items: service-role only (no policies),
-- gated by permissions in app code, exactly like sales and ncm_settings.
ALTER TABLE business_profile ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

-- ncm_settings / ncm_branches: service-role only (no policies granted).
ALTER TABLE ncm_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE ncm_branches ENABLE ROW LEVEL SECURITY;

-- pending_esewa_checkouts: service-role only (no policies granted). Written and
-- read solely by the eSewa server actions via the service-role client.
ALTER TABLE pending_esewa_checkouts ENABLE ROW LEVEL SECURITY;

-- app_subscription: service-role only (no policies granted). Read by the
-- dashboard layout and written only by the PIN-gated /sm-control panel, both
-- via the service-role client.
ALTER TABLE app_subscription ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. SEED DATA
-- ============================================================

-- Starter parent categories so the feature is visible on a fresh database.
INSERT INTO categories (name, sort_order) VALUES
  ('Pants', 0),
  ('Shirts', 1),
  ('Shoes', 2);

INSERT INTO products (title, description, price, cost_price, is_featured, sort_order, stock_quantity, image_url) VALUES
  ('Artisan Headphones', 'Hand-tuned wireless headphones with premium materials', 299.00, 180.00, true, 0, 50, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=1200&q=80&auto=format&fit=crop'),
  ('Heritage Watch', 'Precision-crafted smartwatch with sapphire display', 549.00, 340.00, true, 1, 50, 'https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=1200&q=80&auto=format&fit=crop'),
  ('Studio Speaker', 'Room-filling sound in a sculpted aluminum enclosure', 199.00, 120.00, true, 2, 50, 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=1200&q=80&auto=format&fit=crop'),
  ('Connectivity Hub', 'Machined aluminum USB-C hub with integrated cable', 129.00, 70.00, false, 3, 50, 'https://images.unsplash.com/photo-1616578273461-3a99ce422de6?w=1200&q=80&auto=format&fit=crop'),
  ('Leather Folio', 'Full-grain leather document holder with magnetic closure', 89.00, 45.00, false, 4, 50, 'https://images.unsplash.com/photo-1688296526738-0b264f73592d?w=1200&q=80&auto=format&fit=crop'),
  ('Desk Lamp', 'Adjustable LED desk lamp with wireless charging base', 159.00, 95.00, true, 5, 50, 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=1200&q=80&auto=format&fit=crop');

-- A product WITH variants (stock lives on the variant rows below).
INSERT INTO products (title, description, price, cost_price, is_featured, sort_order, has_variants, image_url)
VALUES ('Classic Tee', 'Soft cotton t-shirt available in multiple colors and sizes', 39.00, 16.00, false, 6, true, 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&q=80&auto=format&fit=crop');

-- Assign the tee to the Shirts category so category filtering has visible data.
UPDATE products SET category_id = (SELECT id FROM categories WHERE name = 'Shirts')
WHERE title = 'Classic Tee';

-- Demo barcodes for simple products so point-of-sale scanning works on a fresh DB.
UPDATE products SET barcode = '8901000000017' WHERE title = 'Artisan Headphones';
UPDATE products SET barcode = '8901000000024' WHERE title = 'Heritage Watch';
UPDATE products SET barcode = '8901000000031' WHERE title = 'Studio Speaker';
UPDATE products SET barcode = '8901000000048' WHERE title = 'Connectivity Hub';
UPDATE products SET barcode = '8901000000055' WHERE title = 'Leather Folio';
UPDATE products SET barcode = '8901000000062' WHERE title = 'Desk Lamp';

INSERT INTO product_variants (product_id, attributes, display_name, sku, barcode, price_override, stock_quantity)
SELECT p.id, v.attributes, v.display_name, v.sku, v.barcode, v.price_override, v.stock_quantity
FROM products p
CROSS JOIN (VALUES
  ('{"Color":"Black","Size":"M"}'::JSONB, 'Black / M', 'TEE-BLK-M', '8902000000015', NULL::NUMERIC(10,2), 30),
  ('{"Color":"Black","Size":"L"}'::JSONB, 'Black / L', 'TEE-BLK-L', '8902000000022', NULL::NUMERIC(10,2), 20),
  ('{"Color":"White","Size":"M"}'::JSONB, 'White / M', 'TEE-WHT-M', '8902000000039', NULL::NUMERIC(10,2), 25),
  ('{"Color":"White","Size":"L"}'::JSONB, 'White / L', 'TEE-WHT-L', '8902000000046', NULL::NUMERIC(10,2), 15)
) AS v(attributes, display_name, sku, barcode, price_override, stock_quantity)
WHERE p.title = 'Classic Tee';

-- A combo bundling two simple products at a discounted price. Stock is derived
-- from its components, so it has no stock of its own.
INSERT INTO products (title, description, price, cost_price, is_featured, is_visible, is_combo, sort_order, image_url)
VALUES ('Desk Essentials Combo', 'Connectivity Hub + Leather Folio, bundled and discounted', 189.00, 115.00, true, true, true, 7, 'https://images.unsplash.com/photo-1617395440873-63f6e7f25139?w=1200&q=80&auto=format&fit=crop');

INSERT INTO combo_items (combo_id, component_id, quantity)
SELECT c.id, p.id, 1
FROM products c
JOIN products p ON p.title IN ('Connectivity Hub', 'Leather Folio')
WHERE c.title = 'Desk Essentials Combo';

-- Default "Main Warehouse", then migrate all existing product/variant stock into
-- it so the storefront keeps working day one. Because Main is the only warehouse
-- post-migration, SUM(warehouse_stock) == products/product_variants.stock_quantity
-- automatically, so the cached-total columns need no rewrite.
INSERT INTO warehouses (name, code, is_default, is_active, sort_order)
VALUES ('Main Warehouse', 'MAIN', TRUE, TRUE, 0)
ON CONFLICT (code) DO NOTHING;

-- Back-fill: one row per simple (non-variant, non-combo) product...
INSERT INTO warehouse_stock (warehouse_id, product_id, variant_id, stock_quantity, reserved_quantity)
SELECT w.id, p.id, NULL, p.stock_quantity, p.reserved_quantity
FROM products p CROSS JOIN warehouses w
WHERE w.is_default AND p.has_variants = FALSE AND p.is_combo = FALSE
ON CONFLICT (warehouse_id, product_id) WHERE variant_id IS NULL DO NOTHING;

-- ...and one row per variant.
INSERT INTO warehouse_stock (warehouse_id, product_id, variant_id, stock_quantity, reserved_quantity)
SELECT w.id, v.product_id, v.id, v.stock_quantity, v.reserved_quantity
FROM product_variants v CROSS JOIN warehouses w
WHERE w.is_default
ON CONFLICT (warehouse_id, variant_id) WHERE variant_id IS NOT NULL DO NOTHING;

-- NCM settings: a single row to be configured via the admin Settings page.
INSERT INTO ncm_settings (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

-- Business profile: a single row, configured via the Business settings page
-- before invoices can be generated.
INSERT INTO business_profile (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

-- App subscription: a single row, active with no expiry until configured from
-- the hidden /sm-control panel.
INSERT INTO app_subscription (id) VALUES (TRUE) ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 6. STORAGE BUCKETS
-- ============================================================
-- Product images live in the public `products` bucket. The app reads them via
-- getPublicUrl(), so the bucket MUST be public. Uploads/deletes go through the
-- service-role client (bypasses RLS), so no storage.objects policies are needed.
-- File size / MIME limits mirror the validation in src/services/upload.service.ts.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'products',
  'products',
  true,
  5242880, -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Branding assets (business logo, favicon, testimonial/team avatars) live in the
-- public `branding` bucket. Logos & favicons allow SVG and ICO in addition to the
-- raster formats; limits mirror uploadBrandingImage() in src/services/upload.service.ts.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'branding',
  'branding',
  true,
  5242880, -- 5 MB
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/webp',
    'image/svg+xml',
    'image/x-icon',
    'image/vnd.microsoft.icon'
  ]
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Vendor bill attachments (scanned bills / invoices) live in the public
-- `vendor-bills` bucket. Unlike the image-only buckets, this one also accepts
-- PDFs so multi-page bills can be uploaded. Read via getPublicUrl(); uploads
-- and deletes go through the service-role client, so no storage.objects
-- policies are needed. Limits mirror uploadVendorBill() in
-- src/services/upload.service.ts.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-bills',
  'vendor-bills',
  true,
  10485760, -- 10 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Expense receipts (bills, slips) live in the public `expense-receipts` bucket.
-- Same shape and limits as vendor bills: images plus PDFs, read via
-- getPublicUrl(), written through the service-role client, so no
-- storage.objects policies are needed. Limits mirror uploadExpenseReceipt() in
-- src/services/upload.service.ts.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'expense-receipts',
  'expense-receipts',
  true,
  10485760, -- 10 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Customer citizenship photos live in the `customer-documents` bucket, the ONE
-- bucket that is deliberately PRIVATE (public = false): these are government ID
-- documents uploaded by members themselves through the public /membership form,
-- and a public bucket would make every one of them readable by URL alone. The
-- dashboard never links the object directly; it mints a short-lived signed URL
-- through a customers.view-gated server action. Uploads go through the
-- service-role client, so no storage.objects policies are needed. Limits mirror
-- validateCitizenshipPhoto() in src/services/membership-engine.ts.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'customer-documents',
  'customer-documents',
  false,
  5242880, -- 5 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- User documents (ID cards, contracts, payslips) live in the public
-- `user-documents` bucket. Accepts images and PDFs like vendor bills. Read via
-- getPublicUrl(); uploads/deletes go through the service-role client (admin
-- gated in app code), so no storage.objects policies are needed. Limits mirror
-- uploadUserDocument() in src/services/upload.service.ts.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'user-documents',
  'user-documents',
  true,
  10485760, -- 10 MB
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
  SET public = EXCLUDED.public,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ============================================================
-- 7. MIGRATION RULES (for AI agents)
-- ============================================================
-- When adding new features that require schema changes:
-- 1. Add new CREATE TABLE statements in Section 2
-- 2. Add indexes in Section 3
-- 3. Add RLS policies in Section 4
-- 4. Add seed data in Section 5
-- 5. Add storage buckets in Section 6 (idempotent via ON CONFLICT)
-- 6. Add DROP TABLE IF EXISTS in Section 1
-- 7. NEVER create separate migration files
-- 8. This file must always be runnable on a fresh database
-- 9. This file must always be re-runnable (idempotent via DROP / ON CONFLICT)
-- ============================================================
