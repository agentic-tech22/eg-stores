# Production Deployment — AWS + Self-Hosted Supabase

Target: run this app in production on your own AWS account, backed by a
self-hosted Supabase stack instead of Supabase Cloud.

---

## 0. What this app actually needs

Audited from the codebase, so we only host what is used:

| Supabase service | Used? | Where |
| --- | --- | --- |
| **Postgres** | Yes | 30 tables, RLS policies, triggers — `supabase-schema.sql` |
| **Auth (GoTrue)** | Yes | `signInWithPassword`, `signOut`, `resetPasswordForEmail`, `updateUser`, `exchangeCodeForSession`, and the **Admin API** (`auth.admin.createUser/listUsers/deleteUser/getUserById`) in `src/services/user.service.ts` |
| **Storage** | Yes | 4 public buckets: `branding`, `products`, `vendor-bills`, `user-documents` (`src/services/upload.service.ts`) |
| **PostgREST** | Yes | All `src/queries/*` go through `supabase-js` |
| **Realtime** | **No** | No `.channel()` / `postgres_changes` anywhere |
| **Edge Functions** | **No** | None in repo |
| **Vector / Analytics (Logflare)** | **No** | Optional, can be trimmed |

Consequences that drive the design:

1. **`resetPasswordForEmail` is used** → you need a real SMTP sender. Use Amazon SES.
2. **Storage buckets are public and the app calls `getPublicUrl()`** → the Supabase
   host must be publicly reachable over HTTPS on a stable hostname, forever.
   Changing that hostname later breaks every stored image URL.
3. **The browser talks to Supabase directly** (`createBrowserClient` in
   `src/lib/supabase/client.ts`) → Supabase cannot live in a private subnet.
4. **Server Actions + API routes** (`"use server"`, `src/app/api/ncm/webhook/route.ts`)
   → this is **not** a static export. You need a Node server, not S3/CloudFront alone.
5. **Webhooks from NCM / eSewa / Fonepay hit your app** → you need a stable public
   IP or a load balancer, and HTTPS.
6. **No `middleware.ts` / `proxy.ts`** → nothing edge-specific to worry about.

---

## 1. Region

Use **`ap-south-1` (Mumbai)**. It is the lowest-latency AWS region to Nepal
(~40–70 ms), and SES is available there. `ap-southeast-1` (Singapore) is the
fallback if you hit capacity issues.

Keep the app and Supabase in the **same region and same AZ** — every page render
makes several round trips to Postgres, and cross-AZ latency plus data-transfer
charges add up fast.

---

## 2. Topology

### Recommended for launch ("lean")

Two EC2 instances in one public subnet, each with its own Elastic IP and Caddy
terminating TLS. No ALB, no NAT gateway.

```
                    Route 53
                       │
        ┌──────────────┴───────────────┐
        │                              │
  app.yourdomain.com          supabase.yourdomain.com
        │                              │
   ┌────▼─────┐                  ┌─────▼──────┐
   │  EC2 #1  │  ── 5432/8000 ─► │   EC2 #2   │
   │ t4g.small│   (SG-scoped)    │ t4g.large  │
   │          │                  │            │
   │ Caddy    │                  │ Caddy      │
   │ Next.js  │                  │ Kong       │
   │ (Docker) │                  │ Supabase   │
   └──────────┘                  │ (Docker)   │
                                 └─────┬──────┘
                                       │
                              EBS gp3 (pgdata + storage)
                                       │
                              S3 (nightly pg_dump + snapshots)
```

Why not one box: Postgres and Next.js competing for RAM is the single most common
cause of "the dashboard randomly hangs". Separating them costs ~$12/mo and buys you
the ability to restart the app without touching the database.

Why no ALB/NAT at launch: ALB (~$18/mo) + NAT Gateway (~$32/mo) roughly doubles your
bill for a single-tenant business app. Caddy gives you automatic Let's Encrypt certs
for free. Upgrade path is in §11.

