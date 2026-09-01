# Digital Manager — Go-to-Market, Pricing & Cost Architecture (Nepal)

_A plan to sell the Digital Manager POS + website system to many Nepali vendors profitably._

---

## Context

The goal: sell this Next.js + Supabase POS **and** website system to many Nepali vendors — one
deployment per vendor — charging **NPR 1,000–1,500/month**. The perceived blocker was that
Supabase would cost too much per client. The real situation:

- **The problem isn't the price — it's the cost model.** A *separate managed Supabase Pro
  project per client* costs **$25/mo base + ~$10/mo per extra project** (Supabase Pricing,
  2026). That's ~NPR 1,330/mo of infra *per client*, against a NPR 1,000–1,500 price —
  break-even at best, a loss once usage fees land ($35–75/mo typical).
- **The code is single-tenant "to the bone":** singleton config tables using
  `CHECK (id = TRUE)` in `supabase-schema.sql`, no `tenant_id`/`org_id` on any table, RLS used
  only as a public/private gate, and most writes go through a service-role client that
  *bypasses* RLS. So the cheapest *managed* option (pooled multi-tenant) would be a large,
  risky refactor of every file in `src/queries/*` and `src/services/*`.

**Chosen direction:** sell **website + POS as a bundle**, keep the **build minimal now**, and
use the infra model recommended below. This makes NPR 1,000–1,500 highly profitable with
near-zero code change.

---

## Part 1 — Cost Architecture (this is what makes the pricing work)

### Recommendation: **Self-host the open-source Supabase stack on ONE VPS, one stack (or DB) per client. Do NOT use managed Supabase per client.**

Supabase is open source. Self-hosted, you run **unlimited** projects/databases on a single box
for **one flat VPS fee** — the per-project $10/mo trap disappears entirely. This matches the
current single-tenant code exactly: each client deployment just points
`NEXT_PUBLIC_SUPABASE_URL` + the anon/service keys at *its own* stack (see
`src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`). **Zero data-model refactor.**

**Why not the alternatives (for now):**

| Option | Verdict |
|---|---|
| Managed Supabase per client | ~NPR 1,330/mo/client infra → kills margin. **Rejected.** |
| Pooled multi-tenant (`tenant_id` + RLS) on one managed Pro | Cheapest managed, but rewrites every query/service and re-architects RLS. Too much build for "minimal now." **Revisit at 50+ clients.** |
| Schema-per-tenant, managed | Still tied to single-DB Supabase Auth (GoTrue); awkward. Self-hosting removes the constraint. |

### Concrete setup
- **1 VPS** — Hetzner CX32/CX42 (8–16 GB RAM) ≈ **€6–16/mo (~NPR 1,000–2,400/mo total)**, or a
  local Nepali cloud/dedicated box if latency/data-residency helps sales.
- Deploy the Supabase Docker stack **once per client** (isolated by Docker Compose project +
  ports), each with its own Postgres. Budget ~1–1.5 GB RAM per active small tenant → a 16 GB
  box comfortably holds ~10 early clients; add boxes as you grow.
- **Provisioning = a script**, not new engineering: create the stack, run the existing
  `supabase-schema.sql` (idempotent, one file), seed `business_profile`, deploy the Next.js app
  with that client's env. No schema changes.
- **Nightly `pg_dump` per client** to object storage — backups are the #1 ops duty.

### Unit economics (self-hosted)
| Clients | Monthly revenue @ NPR 1,200 | Infra (VPS + backups) | Gross margin |
|---|---|---|---|
| 5   | 6,000   | ~1,500  | ~75% |
| 10  | 12,000  | ~2,500  | ~79% |
| 25  | 30,000  | ~5,000 (2 boxes) | ~83% |
| 50  | 60,000  | ~10,000 | ~83% |

Marginal cost per new client ≈ **near zero** (just RAM). The price point works.

