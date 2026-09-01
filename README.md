# Up Site — Dynamic Website Builder Boilerplate

A production-ready, white-label website builder boilerplate. Clone it, run the Supabase migration, customize for your client, and deliver a fully functional site with an admin dashboard — in hours, not weeks.

Built with **Next.js 16 (App Router)**, **Supabase**, **TailwindCSS v4**, and **TypeScript**.

---

## How It Works

This is a **boilerplate** designed to be cloned per client project:

```
1. Clone this repo → new-client-site/
2. Create a Supabase project
3. Run supabase-schema.sql (creates tables + seed data)
4. Set .env.local with Supabase keys
5. Customize content from the admin dashboard
6. Deploy to Vercel
7. Hand off dashboard credentials to client
```

Every client gets the same codebase with their own Supabase project, their own content, their own theme — zero code changes needed for most customizations.

---

## Features

### Public Site
- **9 section types** — Navbar, Hero, Featured Products, Features, Product Collection, Testimonials, Support/Community, Contact Form, Footer
- **3 design variants per section** — Modern (clean/corporate), Aesthetic (editorial/luxury), Robotic (dark/terminal)
- **Global variant switching** — one click changes the entire site's visual style
- **Dynamic theming** — 8 curated color palettes + custom colors, all controllable from dashboard
- **Design tokens** — border radius, spacing scale, font family (Inter, Poppins, Playfair, JetBrains Mono)
- **Dynamic pages** — About, Privacy, Terms + custom pages with block editor
- **Products catalog** — `/products` page with search filter, variant-aware card designs
- **Contact form** — submissions stored in Supabase, viewable from admin
- **Responsive** — mobile-first, works on all devices
- **NProgress bar** — page transition indicator
- **Error/404 pages** — themed, matching site palette

### Admin Dashboard (`/dashboard`)
- **Dark sidebar navigation** with 9 sections
- **Section Manager** — reorder, enable/disable, edit content, switch variants globally
- **Section Gallery** — add new sections with visual preview cards
- **Inline content editors** — edit every text, link, feature card, testimonial from the dashboard
- **Product Manager** — CRUD with image upload (crop + zoom)
- **Theme Editor** — curated palette selector with live mini-site preview + design tokens
- **Branding** — logo upload with orientation selector (horizontal/square/vertical)
- **Page Manager** — create/edit/delete pages with heading/paragraph/divider blocks
- **Contact Submissions** — view messages with name, phone, WhatsApp link, call link
- **Settings** — currency selector (12 currencies), WhatsApp number
- **Link href dropdowns** — navbar/footer links auto-populate from existing sections + pages

### Architecture
- **Atomic Design** — atoms, molecules, organisms, sections
- **Server Components** — data fetching in RSC, zero client-side DB calls
- **Server Actions** — all mutations via `"use server"` functions
- **Service Role Client** — admin writes bypass RLS via service role key
- **Theme CSS Variables** — `--theme-*` → `@theme inline` → Tailwind classes
- **Admin-independent styling** — dashboard has its own color system, unaffected by site theme

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript (strict mode) |
| Styling | TailwindCSS v4 |
| Database | Supabase (PostgreSQL + RLS) |
| Storage | Supabase Storage (branding, products, avatars) |
| Image Cropping | react-easy-crop |
| Progress Bar | nprogress |
| UI Primitives | Radix UI (dialog, select, tabs, etc.) |
| Fonts | Google Fonts (Inter, Poppins, Playfair Display, JetBrains Mono) |

---

## Quick Start

### 1. Clone & Install

```bash
git clone <repo-url> client-site
cd client-site
pnpm install
```

### 2. Supabase Setup

1. Create a new Supabase project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the entire contents of `supabase-schema.sql`
3. Go to **Storage** and create two **public** buckets:
   - `branding` (for logos and avatars)
   - `products` (for product images)

### 3. Environment Variables

Copy `.env.local.example` to `.env.local`:

```bash
cp .env.local.example .env.local
```

Fill in:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 4. Run

```bash
pnpm dev
```

