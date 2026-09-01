# Multi-Tenant Migration Plan

> **Status: PROPOSED — not started.** This document is a feasibility assessment and implementation plan. No code, schema, or configuration has been changed. Nothing in this document is in effect yet; in particular, the rules in [`RULES.md`](RULES.md) and §7 of [`supabase-schema.sql`](supabase-schema.sql) still apply as written until the work in Phase 0 is actually done.
>
> Last updated: 2026-08-08 · Supersedes the tenancy sections of [`BUSINESS-PLAN.md`](BUSINESS-PLAN.md) once approved.

---

## Contents

- [Context](#context) · [Verdict](#verdict-feasible-4368-engineer-days)
- [What breaks the moment tenant #2 exists](#what-breaks-the-moment-tenant-2-exists) — the breakage register
- [The core mechanism](#the-core-mechanism) — the two decisions that carry the migration
- [Phases](#phases) · [Effort summary](#effort-summary) · [Risk register](#risk-register)
- [Verification](#verification)

---

## Context

EG Stores is a Next.js 16 / Supabase POS + inventory + storefront system, currently **single-tenant to the bone**: one installation serves exactly one business. The goal is to convert it into a self-serve SaaS — a visitor signs up, a workspace is created, they become its admin, and they manage their own members, customers, products, warehouses, POS, invoices and reports in isolation from every other business.

[`BUSINESS-PLAN.md`](BUSINESS-PLAN.md) previously evaluated this and chose the opposite direction (one self-hosted Supabase stack per client, *"revisit pooled multi-tenancy at 50+ clients"*). **That decision is reversed by this plan** — self-serve signup is the requirement, and instance-per-tenant cannot provide it: provisioning a stack is a 60–180 s stateful operation with a dozen partial-failure modes, and `DEPLOYMENT.md:228` documents `DISABLE_SIGNUP=true` as a deliberate pre-launch requirement. `BUSINESS-PLAN.md` Part 1 and its rollout phases must be rewritten as part of this work, or they will keep contradicting the code.

### Decisions taken

| Question | Decision |
|---|---|
| Tenancy model | **Shared database + `tenant_id`**, one deploy, self-serve signup |
| Payment credentials | **Per-tenant, in scope** — each shop transacts on its own eSewa/Fonepay merchant account |
| Membership | **One user = one tenant** — `tenant_id` column on `profiles`, no many-to-many |
| Storefront routing | **Subdomain** (`<slug>.example.com`), with path-based as a dev fallback — see Phase 5 |

### Alternatives considered and rejected

| Option | Verdict |
|---|---|
| **Instance-per-tenant** (one Supabase stack + deploy per customer) | Near-zero app code change (~9–15 d of ops tooling), strongest isolation, and per-tenant payment/courier credentials come free as env vars. But **no self-serve signup**, and a hard ceiling around 10–15 customers before schema rollout across N databases becomes the bottleneck. Rejected because self-serve signup is the requirement. |
| **Schema-per-tenant** (`search_path` switching in one Postgres) | Strictly dominated. PostgREST exposes schemas via one global config and caches every table/column/relationship in memory — 29 tables × 200 schemas = 5,800 tables, degrading gradually and failing late. All 13 RPCs are hard-pinned to `SET search_path = public` and would need duplicating or rewriting to dynamic SQL. And GoTrue still gives one `auth.users`, so you gain no auth isolation anyway. **Do not spend a day evaluating this further.** |

---

## Verdict: feasible, 43–68 engineer-days

No architectural dead-ends. Two properties of the current codebase make this far more tractable than the raw line count suggests:

- **Database access is already funnelled.** Every query lives in `src/queries/*.query.ts` or `src/services/*.service.ts`, and every client comes from two factory functions in [`src/lib/supabase/server.ts`](src/lib/supabase/server.ts). That is a real chokepoint to install tenancy at — 209 `.from()` call sites, but only **2 places where a client is constructed**.
- **No realtime, no browser-side Supabase, no ORM.** The browser client at [`src/lib/supabase/client.ts`](src/lib/supabase/client.ts) is dead code (zero importers). All data access is server-side, so there is no client-side surface to re-secure.

The hard parts are not the tenant column. They are:

1. **110 service-role call sites across 35 files** ([`server.ts:37-48`](src/lib/supabase/server.ts#L37-L48)) that bypass RLS by design. Until these are tenant-bound, no amount of RLS work protects anything.
2. **Per-tenant payment credentials** — currently process-wide env vars with published *test* credentials as the fallback.
3. **No migration tooling at all.** `supabase-schema.sql` is a `DROP TABLE ... CASCADE` + reseed script, and both `DEPLOYMENT.md:300` and `BUSINESS-PLAN.md:290` instruct you to run it against production.

**43–68 engineer-days for one competent full-stack dev already fluent in this codebase — realistically 3–4 calendar months solo.**

### Current-state inventory

| Metric | Count |
|---|---|
| Tables (all in `public`) | 29 — **zero** have a tenant column |
| Physically single-row tables (`id BOOLEAN PK CHECK (id = TRUE)`) | 3 |
| `.from('<table>')` call sites | 209 (186 in `src/`, 23 in `tests/`) across 41 files |
| Write operations (`insert`/`update`/`delete`/`upsert`) | 109 |
| `createAdminClient()` — service role, bypasses RLS | **110 sites / 35 files** |
| `createServerSupabaseClient()` — session-bound, RLS applies | 22 sites / 9 files |
| `SECURITY DEFINER` RPCs | 13 functions / 23 call sites |
| RLS policies that are `USING (true)` | 42 statements (only real policy: `profiles_self_read`) |
| Realtime subscriptions | 0 |
| `middleware.ts` | **Does not exist** |
| Tests | 19 unit + 3 integration |

---

## What breaks the moment tenant #2 exists

Severity: 🔴 leak / financial · 🟠 corruption / hard failure · 🟡 broken feature.

| # | What | Where | Sev | Fix |
|---|---|---|---|---|
| **B1** | `idx_warehouses_one_default` is `UNIQUE ON warehouses(is_default) WHERE is_default` — **only one warehouse in the entire database can be default.** Tenant #2's provisioning fails outright on a unique violation. | [`supabase-schema.sql:1075`](supabase-schema.sql#L1075) | 🟠 | `UNIQUE(tenant_id) WHERE is_default` — 10 min |
| **B2** | `set_default_warehouse()` runs `UPDATE warehouses SET is_default=FALSE WHERE is_default AND id <> p_id` — no tenant predicate. Tenant B setting their default **unsets every other tenant's**. | [`supabase-schema.sql:939-944`](supabase-schema.sql#L939-L944), called from [`warehouse.service.ts:115`](src/services/warehouse.service.ts#L115) | 🟠 | add `p_tenant_id` — 0.5 d |
| **B3** | `upsertCustomerByPhone` looks up `customers` by phone with **no tenant filter**. A shopper already in shop A's directory buys at shop B → the sale attaches to **A's customer row** and loyalty points credit there. Completely silent — no error, no log. Reinforced by `customers_phone_unique`, which makes a separate row impossible. | [`customer-link.ts:32-46`](src/services/customer-link.ts#L32-L46), [`supabase-schema.sql:200`](supabase-schema.sql#L200) | 🔴 | composite unique + scoped lookup — 0.5 d |
| **B4** | `ensureProfile()` auto-creates a `role: 'member'` profile for **any** authenticated user, granting `products.view` / `orders.view` / `sales.view`. With public signup on, a stranger lands in a dashboard showing cost prices, orders and revenue. There is no "belongs to no business" state anywhere in the codebase. | [`session.ts:42-71`](src/lib/auth/session.ts#L42-L71), [`permissions.ts:221-225`](src/lib/auth/permissions.ts#L221-L225) | 🔴 | stop auto-creating; onboarding screen — 2 d |
| **B5** | eSewa/Fonepay merchant credentials are process-global env vars **with the published test credentials as fallback** (`EPAYTEST` / `8gBm/:&EnhH.1/q`). Every tenant's payments route to one merchant account; an unconfigured tenant silently transacts against a sandbox and shows customers a "successful" payment that collects nothing. | [`esewa/config.ts:19-23`](src/lib/esewa/config.ts#L19-L23), [`fonepay/config.ts:22-32`](src/lib/fonepay/config.ts#L22-L32) | 🔴 | Phase 6 — 4–7 d |
| **B6** | `deleteImage()` takes a **caller-supplied URL**, string-splits it, and deletes with the service-role client. Anyone with `products.edit` in any tenant can delete any other tenant's image. Uploads are `${folder}/${Date.now()}.${ext}` with `upsert: true` → same-millisecond cross-tenant overwrite. | [`upload.service.ts:61-104`](src/services/upload.service.ts#L61-L104) | 🔴 | Phase 7 — 2–3 d |
| **B7** | `SUPER_ADMIN_EMAILS` is a global env var that force-promotes to `admin` and pins `isActive: true`. In a shared deploy that is **admin in every tenant, unlogged**. | [`session.ts:24-34`](src/lib/auth/session.ts#L24-L34), applied at `:52`, `:63`, `:91` | 🔴 | `platform_staff` + logged impersonation — 2 d |
| **B8** | Three tables are **physically single-row** (`id BOOLEAN PRIMARY KEY CHECK (id = TRUE)`): `business_profile`, `ncm_settings`, `app_subscription`. Tenant B saving their shop name **overwrites tenant A's** — including invoice prefix, currency, loyalty config. 7 hard-coded `id = true` call sites. | [`supabase-schema.sql:576`](supabase-schema.sql#L576), `:599`, `:675` | 🟠 | Phase 1 — 1–1.5 d |
| **B9** | `claim_invoice_number()` increments the one `business_profile` row — a **shared counter across all tenants**. Tenant B's invoices come out 47, 52, 61, leaking A's volume; sequential numbering is a Nepali tax-compliance expectation, so gaps are an accounting problem, not cosmetic. Both tenants default to prefix `INV`, so `invoices.invoice_number UNIQUE` hard-fails on the first collision. | [`supabase-schema.sql:948-958`](supabase-schema.sql#L948-L958), [`invoice.service.ts:141`](src/services/invoice.service.ts#L141) | 🟠 | per-tenant counters — 1 d |
| **B10** | Global unique constraints that block ordinary operation: `warehouses_code_unique` (every tenant's seeded `MAIN` warehouse fails), `idx_products_barcode` + `idx_variants_barcode` (**two shops stocking the same manufacturer EAN — routine in retail — and the second cannot save the product**), `categories_name_unique` ("Shirts"), `vendors_code_unique`, `products.sku`, `orders.order_number` / `sales.sale_number` BIGSERIAL (customer-facing numbers jump, leaking platform-wide volume), `orders.ncm_order_id`. | `:82`, `:106`, `:137`, `:229`, `:402`, `:425`, `:465`, `:627`, `:1046`, `:1057` | 🟠 | Phase 1 — 1–2 d |
| **B11** | NCM webhook authenticates against the **single** `ncm_settings.webhook_secret` (nullable free text) and then looks up `orders` by `ncm_order_id` **with no tenant filter**. One secret drives status transitions — and the stock movements they trigger — on any tenant's order. `api_token` is likewise one courier account for everybody. | [`api/ncm/webhook/route.ts:34-69`](src/app/api/ncm/webhook/route.ts#L34-L69) | 🟠 | per-tenant route + generated secret — 1–2 d |
| **B12** | `/sm-control` + `app_subscription` is **one global kill-switch** — locking a non-paying tenant locks every tenant's dashboard. This is the entire revenue-enforcement mechanism. Gated by a **4-digit PIN** with no rate limiting, HMAC'd with the service-role key (so rotating that key silently invalidates all sessions). | [`src/app/sm-control/`](src/app/sm-control/), [`super-manager/auth.ts:21-33`](src/lib/super-manager/auth.ts#L21-L33), [`(admin)/layout.tsx:25-28`](<src/app/(admin)/layout.tsx#L25-L28>) | 🟡 | Phase 4 — 3–5 d |
| **B13** | `/` is **simultaneously** the SaaS marketing page (hero, pricing, testimonials) **and** a working storefront rendering `fetchProducts()` as "Fresh in the marketplace" → `/products` → `/cart` → `/checkout`. Whose products, once there are two tenants? Compounding: these routes set no `export const dynamic`, so in Next 16 they are prerender candidates — the storefront could be statically baked with one tenant's products and served to all. | [`(site)/page.tsx:142`](<src/app/(site)/page.tsx#L142>), `:420-458`, `:519` | 🟡🔴 | Phase 5 — 3–5 d |
| **B14** | `siteConfig.defaultSiteName` and `SUPPORT_WHATSAPP_NUMBER` are build-time constants, so a tenant's storefront footer shows **your** WhatsApp number. | [`src/config/site.ts`](src/config/site.ts), [`src/config/contact.ts`](src/config/contact.ts) | 🟡 | move to `business_profile` — 0.5 d |
| **B15** | `"dm-cart"` localStorage key is not namespaced. Harmless under subdomains (separate origins); under path-based routing, shop A's cart appears in shop B and checkout submits A's product UUIDs to B. **This is a forcing function on the routing decision.** | [`cart-context.tsx:45`](src/components/cart/cart-context.tsx#L45) | 🟡 | `dm-cart:${tenantId}` — trivial |
| **B16** | `profiles.default_warehouse_id` has **deliberately no FK**. A stale value can point at another tenant's warehouse → `deduct_stock` deducts from the wrong tenant's inventory. | [`supabase-schema.sql:969-973`](supabase-schema.sql#L969-L973) | 🟠 | validate on read — 0.5 d |
| **B17** | `ncm.service.ts` does `.from("ncm_branches").delete().neq("name", "")` — an unconditional table wipe. Exactly the shape the wrapper exists to contain. | [`ncm.service.ts:414`](src/services/ncm.service.ts#L414) | 🟠 | scoped by wrapper — free |
| **B18** | Every RLS policy is `USING (true)`. Any `authenticated` JWT can CRUD **all tenants'** products and categories; `anon` can read all products and all warehouse stock. | [`supabase-schema.sql:1130-1232`](supabase-schema.sql#L1130-L1232) | 🔴 | Phase 8 — 2–3 d |
| **B19** | `vendor-bills` and `user-documents` are **public buckets** holding scanned bills, PAN/VAT numbers, employment contracts, payslips and ID cards. Pre-existing bug; multi-tenancy multiplies the blast radius from embarrassment to reportable breach. | `supabase-schema.sql` §6 | 🔴 | private + signed URLs — 1 d |

**Not a bug, but worth recording:** the `cache()`-memoized globals — `getBusinessProfile` ([`invoice.query.ts:63`](src/queries/invoice.query.ts#L63)), `getActiveCurrency`, `getSubscriptionStatus`, `getAuthContext` — use React `cache()`, which is **per-request**. There is no cross-tenant bleed today. The risk is a future "optimization" to `unstable_cache` / `revalidate` without a tenant cache key. Record it as a guardrail, not a work item.

---

## The core mechanism

Two decisions carry the whole migration. Get these right and the remaining ~40 days are mechanical.

### 1. A tenant-scoped client that is the *only* way to reach `.from()`

`@supabase/postgrest-js` v2 `PostgrestQueryBuilder` has exactly five public entry points — `select`, `insert`, `upsert`, `update`, `delete` — so a hand-written façade over those five is *complete*. No `Proxy` is needed, and a Proxy would destroy type inference. Filters `append` rather than `set`, so an attempted override produces `tenant_id=eq.A&tenant_id=eq.B`, which ANDs to zero rows: **overrides fail closed.**

New `src/lib/tenancy/tenant-client.ts`:

```ts
export function tenantDb(tenantId: TenantId) {
  const admin = createUnscopedAdminClient();
  return {
    from(table: TenantTable) {
      const qb = admin.from(table);
      return {
        select: (cols = "*", o?) => qb.select(cols, o).eq("tenant_id", tenantId),
        insert: (v, o?)         => qb.insert(stamp(v, tenantId), o),
        update: (v, o?)         => qb.update(stamp(v, tenantId), o).eq("tenant_id", tenantId),
        delete: (o?)            => qb.delete(o).eq("tenant_id", tenantId),
        upsert: (v, o)          => { assertTenantInOnConflict(table, o);
                                     return qb.upsert(stamp(v, tenantId), o); },
      };
    },
    rpc: rpcScoped(admin, tenantId),          // typed map of the 13 functions; injects p_tenant_id
    storage: tenantStorage(admin, tenantId),
  };
}
```

Three details that are easy to get wrong:

- **`stamp()` must run *before* `qb.insert()`.** `PostgrestQueryBuilder.insert` computes the `?columns=` param from the union of payload keys *at call time*. Mutating the body afterwards produces a request whose column list omits `tenant_id`, and PostgREST silently drops it.
- **`upsert` must validate, not rewrite, `onConflict`.** Silently prefixing `"warehouse_id,product_id"` guesses at which of two partial indexes you meant. Throw instead. All three real call sites are the singleton tables and become `{ onConflict: "tenant_id" }`.
- **`.rpc()` is deliberately not exposed raw.** Reaching for it is a *type error*. `db.rpc()` is typed against a hand-written map of the 13 functions; a new RPC that isn't in the map fails to compile.

**Making a mistake a compile error, not a leak — four layers, strongest first:**

1. **Rename `createAdminClient` → `createUnscopedAdminClient`** in [`server.ts`](src/lib/supabase/server.ts). That one rename converts all 110 call sites into compile errors — a mechanical, *exhaustive* to-do list rather than a grep you hope you got right.
2. **Retype the ten existing aliases.** Ten files already declare `type SupabaseClient = ReturnType<typeof createAdminClient>`: [`order-engine.ts:20`](src/services/order-engine.ts#L20), [`sale-engine.ts:33`](src/services/sale-engine.ts#L33), [`order.service.ts:109`](src/services/order.service.ts#L109), [`sale.service.ts:45`](src/services/sale.service.ts#L45), [`product.service.ts:431`](src/services/product.service.ts#L431), [`combo.service.ts:172`](src/services/combo.service.ts#L172), [`customer-link.ts:13`](src/services/customer-link.ts#L13), [`ncm/sync.ts:12`](src/lib/ncm/sync.ts#L12), [`price-history.ts:4`](src/lib/products/price-history.ts#L4), [`fonepay/actions.ts:140`](src/lib/fonepay/actions.ts#L140). Changing **ten lines** to `TenantDb` type-checks ~60 engine call sites for free. Highest-leverage change in the project.
3. **ESLint** in `eslint.config.mjs`: `no-restricted-imports` banning `createUnscopedAdminClient` outside an allowlist (`src/lib/tenancy/**`, `src/services/platform/**`, `src/app/api/**/webhook/**`, `src/lib/auth/session.ts`, `tests/**`), plus `no-restricted-syntax` banning hand-written `.eq("tenant_id", …)`.
4. **A CI grep guard** against an explicit file list — ESLint `ignores` are globs, and a new directory silently escapes them.

### 2. Composite foreign keys — what makes nested selects provably safe

`.eq("tenant_id", X)` applies to the **root relation only**. There are four embedded selects — [`api/ncm/webhook/route.ts:59`](src/app/api/ncm/webhook/route.ts#L59) plus the hoisted `ORDER_SELECT` ([`order.query.ts:12`](src/queries/order.query.ts#L12)), `SALE_SELECT` ([`sale.query.ts:13`](src/queries/sale.query.ts#L13)) and `INVOICE_SELECT` ([`invoice.query.ts:11`](src/queries/invoice.query.ts#L11)) — and PostgREST resolves each embed by walking the FK **with no tenant predicate on the child**. Children are safe *only because of the FK*. That is a hope, not a guarantee, unless you make it one:

```sql
ALTER TABLE orders ADD CONSTRAINT orders_tenant_id_key UNIQUE (tenant_id, id);
ALTER TABLE order_items
  DROP CONSTRAINT order_items_order_id_fkey,
  ADD CONSTRAINT order_items_order_fk
    FOREIGN KEY (tenant_id, order_id) REFERENCES orders (tenant_id, id) ON DELETE CASCADE;
```

Applied to all ~35 parent/child FKs, a cross-tenant link becomes **rejected by Postgres**. This is the single most important schema decision in the plan.

> **Gotcha:** ~12 of these FKs are `ON DELETE SET NULL` on a nullable child column (`stock_movements.product_id`, `order_items.combo_id`, `sales.customer_id`, …). A composite `SET NULL` tries to null both columns and fails against `tenant_id NOT NULL`. Use the PostgreSQL 15+ column-list form: `ON DELETE SET NULL (product_id)`.

---

## Phases

### Phase 0 — Migration tooling (BLOCKING) · 3–5 d

Nothing else can start. `supabase-schema.sql` drops every table and reseeds demo data, and `DEPLOYMENT.md:300` / `BUSINESS-PLAN.md:290` both tell you to run it against production. Self-hosted Supabase has no PITR.

- Introduce `supabase/migrations/`; baseline the current schema as `0001_baseline.sql`.
- Add a guard at the top of `supabase-schema.sql` that aborts if any table has rows. Keep it as the **dev-reset artifact only**, and regenerate it from the migrated DB (`pg_dump --schema-only`) so the two can't diverge.
- **Reverse the rules that would otherwise re-introduce untenanted code.** `RULES.md:537` literally says *"Add `site_id` columns or `siteId` params → This is a single-site app — no multi-tenancy"*, and `supabase-schema.sql:1408-1417` says *"NEVER create separate migration files."* Both are read as gospel by every future contributor, human or AI. Update `RULES.md`, `AGENTS.md`, `PATTERN.md`, and §7 of the schema file.
- Wire migrations into CI and `scripts/test-db.sh` — `.github/workflows/ci.yml` already uses `supabase/setup-cli@v1`, so this is half-done.

### Phase 1 — Schema · 6–9 d

- `tenants(id, slug UNIQUE, custom_domain UNIQUE, name, status, created_at)`; `tenant_counters(tenant_id, kind, next_value, PK(tenant_id, kind))`.
- `tenant_id UUID NOT NULL REFERENCES tenants(id)` on **all 28 business tables, including pure children** (`order_items`, `sale_items`, `invoice_items`). They are queried directly, not only through embeds — [`order.service.ts:212`](src/services/order.service.ts#L212), [`combo.service.ts:319`](src/services/combo.service.ts#L319), [`invoice.service.ts:189`](src/services/invoice.service.ts#L189) — and a per-table exception list is precisely the silent-leak surface being eliminated. Cost is 16 bytes/row.
- **Every unique constraint becomes composite** (B10): `categories_name_unique`, `warehouses_code_unique`, `vendors_code_unique`, `customers_phone_unique`, `products.sku`, `idx_products_barcode`, `idx_variants_sku`/`_barcode`, `product_variants_unique_combo`, `combo_items_unique`, `orders.order_number`, `sales.sale_number`, `orders.ncm_order_id`, `invoices.invoice_number`, `invoices.sale_id`, `sales.order_id`, `idx_wh_stock_product`/`_variant`, `idx_loyalty_earn_per_sale`, `ncm_branches` PK. **And `idx_warehouses_one_default` → `UNIQUE(tenant_id) WHERE is_default`** (B1).
- ~35 composite FKs, per the section above.
- **Index strategy is a rule, not a blanket rewrite.** Prefix `tenant_id` on indexes whose leading column is a sort key or low-cardinality (`idx_orders_created`, `idx_sales_date`, `idx_products_featured`, `idx_*_sort`, …) — without it they degrade into global scans plus filter. **Leave the UUID-FK lookups alone** (`idx_order_items_order`, `idx_sale_items_sale`, `idx_variants_product`) — a UUID is already maximally selective and a leading `tenant_id` there is neutral-to-harmful.
- **Singletons (B8):** drop the `id BOOLEAN` column; `tenant_id` becomes the PK. ×3.
- **All 13 RPCs take `p_tenant_id`.** The tempting conclusion is that the 11 UUID-keyed ones are safe. They are not: `warehouse_id` is never validated — [`order.service.ts:133`](src/services/order.service.ts#L133) takes `input.warehouseId` straight from the client and falls back to the default. Unguessable ≠ authorized. Postgres keys functions by argument type, so `DROP FUNCTION` first (the schema already models this discipline at `:945-955`). `transfer_stock`'s two `ON CONFLICT` clauses must be updated to the new tenant-prefixed partial indexes or the upsert silently stops inferring.
- `claim_counter(p_tenant_id, p_kind)` generalizing `claim_invoice_number`; `provision_tenant(...)`.

**Numbering (B9).** `order_number` and `sale_number` move from `BIGSERIAL` to `claim_counter` — note they are currently DB-assigned, so insert paths must claim first and set them explicitly ([`sale.service.ts:449`](src/services/sale.service.ts#L449) and [`fonepay/actions.ts:50`](src/lib/fonepay/actions.ts#L50) read them back). **`products.sku` and `barcode` keep their global sequences** — with `UNIQUE(tenant_id, sku)` a shared sequence is *correct*, only cosmetically leaky (tenant #2's first product is `SKU-00047`). Going per-tenant means both insert paths lose their DB-side default for no user-visible gain. Correctness now, aesthetics later.

### Phase 2 — Tenancy core · 3–4 d

`src/lib/tenancy/`: `tenant-client.ts`, `rpc.ts` (typed 13-function map), `resolve.ts` (host → tenant, `cache()`-memoized like `getAuthContext`). `getTenantDb()`. `AuthContext.tenantId` + `isPlatformAdmin` in [`src/types/user.types.ts`](src/types/user.types.ts) — `ensureProfile` already does `select("*")`, so `tenant_id` arrives with **zero extra queries**. ESLint rules + CI guard. The `createUnscopedAdminClient` rename.

**Resolve inside each service; do not add a `tenantId` parameter to service signatures.** It would change ~120 public signatures consumed by `src/hooks/**`, and — decisively — the tenant would become an *argument*, i.e. attacker-influenced. It must always derive from the session, the host, or a webhook secret.

### Phase 3 — Mechanical conversion · 6–9 d

Replace `const supabase = createAdminClient()` with `const db = await getTenantDb()` at all 110 sites across 35 files — a 1:1 substitution that preserves existing file shapes. Retype the ten aliases. Fix everything `tsc` flags. The 3 singleton upserts. Order/sale number claiming. Use [`order-engine.ts`](src/services/order-engine.ts) as the reference conversion.

### Phase 4 — Auth, signup, provisioning · 4–6 d

- **`ensureProfile` stops auto-creating (B4).** No profile and no resolvable tenant → return `null` and route to onboarding. Never a dashboard.
- `tenant_id` on `profiles` + `UNIQUE(tenant_id, id)`. Reuse the existing role/permission model unchanged — the 33-permission catalog in [`permissions.ts`](src/lib/auth/permissions.ts) already works per-tenant once scoped.
- `(auth)/signup` route + `src/services/platform/signup.service.ts`. The flow mirrors the existing `inviteUser` rollback pattern ([`user.service.ts:96-133`](src/services/user.service.ts#L96-L133)): validate slug against a reserved list (`app www api admin auth dashboard login storage cdn mail static sm-control`) → `admin.auth.admin.createUser` → `provision_tenant` → on any failure, `deleteUser`.
- **`provision_tenant` must be a single `SECURITY DEFINER` plpgsql function.** Six separate PostgREST calls means a crash midway leaves a half-provisioned tenant, and the specific failure is nasty: no default warehouse → `getDefaultWarehouseId()` returns `null` → `placeOrder` fails with an unrelated error message. The codebase has no transaction primitive today; this is the one place you must add one. It seeds: tenant, owner profile, Main Warehouse, `business_profile`, `ncm_settings` (with a **generated** webhook secret), `app_subscription` (14-day trial), counters.
- **Gut §5–6 of `supabase-schema.sql`.** The demo catalog (3 categories, 8 products with hardcoded barcodes, 4 variants, 1 combo) moves to an optional `seed_demo_data(p_tenant_id)` behind a "start with sample products" checkbox. Note `tests/helpers/db.ts` currently depends on the seeded warehouse existing.
- **B7:** replace `SUPER_ADMIN_EMAILS` with a `platform_staff` concept and logged impersonation.
- **B12:** `app_subscription` keyed by tenant; `/sm-control` becomes a tenant list + picker on the unscoped client. **Replace the 4-digit PIN with real auth before public signup opens** — 10⁴ with no rate limiting was acceptable for one shop's kill switch; it would now guard every tenant's revenue.

### Phase 5 — Storefront and public surfaces · 4–6 d

**Subdomain routing** (`<slug>.example.com`), with `?tenant=` / cookie as a dev fallback and `custom_domain` deferred. Subdomain is the recommendation because it makes B15 free (localStorage is origin-partitioned) and gives origin isolation for storage and cookies. Cost: wildcard DNS + wildcard TLS.

- Add the first `middleware.ts`. There is none today — note [`server.ts:21-24`](src/lib/supabase/server.ts#L21-L24) already swallows cookie writes with the comment *"The middleware will handle refresh"*, so this also fixes a live latent bug.
- **Split marketing from storefront (B13).** Move `(site)/page.tsx`'s marketing content into a `(marketing)` group; middleware picks by host. Add `export const dynamic = "force-dynamic"` to the storefront routes.
- **Keep `(admin)` and `(auth)` on ONE host** (`app.example.com`). Do *not* serve them from tenant subdomains: Supabase auth cookies are host-scoped, so you would need a `.example.com` cookie domain — which ships every admin's session cookie to every tenant's storefront origin. This is the mistake that gets found late and is expensive to unwind.
- B14 (branding → `business_profile`), B15 (`dm-cart:${tenantId}`, with a one-time read of the legacy key so existing shoppers don't lose their basket), B11 (`/api/ncm/webhook/[tenant]` + per-tenant `NOT NULL UNIQUE` generated secret + per-tenant `api_token`), B16.

### Phase 6 — Per-tenant payment credentials · 4–7 d

- `payment_settings(tenant_id, provider, merchant_code, secret_key_enc, ...)` with encryption at rest; settings UI.
- Refactor the signature helpers to **take credentials as arguments** — [`esewa/index.ts:16,54,62`](src/lib/esewa/index.ts#L16) and [`fonepay/index.ts:12,39,47`](src/lib/fonepay/index.ts#L12) currently import the module constant directly.
- `ESEWA_CONFIG` ([`esewa/config.ts:18`](src/lib/esewa/config.ts#L18)) is a module-level `const` whose `successUrl` getter reads a single process-wide `NEXT_PUBLIC_SITE_URL` → becomes `esewaConfig(baseUrl)`.
- **Remove the published-test-credential fallbacks.** An unconfigured tenant must fail loudly, not transact against a sandbox.
- The existing `?ref=<transaction_uuid>` design (forced by eSewa's ~250-char `success_url` cap) is a gift here: add `tenant_id` to `pending_esewa_checkouts` and derive the tenant from **that row**, so a callback landing on the wrong host still books against the right tenant.
- Fonepay is simpler — `generatePrn()` is ours, so `UNIQUE(tenant_id, fonepay_prn)` plus a scoped lookup at [`fonepay/actions.ts:150`](src/lib/fonepay/actions.ts#L150) suffices, and that path is already admin-authed.

### Phase 7 — Storage · 2–4 d

`${tenantId}/${folder}/${crypto.randomUUID()}.${ext}`; assert `bucketPath.startsWith(tenantId + "/")` in `deleteImage`, with a documented carve-out for tenant #1's legacy un-prefixed paths (B6); **`vendor-bills` and `user-documents` → private + signed URLs** (B19). One file, three call sites.

### Phase 8 — Testing and the RLS backstop · 5–8 d

- `tests/helpers/db.ts`: add `seedTenant()`, thread `tenantId` through the ~20 helpers. New `tests/helpers/tenancy.ts`: `makeTwoTenants()` going through `provision_tenant`, so provisioning is itself covered.
- **`tests/integration/cross-tenant-leak.test.ts` — the highest-value test in the project.** Table-driven over all 28 business tables; for each: A's select returns only A's rows; A's unfiltered delete leaves B intact; A's update against B's id affects 0 rows; `insert({tenant_id: B})` throws. Plus the four embed shapes.
- **`tests/integration/schema-invariants.test.ts`** — the guard that survives future feature work, worth more than any amount of PR review. Assert via `information_schema` / `pg_index` / `pg_constraint` that: every table has a `NOT NULL tenant_id`; no unique index omits `tenant_id`; every FK between two tenant tables is composite.
- Two-tenant RPC tests: `reserve_stock(A, whB, prodB, 1)` must return `FALSE`; `claim_counter` must give A and B independent sequences both starting at 1.
- Wrapper unit tests with a stubbed `fetch`, asserting the generated URL — including that array `insert` puts `tenant_id` in the `?columns=` param (the ordering trap above).
- **RLS as a backstop, not the primary control (B18).** Rewrite the `USING (true)` policies. Do **not** attempt full RLS across 29 tables: `service_role` bypasses RLS, so adding policies changes nothing about the code you write. Ship `FORCE ROW LEVEL SECURITY` on the four highest-consequence tables only — `customers`, `sales`, `vendors`, `user_documents` — read through a `tenant_reader` role with the tenant as a JWT claim. That catches the reportable-breach cases for ~4–6 d; full RLS is a 15–20 d separate project.

### Phase 9 — Live migration and cutover · 3–5 d

Split the forward migration in two, so ~90% of the change has a real rollback story:

- **`01-additive.sql`** — reversible, deploys days early: `tenants` + the tenant #1 row; per table `ADD COLUMN tenant_id` → `UPDATE` → `SET NOT NULL` → FK; `CREATE UNIQUE INDEX CONCURRENTLY` for every new composite while the old ones still stand; composite FKs `ADD CONSTRAINT … NOT VALID` then `VALIDATE CONSTRAINT` separately; counters seeded from `SELECT max(order_number)+1`; new RPC signatures created alongside the old ones, with the old forms delegating using the hardcoded tenant #1 id.
- **`02-breaking.sql`** — cutover window: drop old uniques, drop the `id BOOLEAN` columns, `ALTER COLUMN order_number DROP DEFAULT`, `DROP FUNCTION` the old signatures.

Rehearse on a restored production snapshot and measure before booking the window. This is a shop POS with no zero-downtime requirement — take the 3am window and stop engineering around it. Storage: leave legacy objects in place, with the carve-out documented rather than accidental.

### Phase 10 — Hardening · 3–5 d

Leaks the tests find; `EXPLAIN` the 10 dashboard queries against a 10-tenant seed; UAT.

---

## Effort summary

| Phase | Days |
|---|---|
| 0 · Migration tooling (blocking) | 3–5 |
| 1 · Schema | 6–9 |
| 2 · Tenancy core | 3–4 |
| 3 · Mechanical conversion (110 sites) | 6–9 |
| 4 · Auth, signup, provisioning | 4–6 |
| 5 · Storefront + public surfaces | 4–6 |
| 6 · Per-tenant payments | 4–7 |
| 7 · Storage | 2–4 |
| 8 · Tests + partial RLS backstop | 5–8 |
| 9 · Live migration + cutover | 3–5 |
| 10 · Hardening | 3–5 |
| **Total** | **43–68 d** ≈ **9–14 weeks solo** |

---

## Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **R1** | Someone runs `supabase-schema.sql` against a live tenant DB. Both docs instruct exactly this, the file is named like the source of truth, and self-hosted has no PITR. | **High** | **Catastrophic** | Phase 0 first. Rename it, add a row-count abort guard, delete the "never create migration files" rule, dump before every migration. |
| **R2** | A missed `.from()` site leaks another tenant's data. ~7,162 LOC of dense service code; at a 99% first-pass hit rate that is ~1.4 misses, and the realistic number is higher. **You will ship at least one.** | High | **Catastrophic** | The rename → 110 forced compile errors; the `TenantDb` type; ESLint + CI grep; the leak matrix; partial RLS on the four worst tables. |
| **R3** | **Selects, updates and deletes fail *open*.** A forgotten scope returns or mutates every tenant's rows with no error, and the dashboard renders it as ordinary data. (Inserts fail closed — `tenant_id NOT NULL` → 23502.) | High | **Catastrophic** | This asymmetry is exactly what the partial RLS backstop buys down, and is the single strongest argument for the last item in Phase 8. |
| **R4** | A future PR adds a table or query without `tenant_id`. | High | Critical | `schema-invariants.test.ts` in CI; ESLint; **rewrite `RULES.md:537` and schema §7** — they currently instruct the opposite. |
| **R5** | Payments misroute to the platform merchant account, or a tenant transacts on published test credentials. | Certain before Phase 6 | **Catastrophic** (financial + KYC) | Hard-disable online checkout for tenant ≥2 until Phase 6 lands. Remove the test-credential fallbacks. |
| **R6** | Composite FK + `ON DELETE SET NULL` fails against `tenant_id NOT NULL` (~12 FKs). | High | Medium | PG15 `ON DELETE SET NULL (col)` syntax; test every SET NULL path. |
| **R7** | Cutover overruns or cannot be rolled back. | Medium | High | Additive/breaking split; snapshot rehearsal; keep old RPC signatures for one deploy. |
| **R8** | Auth cookie widened to `.example.com` ships admin sessions to tenant storefront origins. | Low | **Catastrophic** | Keep `(admin)`/`(auth)` on one host. Never widen the cookie domain. |
| **R9** | `/sm-control`'s 4-digit PIN now controls every tenant's kill switch. | Certain | High | Real platform-admin auth before public signup opens. |
| **R10** | Query performance regresses on un-prefixed indexes. | Medium | Medium | Prefix sort / low-cardinality indexes only; `EXPLAIN` against a 10-tenant seed. |
| **R11** | `BUSINESS-PLAN.md:138-149` promises *"free customization on request — tweak fields, statuses, receipt format to match how your shop actually runs."* Under a shared database that is impossible to honor; honored literally it means a code fork per tenant. | High if sold | High | Reframe **now**, before it is sold to anyone, as *configuration* only — branding, invoice layout, theme, currency and permission grants are all already DB-driven. Quote everything else. |
| **R12** | Scope creep: theming, plans, billing automation. | High | Medium | Explicitly out of scope. `app_subscription` stays a manual flag; the existing 33-permission catalog + `business_profile` flags already cover entitlements. |

### Explicitly out of scope

Custom domains at launch (subdomains until ~20 tenants; per-customer cert automation is its own project) · automated recurring billing (manual collection plus the existing lock switch is fine to ~25 tenants) · a plan/entitlement engine · full RLS across all 29 tables · per-tenant SKU/barcode sequences · any speculative half-done tenancy refactor (half-done tenancy is worse than none — it looks safe and isn't).

---

## Verification

1. **Unit** — `pnpm test:unit`. Wrapper URL-generation tests with a stubbed `fetch`: select appends `tenant_id=eq.X`; array insert stamps every element **and** `?columns=` contains `tenant_id`; upsert without a tenant-prefixed `onConflict` throws; `update({tenant_id: other})` throws.
2. **Integration** — `pnpm test:integration` (via `scripts/test-db.sh`). `cross-tenant-leak.test.ts` across all 28 tables × 5 assertions; `schema-invariants.test.ts`; two-tenant `stock-oversell` and `invoice-number`.
3. **Static** — `pnpm typecheck` must be clean after the `createUnscopedAdminClient` rename; a non-zero count of unconverted sites *is* the failure signal. Plus `pnpm lint` and the CI grep allowlist.
4. **End-to-end, two tenants, manually:**
   - Sign up A and B → each provisions its own Main Warehouse *(proves B1, B2)*
   - Create a product in each with the **same barcode and same SKU** *(proves B10)*
   - Sell to the **same phone number** in both; confirm two separate customer rows with independent loyalty balances *(proves B3)*
   - Issue an invoice in each; confirm both start at `INV-1` *(proves B9)*
   - Set a default warehouse in B; confirm A's is untouched *(proves B2)*
   - Upload a product image in each; confirm tenant-prefixed paths. Attempt `deleteImage` with A's URL while signed in as B; confirm rejection *(proves B6)*
   - Sign up C and confirm the onboarding screen, never a dashboard *(proves B4)*
   - Visit A's and B's storefront subdomains; confirm disjoint product lists and disjoint carts *(proves B13, B15)*
   - Complete an eSewa checkout on each; confirm each settles to its own merchant code *(proves B5)*
5. **Performance** — seed 10 tenants at realistic volume; `EXPLAIN ANALYZE` the dashboard, analytics, product-list and sales-list queries; confirm index usage and no sequential scans.
6. **Migration rehearsal** — restore a production snapshot, run `01-additive` then `02-breaking`, run the full test suite against the result, and time it before booking the real window.