### Billing enforcement (minimal build — reuse existing)
The mechanism already exists: the **`/sm-control` PIN-gated subscription kill-switch**
(`src/services/subscription.service.ts`, `app_subscription` table with `expires_at`,
`disabled`, `locked_message`). Collect payment manually (**Khalti / eSewa / bank transfer**);
if a client doesn't pay, set `expires_at`/`disabled` and their dashboard locks. No new billing
code needed for launch.

---

## Part 2 — Pricing Plan

### Positioning anchor vs competitors
- **Blanxer** = online-store builder: free (15 products), Premium ~NPR 1,167/mo (quarterly),
  annual NPR 24k–48k. Strong website, **weak physical-counter POS**.
- **Traditional Nepali POS vendors (BroadX etc.)** = counter billing/inventory, often one-time
  license + AMC. **Weak/no modern online store.**
- **Your wedge:** *one system that is both* — website **+** counter POS **+** multi-warehouse
  inventory **+** eSewa/Fonepay **+** NCM courier, already built for Nepal. Nobody at this price
  does both well.

### The three plans (every plan is website **+** POS — the difference is scale)

Every vendor, on every plan, gets a **real online store, a counter POS, inventory, invoicing,
and free customization on request** (see below). Nobody is locked out of the core system — higher
tiers unlock *more locations, more staff, and more automation*, not the basics.

#### What's in every plan (even Starter)
- **Online storefront** — product catalog, images, featured products, order checkout.
- **Counter POS** — fast billing, line-item sales, cash/QR, returns & restock.
- **Inventory** — real-time stock, low-stock visibility, one warehouse.
- **Invoicing** — branded invoices from any sale, mark paid / reopen / cancel, your own
  invoice numbering & prefix.
- **eSewa / Fonepay QR payments** — get paid online and at the counter, built for Nepal.
- **Customer directory** — purchase history per customer.
- **Nepali-first** — NPR currency, local payment rails, local support.
- **Free customization on request** *(all vendors, every plan — see the section below).*

### Tiers — monthly & yearly (yearly = **2 months free, ~17% off**)
| Plan | Monthly | **Yearly** (save ~17%) | Best for |
|---|---|---|---|
| **Starter** | **NPR 999/mo** | **NPR 9,990/yr** _(≈ NPR 833/mo)_ | A single shop going digital — one counter, one store, one location |
| **Business** ⭐ _(most popular)_ | **NPR 1,599/mo** | **NPR 15,990/yr** _(≈ NPR 1,333/mo)_ | A growing brand — online store + counter + loyalty + delivery |
| **Pro** | **NPR 2,999/mo** | **NPR 29,990/yr** _(≈ NPR 2,499/mo)_ | Multi-location / high-volume — several outlets, big team, priority line |

> 💡 **Yearly billing gives 2 months completely free** and locks your rate for 12 months —
> better cash flow for you, better price for them. **Push yearly hard.**

### Feature comparison
| Capability (backed by real permissions / `business_profile` flags) | Starter | Business ⭐ | Pro |
|---|:---:|:---:|:---:|
| Online storefront + product catalog | ✅ | ✅ | ✅ |
| Counter POS (billing, returns, restock) | ✅ | ✅ | ✅ |
| Invoicing (branded, custom numbering) | ✅ | ✅ | ✅ |
| eSewa / Fonepay QR payments | ✅ | ✅ | ✅ |
| Customer directory & purchase history | ✅ | ✅ | ✅ |
| Warehouses | 1 | up to 3 | Unlimited |
| Staff logins (granular permissions) | 2 | 5 | Unlimited |
| **Loyalty points** (earn / redeem / adjust) | — | ✅ | ✅ |
| **Vendor / payables ledger** (bills, payments, attachments) | — | ✅ | ✅ |
| **NCM courier** (dispatch + live delivery status) | — | ✅ | ✅ |
| **Cost & profit reporting** | — | ✅ | ✅ |
| Multi-warehouse stock transfers | — | ✅ | ✅ |
| **Custom domain** (`yourbrand.com`) | — | Add-on | ✅ Included |
| Priority support (same-day) | — | — | ✅ |
| **Free customization on request** | ✅ | ✅ | ✅ |