### Sizing

| Host | Instance | Why |
| --- | --- | --- |
| Supabase | **t4g.large** (2 vCPU, 8 GB, Graviton) | Full stack idles around 3–4 GB. t4g.medium (4 GB) will OOM under load. |
| App | **t4g.small** (2 vCPU, 2 GB) | Next.js standalone server. Bump to medium if you see swap. |

Both are ARM — build your Docker images for `linux/arm64` or use `t3` (x86) instead.
Do not mix.

### Storage volumes

On the Supabase host, attach a **separate 100 GB gp3 EBS volume** mounted at
`/data`, and put both `pgdata` and Supabase Storage files on it. Never leave
Postgres on the root volume — it makes snapshot/restore and resizing painful.

---

## 3. Network / security groups

Create three security groups. Reference SGs by ID, not CIDR, wherever possible.

**`sg-app`** (EC2 #1)
- Inbound `80/tcp`, `443/tcp` from `0.0.0.0/0` — public site + payment webhooks
- Inbound `22/tcp` from **your IP only** (or drop SSH entirely and use SSM Session Manager)
- Outbound: all

**`sg-supabase`** (EC2 #2)
- Inbound `443/tcp` from `0.0.0.0/0` — browsers call the Supabase API directly
- Inbound `80/tcp` from `0.0.0.0/0` — ACME HTTP-01 challenge only
- Inbound `22/tcp` from your IP only (or SSM)
- **No inbound `5432` from anywhere.** The app talks to Postgres through
  PostgREST/Kong over HTTPS, not raw SQL. If you later need direct psql access,
  add `5432` from `sg-app` only — never from `0.0.0.0/0`.
- Outbound: all (needs to reach SES on 587)

**Do not expose Supabase Studio (port 3000/8000 admin routes) publicly.** See §7.

Prefer **SSM Session Manager** over SSH: no open port 22, no key management,
and every session is logged in CloudTrail. Attach `AmazonSSMManagedInstanceCore`
to both instance roles.

---

## 4. Bring up self-hosted Supabase (EC2 #2)

### 4.1 Base setup

```bash
# Amazon Linux 2023 or Ubuntu 24.04 LTS (arm64)
sudo dnf install -y docker git postgresql16    # AL2023
sudo systemctl enable --now docker
sudo usermod -aG docker ec2-user

# Docker Compose v2 plugin
sudo mkdir -p /usr/local/lib/docker/cli-plugins
sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-aarch64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# Mount the data volume (device name varies: check `lsblk`)
sudo mkfs -t xfs /dev/nvme1n1
sudo mkdir -p /data
echo "UUID=$(sudo blkid -s UUID -o value /dev/nvme1n1) /data xfs defaults,nofail 0 2" | sudo tee -a /etc/fstab
sudo mount -a
```

### 4.2 Pull the Supabase Docker stack

```bash
git clone --depth 1 https://github.com/supabase/supabase /opt/supabase-src
sudo mkdir -p /opt/supabase && sudo chown ec2-user:ec2-user /opt/supabase
cp -r /opt/supabase-src/docker/* /opt/supabase/
cd /opt/supabase
cp .env.example .env
```

**Pin your version.** `git clone --depth 1` gives you `main`, which moves. Once the
stack is working, record the commit SHA (`git -C /opt/supabase-src rev-parse HEAD`)
and the image tags from `docker-compose.yml` somewhere durable, so a rebuild is
reproducible. Upgrading Supabase self-hosted is a deliberate, tested operation —
not something to inherit accidentally from a `docker compose pull`.

### 4.3 Generate secrets

Every one of these must be unique and random. Never reuse the examples shipped in
`.env.example` — they are public.

```bash
# Postgres password, dashboard password
openssl rand -base64 32

# JWT_SECRET — must be at least 40 chars
openssl rand -hex 32

# SECRET_KEY_BASE (Realtime/Supavisor), VAULT_ENC_KEY (32 chars exactly)
openssl rand -hex 32
openssl rand -hex 16
```

**ANON_KEY and SERVICE_ROLE_KEY are JWTs signed with your `JWT_SECRET`.** They are
not random strings — generating them wrong is the #1 self-hosting failure. Use the
generator at <https://supabase.com/docs/guides/self-hosting/docker#generate-api-keys>,
or mint them locally:

```js
// node -e "..." with jsonwebtoken installed, or use the docs generator
{ role: "anon",         iss: "supabase", iat: <now>, exp: <now + 10 years> }
{ role: "service_role", iss: "supabase", iat: <now>, exp: <now + 10 years> }
```

Sign both with `JWT_SECRET` using HS256.

### 4.4 Configure `/opt/supabase/.env`

The values that matter for this app:

```bash
############ Secrets ############
POSTGRES_PASSWORD=<random-32>
JWT_SECRET=<random-hex-64>
ANON_KEY=<jwt signed with JWT_SECRET, role=anon>
SERVICE_ROLE_KEY=<jwt signed with JWT_SECRET, role=service_role>
DASHBOARD_USERNAME=<your-admin-user>
DASHBOARD_PASSWORD=<random-32>
SECRET_KEY_BASE=<random-hex-64>
VAULT_ENC_KEY=<random-32-chars>

############ Public URLs — these are permanent. Choose carefully. ############
SUPABASE_PUBLIC_URL=https://supabase.yourdomain.com
API_EXTERNAL_URL=https://supabase.yourdomain.com
SITE_URL=https://app.yourdomain.com

# Where GoTrue is allowed to redirect after password reset / email confirm.
# `src/app/auth/reset/route.ts` handles the code exchange, so allow that path.
ADDITIONAL_REDIRECT_URLS=https://app.yourdomain.com/auth/reset,https://app.yourdomain.com/**

############ Auth ############
# This app creates users exclusively via auth.admin.createUser (user.service.ts).
# Nobody should be able to self-register.
DISABLE_SIGNUP=true
ENABLE_EMAIL_SIGNUP=true
ENABLE_EMAIL_AUTOCONFIRM=false
ENABLE_ANONYMOUS_USERS=false
ENABLE_PHONE_SIGNUP=false
ENABLE_PHONE_AUTOCONFIRM=false

JWT_EXPIRY=3600

############ SMTP — Amazon SES (see §6) ############
SMTP_HOST=email-smtp.ap-south-1.amazonaws.com
SMTP_PORT=587
SMTP_USER=<SES SMTP username>
SMTP_PASS=<SES SMTP password>
SMTP_ADMIN_EMAIL=no-reply@yourdomain.com
SMTP_SENDER_NAME=EG Stores

############ Storage ############
FILE_SIZE_LIMIT=10485760        # 10 MB; app enforces 5 MB per file itself
STORAGE_BACKEND=file            # see §5 for the S3 option

############ Studio ############
STUDIO_DEFAULT_ORGANIZATION=YourCompany
STUDIO_DEFAULT_PROJECT=digital-manager
```

`SUPABASE_PUBLIC_URL` and `API_EXTERNAL_URL` end up baked into every
`getPublicUrl()` result stored in your database. Pick the hostname you intend to
keep for years.

### 4.5 Put the data on `/data`

Edit `docker-compose.yml` so the Postgres and Storage volumes point at the EBS
volume rather than the root disk:

```yaml
  db:
    volumes:
      - /data/pgdata:/var/lib/postgresql/data
      # ...keep the existing init-script bind mounts as-is

  storage:
    volumes:
      - /data/storage:/var/lib/storage
```

### 4.6 Trim unused services (optional, saves ~1.5 GB RAM)

This app uses no Realtime and no Edge Functions. You can remove the `realtime`
and `functions` services. Two cautions:

- Several services declare `depends_on: analytics`. If you also drop `analytics`
  (Logflare), you must remove those `depends_on` entries or the stack will not start.
- The `db` init scripts create the `_realtime` schema regardless. Leave those alone.

If you are not comfortable editing the compose file, **leave the stack intact** and
size the instance for it. A working default beats a clever trim.

### 4.7 Start it

```bash
cd /opt/supabase
docker compose pull
docker compose up -d
docker compose ps          # every service should be healthy
```

### 4.8 Load the schema

Run this **after** the stack is healthy — `supabase-schema.sql` references
`auth.users` and inserts into `storage.buckets`, both of which are created by the
Auth and Storage containers on first boot.

```bash
# copy supabase-schema.sql to the host first
psql "postgresql://postgres:<POSTGRES_PASSWORD>@localhost:5432/postgres" \
  -v ON_ERROR_STOP=1 -f supabase-schema.sql
```

Verify the four buckets exist:

```sql
SELECT id, public, file_size_limit FROM storage.buckets;
-- expect: branding, products, vendor-bills, user-documents
```

### 4.9 TLS with Caddy

```bash
# /etc/caddy/Caddyfile
supabase.yourdomain.com {
    reverse_proxy localhost:8000
}
```

Kong listens on `8000`. Caddy fetches and renews the Let's Encrypt cert
automatically. Point `supabase.yourdomain.com` at the Elastic IP in Route 53
**before** starting Caddy, or the ACME challenge fails.

---

## 5. Storage backend: EBS vs S3

**Start with `STORAGE_BACKEND=file` on the EBS volume.** It is what the shipped
compose file is tested against, and 100 GB of gp3 is plenty for product images and
vendor bills.

Switching to S3 (`STORAGE_BACKEND=s3` plus `GLOBAL_S3_BUCKET` / region / credentials)
gives you effectively unlimited, independently-durable object storage and takes
image bytes off your EBS snapshots. It is a genuine improvement, but **the exact
env var names differ between storage-api versions** — check the `storage` image's
documentation for the tag you pinned before switching, and migrate existing objects
with `aws s3 sync` from `/data/storage`.

Either way, prefer an **IAM instance role** over static access keys on the box.

---

## 6. Email: Amazon SES

Password reset is a real, user-facing flow in this app. Without working SMTP,
locked-out users cannot recover.

1. **Verify your domain** in SES (ap-south-1). Add the DKIM CNAMEs and the SPF /
   custom MAIL FROM records to Route 53.
2. **Request production access.** New SES accounts are sandboxed — you can only send
   to verified addresses. The request typically clears in under 24 hours. **Do this
   early**; it is the most common launch-day blocker.
3. Create **SMTP credentials** (SES console → SMTP settings → Create credentials).
   These are *not* your AWS access keys; SES derives a separate SMTP password.
4. Put them in `/opt/supabase/.env` as shown in §4.4 and restart the `auth` service.
5. Set up a DMARC record and an SES configuration set with bounce/complaint
   notifications to an SNS topic. Ignoring bounces gets your sending reputation
   throttled.
6. Test end to end: trigger a password reset from the live app and confirm the link
   lands on `https://app.yourdomain.com/auth/reset` and exchanges successfully.

---

## 7. Locking down Studio

Supabase Studio has no meaningful authorization model — anyone who reaches it has
full database access. The shipped Kong config protects it with HTTP basic auth
(`DASHBOARD_USERNAME` / `DASHBOARD_PASSWORD`), which is not sufficient on its own.

Pick one:

- **Best:** do not expose Studio at all. Reach it over an SSM port-forward:
  ```bash
  aws ssm start-session --target <instance-id> \
    --document-name AWS-StartPortForwardingSession \
    --parameters '{"portNumber":["8000"],"localPortNumber":["8000"]}'
  ```
  Then browse `http://localhost:8000`.
- **Acceptable:** serve it on a separate hostname in Caddy with an IP allowlist
  restricted to your office/VPN, *in addition to* basic auth.

Never leave Studio on the public internet behind basic auth alone.

---

## 8. Deploy the Next.js app (EC2 #1)

### 8.1 Enable standalone output

Add to `next.config.ts`:

```ts
const nextConfig: NextConfig = {
  output: "standalone",
  images: {
    remotePatterns: [
      // Narrow this from "**" to your actual hosts — see §10.
      { protocol: "https", hostname: "supabase.yourdomain.com" },
    ],
  },
};
```

`output: "standalone"` produces a self-contained server bundle so the runtime image
does not carry `node_modules`.

### 8.2 Dockerfile

```dockerfile
# syntax=docker/dockerfile:1
FROM node:24-alpine AS deps
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

FROM node:24-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# NEXT_PUBLIC_* are inlined into the client bundle at BUILD time, not run time.
# They must be present here or the browser client gets `undefined`.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY \
    NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_SITE_URL=$NEXT_PUBLIC_SITE_URL

RUN pnpm build

FROM node:24-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

> **The `NEXT_PUBLIC_*` build-arg trap:** these are compiled into the JavaScript
> shipped to browsers. Changing them requires a **rebuild**, not a restart. If you
> ever move Supabase to a new hostname, you must rebuild the app image.

### 8.3 Build and ship

Create an **ECR** repository and build for `linux/arm64` (matching your Graviton
instances):

```bash
aws ecr create-repository --repository-name digital-manager --region ap-south-1

docker buildx build --platform linux/arm64 \
  --build-arg NEXT_PUBLIC_SUPABASE_URL=https://supabase.yourdomain.com \
  --build-arg NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-jwt> \
  --build-arg NEXT_PUBLIC_APP_URL=https://app.yourdomain.com \
  --build-arg NEXT_PUBLIC_SITE_URL=https://app.yourdomain.com \
  -t <acct>.dkr.ecr.ap-south-1.amazonaws.com/digital-manager:$(git rev-parse --short HEAD) \
  --push .
```

Tag with the git SHA, not `latest` — you want a specific image to roll back to.

### 8.4 Run it

On EC2 #1, `docker compose` with a secrets file readable only by root:

```yaml
services:
  app:
    image: <acct>.dkr.ecr.ap-south-1.amazonaws.com/digital-manager:<sha>
    restart: always
    env_file: /etc/digital-manager/app.env    # chmod 600, root-owned
    ports: ["127.0.0.1:3000:3000"]
```

Caddyfile:

```
app.yourdomain.com {
    reverse_proxy localhost:3000
}
```

Binding the container to `127.0.0.1` means only Caddy can reach it.

### 8.5 Production environment variables

`/etc/digital-manager/app.env` — **not** committed, `chmod 600`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://supabase.yourdomain.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-jwt>
SUPABASE_SERVICE_ROLE_KEY=<service-role-jwt>     # server-only, never NEXT_PUBLIC_

SUPER_ADMIN_EMAILS=you@yourdomain.com
SUPER_MANAGER_PIN=<not 0000>

NEXT_PUBLIC_APP_URL=https://app.yourdomain.com
NEXT_PUBLIC_SITE_URL=https://app.yourdomain.com

NCM_API_BASE_URL=<production NCM base>

# eSewa — LIVE merchant credentials, not EPAYTEST
ESEWA_MERCHANT_CODE=<live>
ESEWA_SECRET_KEY=<live>
ESEWA_GATEWAY_URL=https://epay.esewa.com.np/api/epay/main/v2/form

# Fonepay — LIVE credentials and production hosts
FONEPAY_MERCHANT_CODE=<live>
FONEPAY_SECRET_KEY=<live>
FONEPAY_USERNAME=<live>
FONEPAY_PASSWORD=<live>
FONEPAY_QR_DOWNLOAD_URL=https://merchantapi.fonepay.com/api/merchant/merchantDetailsForThirdParty/thirdPartyDynamicQrDownload
FONEPAY_QR_STATUS_URL=https://merchantapi.fonepay.com/api/merchant/merchantDetailsForThirdParty/thirdPartyDynamicQrGetStatus
# FONEPAY_SIMULATE must be absent in production.
```

Consider **AWS Secrets Manager** or **SSM Parameter Store (SecureString)** instead of
a file on disk, fetched at container start via the instance role. Worth doing once
the basic deployment is stable.

---

## 9. DNS, webhooks, and callbacks

Route 53 hosted zone for `yourdomain.com`:

| Record | Type | Value |
| --- | --- | --- |
| `app` | A | Elastic IP of EC2 #1 |
| `supabase` | A | Elastic IP of EC2 #2 |
| SES DKIM ×3 | CNAME | from SES console |
| `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com` |

Then update the third parties — none of these are automatic:

- **NCM:** register the webhook as
  `https://app.yourdomain.com/api/ncm/webhook?secret=<webhook_secret>`.
  The secret lives in the `ncm_settings` table (admin Settings page), not in env.
  Generate a fresh long random secret for production.
  Sanity check: `GET https://app.yourdomain.com/api/ncm/webhook` returns
  `{"ok":true,"service":"ncm-webhook"}`.
- **eSewa:** success/failure callback URLs are derived from `NEXT_PUBLIC_SITE_URL`.
  Confirm the live merchant account is configured for your domain.
- **Fonepay:** confirm the live merchant terminal is registered.

Use **Elastic IPs**. Without one, an instance stop/start changes the public IP and
every webhook silently breaks.

---

## 10. Pre-launch security checklist

- [ ] `SUPABASE_SERVICE_ROLE_KEY` is server-side only. *(Already correct — the code
      in `src/lib/supabase/server.ts` is careful about this, including the comment
      explaining why the SSR client can't be used for service-role work. Don't
      regress it.)*
- [ ] `DISABLE_SIGNUP=true` in the Supabase `.env` — this app provisions users only
      through `auth.admin.createUser`.
- [ ] `SUPER_MANAGER_PIN` changed from `0000`.
- [ ] `FONEPAY_SIMULATE` removed; eSewa off `EPAYTEST`.
- [ ] Studio not publicly reachable (§7).
- [ ] Port 5432 not open to `0.0.0.0/0`.
- [ ] `images.remotePatterns` narrowed from `hostname: "**"`. As written, any HTTPS
      host on the internet can be proxied through your Next.js image optimizer —
      that is an open proxy and a bandwidth-cost risk. Restrict it to
      `supabase.yourdomain.com` plus any CDN you actually use.
- [ ] RLS verified on every table. The schema defines policies; confirm no table
      was left with RLS disabled:
      ```sql
      SELECT tablename FROM pg_tables
      WHERE schemaname='public' AND tablename NOT IN (
        SELECT tablename FROM pg_tables t
        JOIN pg_class c ON c.relname = t.tablename
        WHERE c.relrowsecurity
      );
      ```
- [ ] Every secret is freshly generated for production — nothing reused from `.env`
      or from `.env.local.example`.
- [ ] `.env` is gitignored *(confirmed — `.gitignore` covers `.env*`)*. Since the
      current `.env` has been on disk in development, treat those cloud keys as
      dev-only and never promote them.

---

## 11. Backups and recovery

You are now the DBA. Supabase Cloud's PITR is gone; nothing is automatic.

**Nightly logical backup** (cron on EC2 #2):

```bash
pg_dump "postgresql://postgres:<pw>@localhost:5432/postgres" -Fc \
  | aws s3 cp - s3://yourco-db-backups/pg/$(date +%F).dump
```

Give the bucket versioning, a lifecycle rule (30 daily → 12 monthly), and block
all public access.

**EBS snapshots:** use **Data Lifecycle Manager** — daily snapshot of the `/data`
volume, 7-day retention. This covers Storage files as well as Postgres.

**Storage files:** if you stayed on the `file` backend, add
`aws s3 sync /data/storage s3://yourco-storage-backups/` to the nightly job.

**Restore drill:** once, before launch, restore last night's dump into a throwaway
instance and confirm the app boots against it. A backup you have never restored is
a hypothesis, not a backup.

---

## 12. Monitoring

Minimum viable:

- **CloudWatch agent** on both hosts: memory and disk utilization (neither is
  reported by default — and memory is exactly what will kill the Supabase box).
- **Alarms:** disk > 80 %, memory > 85 %, instance status check failed.
- **Route 53 health check** on `https://app.yourdomain.com` → SNS → your email/phone.
- `docker compose logs` shipped to CloudWatch Logs via the `awslogs` log driver, so
  a crashed container's output survives the crash.
- `restart: always` on every container, and `systemctl enable docker`, so a reboot
  brings everything back.

---

## 13. Rough monthly cost (ap-south-1, on-demand)

| Item | ~USD/mo |
| --- | --- |
| t4g.large (Supabase) | 49 |
| t4g.small (app) | 12 |
| EBS: 100 GB gp3 + 2× 30 GB root | 14 |
| 2 × public IPv4 | 7 |
| EBS snapshots + S3 backups | 5 |
| Route 53 hosted zone | 1 |
| SES (10k emails) | 1 |
| Data transfer out (~100 GB) | 9 |
| **Total** | **~98** |

A 1-year Compute Savings Plan on the two instances brings it to roughly **$75/mo**.
Buy it only after you have run for a few weeks and are confident in the sizing.

---

## 14. Migrating existing data (only if you have production data today)

Your current `.env` points at a Supabase Cloud project. If that holds real data:

1. **Schema + data:**
   ```bash
   pg_dump "<cloud-connection-string>" -Fc -f prod.dump \
     --schema=public --schema=auth --schema=storage
   ```
2. **Auth users migrate cleanly** — `auth.users.encrypted_password` holds bcrypt
   hashes, which are portable. Take `auth.users` **and** `auth.identities` together.
3. **Existing sessions all invalidate** (different `JWT_SECRET`). Everyone signs in
   again once. Tell your users; do the cutover off-hours.
4. **Storage objects need two moves:** the `storage.objects` rows *and* the actual
   bytes. Download every object from the cloud project and re-upload through the
   self-hosted Storage API so metadata stays consistent.
5. **Stored public URLs contain the old hostname.** Anything in your tables holding
   a `https://<ref>.supabase.co/storage/v1/object/public/...` string must be
   rewritten to `https://supabase.yourdomain.com/...`. Find them first:
   ```sql
   SELECT table_name, column_name FROM information_schema.columns
   WHERE table_schema='public' AND data_type IN ('text','character varying');
   -- then grep those columns for '.supabase.co'
   ```
   This step is easy to forget and shows up as silently broken images days later.

---

## 15. Suggested order of operations

1. Register domain / hosted zone; request SES production access **(do this first — it has a lead time)**.
2. VPC, security groups, IAM instance roles, ECR repo.
3. Launch EC2 #2, mount `/data`, bring up Supabase, load `supabase-schema.sql`.
4. Point `supabase.yourdomain.com`, start Caddy, confirm HTTPS and bucket creation.
5. Wire SES into GoTrue; send a real password-reset email.
6. Add `output: "standalone"`, write the Dockerfile, build and push to ECR.
7. Launch EC2 #1, run the container, point `app.yourdomain.com`, start Caddy.
8. Create the first admin user via the Admin API; sign in; smoke-test uploads to
   all four buckets.
9. Swap in live eSewa/Fonepay credentials; register the NCM webhook; run one real
   low-value transaction end to end.
10. Turn on backups, DLM snapshots, CloudWatch alarms.
11. Do a restore drill.
12. Work the §10 checklist.
13. Cut over DNS / announce.