- Public site: [http://localhost:3000](http://localhost:3000)
- Admin dashboard: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

### 5. Deploy

```bash
pnpm build
```

Deploy to Vercel, Netlify, or any Node.js host. Set the same env vars in production.

---

## Project Structure

```
src/
├── app/
│   ├── (site)/              # Public site routes
│   │   ├── page.tsx          # Homepage (dynamic sections)
│   │   ├── [slug]/           # Dynamic pages (about, privacy, etc.)
│   │   └── products/         # Full product catalog with search
│   ├── (admin)/              # Admin dashboard
│   │   └── dashboard/
│   │       ├── sections/     # Section manager + editors
│   │       ├── products/     # Product CRUD
│   │       ├── theme/        # Color palettes + design tokens
│   │       ├── branding/     # Logo upload
│   │       ├── pages/        # Static page editor
│   │       ├── contacts/     # Contact form submissions
│   │       └── settings/     # Currency, WhatsApp
│   ├── layout.tsx            # Root layout (fonts, progress bar)
│   ├── not-found.tsx         # 404 page (themed)
│   ├── error.tsx             # Error page (themed)
│   └── globals.css           # Theme variables + admin tokens
├── components/
│   ├── atoms/                # Button, Container, Typography, etc.
│   ├── molecules/            # NavItem, ProductCard, ImageUploader, etc.
│   ├── organisms/            # Navbar (3 variants), Footer (3 variants)
│   ├── sections/             # All section types (3 variants each)
│   │   ├── hero/
│   │   ├── featured/
│   │   ├── top-selling/
│   │   ├── products/
│   │   ├── testimonials/
│   │   ├── support/
│   │   ├── contact/
│   │   └── section-renderer/ # Maps type+variant → component
│   └── ui/                   # shadcn/ui components (themed)
├── config/                   # Design system, typography, site config
├── lib/supabase/             # Client + server Supabase setup
├── queries/                  # Raw Supabase reads (Row types)
├── services/                 # Server actions (domain types)
├── types/                    # TypeScript interfaces
└── utils/                    # cn, formatCurrency, slugify, etc.
```

---

## Section Types

| Type | Purpose | Editable Fields |
|------|---------|----------------|
| `navbar` | Site navigation | Site name, links (with section dropdown), CTA text |
| `hero` | Landing banner | Headline, subtitle, CTA text/link, background image |
| `top_selling` | Featured products showcase | Title, subtitle, product limit |
| `featured` | Feature cards grid | Title, subtitle, feature cards (icon, title, description) |
| `products` | Full product collection | Title, subtitle, limit, "Explore All" button text |
| `testimonials` | Customer quotes | Title, subtitle, testimonials (quote, name, role, avatar) |
| `support` | Community/support CTA | Label, title, subtitle, CTA, image, stats |
| `contact` | Contact form | Title, subtitle, phone, address, button text |
| `footer` | Site footer | Site name, description, link groups |

Each section has **3 visual variants**: Modern, Aesthetic, Robotic. The admin selects one global variant that applies to all sections consistently.

---

## Database Schema

5 tables, all with RLS enabled:

| Table | Purpose | Public Access | Admin Access |
|-------|---------|--------------|-------------|
| `theme_settings` | Colors, tokens, branding, currency | SELECT | ALL |
| `sections` | Section config + ordering | SELECT | ALL |
| `products` | Product catalog | SELECT | ALL |
| `pages` | Static content pages | SELECT | ALL |
| `contact_submissions` | Contact form entries | INSERT | SELECT, DELETE |

Schema is defined in `supabase-schema.sql` — a single idempotent file that can be run on any fresh database.

---

## Supabase Storage Buckets

| Bucket | Access | Contents |
|--------|--------|----------|
| `branding` | Public | Site logo, testimonial avatars |
| `products` | Public | Product images, hero images |

---

## Documentation Files

| File | Purpose |
|------|---------|
| `RULES.md` | Development rules — architecture, naming, component patterns, forbidden actions |
| `UPGRADES.md` | Step-by-step guide for adding new sections and variants |
| `DESIGN-PROMPT.md` | Copy-paste prompt for AI design tools (v0, Bolt, etc.) with full design system |
| `supabase-schema.sql` | Complete database schema — single source of truth |

---

## Client Handoff Checklist

When delivering to a client:

- [ ] Clone repo, create new Supabase project
- [ ] Run `supabase-schema.sql`
- [ ] Create `branding` and `products` storage buckets (public)
- [ ] Set `.env.local` with client's Supabase keys
- [ ] Upload client's logo via `/dashboard/branding`
- [ ] Select color palette via `/dashboard/theme`
- [ ] Edit section content via `/dashboard/sections`
- [ ] Add products via `/dashboard/products`
- [ ] Set currency via `/dashboard/settings`
- [ ] Edit About/Privacy/Terms pages via `/dashboard/pages`
- [ ] Deploy to Vercel
- [ ] Share `/dashboard` URL with client

---

## License

Private boilerplate. Not for redistribution.