- Feature-gating is achievable *today* with the granular permissions catalog
  (`src/lib/auth/permissions.ts`) + `business_profile` flags (`loyalty_enabled`, etc.) — no new
  entitlement engine required for launch.

### 🎁 Free customization on request — for **every** vendor, every plan
This is the differentiator no competitor offers at this price. **Every vendor** — Starter to Pro —
can request tailoring of their own system and we do it, included:
- **Your branding** — logo, colours, shop name, invoice layout, storefront look.
- **Your workflow** — tweak fields, statuses, receipt format, product options to match how
  *your* shop actually runs.
- **Fair-use policy:** reasonable adjustments are **included free**; large bespoke builds
  (a whole new module, a third-party integration) are quoted separately — but the everyday
  "can you change this for my shop?" is always yes, at no extra cost.

Because each vendor runs on their **own isolated stack** (see Part 1), customizing one shop never
touches another — so "make it fit my business" is a promise we can actually keep for everyone.

### One-time onboarding
- **Setup fee: NPR 3,000–5,000 one-time** — we do it *for* you: data import, branding, staff
  training, and go-live. Real cash upfront, filters tire-kickers, funds provisioning time. **Keep this.**

### Add-ons (the upsell levers)
- Extra warehouse · extra staff seats · custom domain setup (free on Pro)
- SMS / loyalty marketing campaigns
- Bespoke feature development beyond fair-use (per quote — the real revenue lever)

### Why these numbers are a genuinely good deal
- **NPR 1,599/mo ≈ 53 NPR/day — one cup of chiya** — for a *complete* business system:
  website **+** billing **+** inventory **+** loyalty **+** vendor ledger **+** NCM delivery,
  **plus** free customization. There is no other single tool in Nepal that bundles all of this.
- **Against Blanxer** (~NPR 1,167/mo, website only, weak counter POS): you're in the same price
  band but you *also* give them a real POS, inventory, and vendor books.
- **Against legacy Nepali POS vendors** (one-time licence + AMC, little/no online store): you add
  a modern web store *and* keep the counter billing they already need.
- **Yearly plans + setup fee = upfront cash** to fund customer acquisition, while free
  customization + done-for-you onboarding **crush churn**.

---

## Part 3 — Marketing / Go-to-Market Plan (Nepal, founder-led, low budget)

**ICP (first 20 customers):** small–medium retail + D2C sellers in Kathmandu Valley & Pokhara —
clothing/fashion, cosmetics/skincare, electronics/gadgets, gifts, F&B — especially
**Instagram/TikTok sellers who want to "go legit"** with a real website + inventory + billing.

**One-line pitch:** _"Website + billing + inventory + eSewa/Fonepay + NCM delivery — one system,
made for Nepal, from NPR 899/month."_

### Channel priorities
1. **Founder-led field sales + concierge setup** — _the #1 channel._ Walk into shops in
   Newroad/Asan/Boudha/Pokhara Lakeside, demo on a tablet, do the "we set it all up for you"
   onboarding. Done-for-you setup is the moat; it justifies the setup fee and crushes churn.
2. **Short-form video — TikTok & Instagram Reels.** "Set up your online store in 5 minutes,"
   messy khata vs clean dashboard, customer wins. Dominant reach in Nepal, essentially free.
3. **Facebook/Instagram ads + Groups.** Cheap CPMs; target local business/seller groups; run
   retargeting to demo-page visitors. Give value in groups before promoting.
4. **Two-sided referrals + reseller program.** Client refers a shop → both get 1 month free.
   Recruit local accountants / IT shops / web freelancers as commissioned resellers.
5. **Competitor comparison content ("marketing jiu-jitsu").** Publish "Digital Manager vs
   Blanxer" (you: website **+** POS in one) and "modern alternative to [legacy POS]." Rank for
   "POS software Nepal," "online store Nepal," "billing software Nepal."
6. **Partnerships with NCM (courier) & eSewa/Fonepay.** Already integrated — ask for
   co-marketing / directory listing for instant credibility.
7. **Public demos + testimonials.** Weekly live demo (Facebook Live / Zoom in Nepali); turn
   every happy client into a screenshot/video testimonial.

### Launch tactics
- **14-day free trial with paid setup** (not a perpetual free tier — free tenants burn VPS RAM).
  Trials convert because _you_ set it up during them.
- **Early-adopter pricing:** first 20 shops lock a founder rate for 1 year in exchange for a
  testimonial + case study.
- **Land-and-expand:** Starter → Business (website add-on) → Pro (multi-location, custom
  features).

---

## Part 4 — Rollout Phases

- **Phase 1 (now → ~10 clients):** self-hosted Supabase on 1 VPS, per-client stack via a
  provisioning script, manual Khalti/eSewa billing enforced by `/sm-control`, founder field
  sales + TikTok/FB. **No code refactor.**
- **Phase 2 (~10–50 clients):** add a 2nd/3rd VPS + orchestration, automate provisioning,
  automate recurring billing (Khalti/eSewa API) and self-serve trial signup, referral +
  reseller programs live.
- **Phase 3 (50+ clients, if ops pain grows):** evaluate migrating to **pooled multi-tenant**
  (add `tenant_id` + RLS, rework service-role access). Only phase needing deep code changes.

---

## Part 5 — VPS Setup Guide (self-hosted Supabase, per-client stack)

> Goal: one VPS hosting isolated Supabase stacks, one per client, each reachable at a subdomain
> (e.g. `client1.yourdomain.com`), with automated provisioning + nightly backups. Commands are
> for Ubuntu 22.04/24.04; adapt as needed.

### Step 1 — Provision the VPS
- Pick a provider: **Hetzner** (CX32, 8 GB, ~€6/mo), **DigitalOcean/Vultr**, or a **local
  Nepali cloud** (better latency/data-residency talking point for sales).
- OS: **Ubuntu 24.04 LTS**. Start at 8–16 GB RAM (holds ~5–10 early tenants).
- Point a wildcard DNS record `*.yourdomain.com` → the VPS IP (enables per-client subdomains).

### Step 2 — Harden the server (do this first, before anything is exposed)
```bash
# as root, then create a non-root sudo user and log in as them
adduser deploy && usermod -aG sudo deploy
# copy your SSH key, then in /etc/ssh/sshd_config set:
#   PasswordAuthentication no
#   PermitRootLogin no
sudo systemctl restart ssh
sudo apt update && sudo apt -y upgrade
sudo apt -y install ufw fail2ban
sudo ufw allow OpenSSH && sudo ufw allow 80 && sudo ufw allow 443 && sudo ufw enable
```

### Step 3 — Install Docker + Compose
```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker deploy   # re-login after this
docker compose version           # verify
```

### Step 4 — Reverse proxy with automatic HTTPS (Caddy)
Caddy auto-provisions Let's Encrypt certs and routes each subdomain to that client's stack.
```bash
sudo apt -y install caddy
```
`/etc/caddy/Caddyfile` — one block per client (the provisioning script appends these):
```
client1.yourdomain.com {
    reverse_proxy localhost:8001      # this client's Supabase Kong/API port
}
app-client1.yourdomain.com {
    reverse_proxy localhost:3001      # this client's Next.js app port
}
```
`sudo systemctl reload caddy` after edits.

### Step 5 — Lay down the per-client Supabase stack
```bash
git clone --depth 1 https://github.com/supabase/supabase
# template lives at supabase/docker  (docker-compose.yml + .env.example)
```
For **each client**, create an isolated copy under `/opt/tenants/client1/` containing a copy of
`supabase/docker`. Per client you MUST change, in that client's `.env`:
- **Unique host ports** (`KONG_HTTP_PORT`, Studio, etc.) so stacks don't collide — e.g.
  client1 = 8001, client2 = 8002.
- **Fresh secrets:** `POSTGRES_PASSWORD`, `JWT_SECRET`, regenerated `ANON_KEY` +
  `SERVICE_ROLE_KEY` (sign them against that client's `JWT_SECRET`), `DASHBOARD_PASSWORD`.
- `API_EXTERNAL_URL` / `SITE_URL` = `https://client1.yourdomain.com`.
- A unique Docker Compose **project name** for isolation.
```bash
cd /opt/tenants/client1/docker
docker compose -p client1 up -d
```

### Step 6 — Load the schema + seed the business
```bash
# run the existing idempotent schema file against this client's Postgres
docker compose -p client1 exec -T db psql -U postgres -d postgres < /opt/digital-manager/supabase-schema.sql
```
Then seed the singleton `business_profile` row (shop name, currency = NPR, invoice prefix),
create the owner in Supabase Auth, and set `app_subscription.expires_at` for their billing
period.

### Step 7 — Deploy the Next.js app for this client
**Option A (simplest, matches single-tenant code):** one app instance per client, built/run with
that client's env pointing at their stack:
```
NEXT_PUBLIC_SUPABASE_URL=https://client1.yourdomain.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=<client1 anon key>
SUPABASE_SERVICE_ROLE_KEY=<client1 service role key>
SUPER_ADMIN_EMAILS=...
SUPER_MANAGER_PIN=...
```
Run on a unique port (3001, 3002, …) and route via Caddy (Step 4).

**Option B (later):** one app that resolves the tenant from the subdomain → their keys (needs a
small code change; defer to Phase 2).

### Step 8 — Nightly backups (the #1 ops duty)
Cron on the VPS: `pg_dump` each tenant to compressed files + push to cheap object storage
(Backblaze B2 / S3 / local NAS). **Test a restore before relying on it.**
```bash
# /etc/cron.daily/backup-tenants  (loop over /opt/tenants/*)
docker compose -p "$T" exec -T db pg_dump -U postgres postgres | gzip > "/backups/$T-$(date +%F).sql.gz"
# then rclone/aws s3 cp to remote storage; prune backups older than N days
```

### Step 9 — Automate provisioning (the payoff)
Wrap Steps 5–7 into one script: `provision.sh <client-slug> <owner-email>` that copies the
template, allocates the next free ports, generates secrets, boots the stack, loads
`supabase-schema.sql`, seeds `business_profile`, appends Caddy blocks + reloads, and starts the
app. New-client onboarding then drops from hours to minutes.

### Step 10 — Monitoring & limits
- `docker stats` to watch RAM per tenant; set the clients-per-box ceiling from real numbers.
- Basic uptime monitor (UptimeRobot free) on each client subdomain.
- When a box nears capacity, provision the next VPS and put new clients there.

---

## Verification / Sanity checks before committing

Since this is a business plan, "verify" = validate the assumptions cheaply:
1. **Prove the infra:** spin up the self-hosted Supabase Docker stack on one test VPS, run
   `supabase-schema.sql`, point a local Next.js build at it, and confirm login + a sale +
   storefront work. Validates "zero refactor, flat cost."
2. **Measure real RAM/CPU per tenant** on that box to confirm the clients-per-VPS math above.
3. **Confirm `/sm-control` lock/unlock** end-to-end so manual billing enforcement is reliable
   before taking money.
4. **Pilot pricing on 3 shops** at the founder rate + setup fee; if they pay the setup fee,
   willingness-to-pay is validated. Adjust tiers from their reaction.
5. Confirm current Supabase self-host license terms and NCM/eSewa co-marketing eligibility.

---

## Sources
- [Supabase Pricing](https://supabase.com/pricing) · [Supabase billing docs](https://supabase.com/docs/guides/platform/billing-on-supabase)
- [Blanxer pricing](https://www.blanxer.com/pricing) · [Blanxer](https://www.blanxer.com/)
- [POS software pricing in Nepal](https://firstsource-tech.com/pricing-of-pos-software-in-nepal/) · [Best POS software Nepal](https://www.softwaresuggest.com/point-of-sale-pos-software/nepal)
