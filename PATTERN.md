# Upsite — Project Patterns & Architecture

> A comprehensive reference for the patterns, tools, and architectural decisions used in this project.
> Use this document when setting up similar projects or onboarding new developers.

---

## Table of Contents

1. [Tech Stack](#1-tech-stack)
2. [Package Manager & Scripts](#2-package-manager--scripts)
3. [TypeScript Configuration](#3-typescript-configuration)
4. [ESLint & Prettier](#4-eslint--prettier)
5. [Tailwind CSS v4 Setup](#5-tailwind-css-v4-setup)
6. [Dynamic Theme System](#6-dynamic-theme-system)
7. [Atomic Design Component Architecture](#7-atomic-design-component-architecture)
8. [Folder Structure](#8-folder-structure)
9. [Data Flow & Layered Architecture](#9-data-flow--layered-architecture)
10. [Supabase Integration](#10-supabase-integration)
11. [Section Variant System](#11-section-variant-system)
12. [Typography System](#12-typography-system)
13. [Utility Patterns](#13-utility-patterns)
14. [Routing & Layout Strategy](#14-routing--layout-strategy)
15. [Third-Party UI (shadcn/ui)](#15-third-party-ui-shadcnui)
16. [Font Loading Strategy](#16-font-loading-strategy)
17. [Environment Variables](#17-environment-variables)

---

## 1. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.x |
| Language | TypeScript | 5.x (strict mode) |
| Styling | Tailwind CSS | 4.x |
| Database | Supabase (PostgreSQL) | — |
| Auth | Supabase Auth | — |
| UI Primitives | Radix UI | Various |
| State | React Server Components + `"use server"` actions | — |
| Package Manager | pnpm | — |

---

## 2. Package Manager & Scripts

**pnpm** is the package manager. All commands use `pnpm`.

```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint"
}
```

**Key Dependencies:**

| Category | Packages |
|----------|----------|
| UI Primitives | `@radix-ui/react-dialog`, `react-select`, `react-switch`, `react-tabs`, `react-tooltip`, `react-dropdown-menu`, `react-label`, `react-separator`, `react-slot` |
| Supabase | `@supabase/ssr`, `@supabase/supabase-js` |
| Styling Utilities | `class-variance-authority`, `clsx`, `tailwind-merge` |
| Icons | `lucide-react` |
| UX | `nprogress`, `react-hot-toast`, `react-easy-crop` |

---

## 3. TypeScript Configuration

```jsonc
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "strict": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "incremental": true,
    "isolatedModules": true,
    "paths": {
      "@/*": ["./src/*"]          // Single alias — all imports use @/
    }
  }
}
```

**Rules:**
- `strict: true` — no implicit any, strict null checks
- Single `@/*` path alias mapped to `src/*`
- Never use relative imports like `../../utils/cn`
- Never use `any` type — always define proper interfaces

---

## 4. ESLint & Prettier

### ESLint (v9 flat config)

```js
// eslint.config.mjs
import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintcompat";

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

export default [...compat.extends("next/core-web-vitals", "next/typescript")];
```

- Uses ESLint 9 flat config format
- Extends `next/core-web-vitals` and `next/typescript`

### Prettier

```json
{
  "semi": true,
  "singleQuote": false,
  "tabWidth": 2,
  "trailingComma": "all",
  "printWidth": 80,
  "plugins": ["prettier-plugin-tailwindcss"]
}
```

- **Double quotes** for strings
- **Semicolons** always
- **Trailing commas** everywhere
- **Tailwind plugin** auto-sorts class names

---

## 5. Tailwind CSS v4 Setup

Tailwind v4 is configured via PostCSS (no `tailwind.config.js`):

```js
// postcss.config.mjs
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

All theme configuration lives in `globals.css` using the `@theme inline` directive:

```css
@theme inline {
  --color-primary: var(--theme-primary);
  --color-secondary: var(--theme-secondary);
  --color-background: var(--theme-background);
  /* ... */
}
```

This replaces the traditional `tailwind.config.js` approach. Tailwind classes like `bg-primary`, `text-secondary`, `border-border` resolve through CSS custom properties.

---

## 6. Dynamic Theme System

The theme system enables runtime color/token changes from a database without rebuilding.

### Architecture

```
Supabase (theme_settings table)
    ↓
src/services/theme.service.ts        → Fetches colors + tokens, builds CSS var object
    ↓
src/app/(site)/layout.tsx            → Injects as inline style: { "--theme-primary": "#2563EB" }
    ↓
globals.css :root                    → Base values: --theme-primary: #1a1a2e
    ↓
globals.css @theme inline            → Tailwind bridge: --color-primary: var(--theme-primary)
    ↓
Components use                       → bg-primary, text-text-secondary, bg-surface, etc.
```

### CSS Variable Chain (3 layers)

```
Layer 1: --theme-* vars (source of truth, overridable from DB)
    ↓
Layer 2: --color-* vars (Tailwind reads these via @theme inline)
    ↓
Layer 3: shadcn bridge vars (--background, --foreground, --border, etc.)
```

### Theme Colors

| Token | CSS Variable | Tailwind Class | Default |
|-------|-------------|---------------|---------|
| Primary | `--theme-primary` | `bg-primary`, `text-primary` | `#1a1a2e` |
| Secondary | `--theme-secondary` | `bg-secondary`, `text-secondary` | `#c9a96e` |
| Background | `--theme-background` | `bg-background` | `#fafaf8` |
| Surface | `--theme-surface` | `bg-surface` | `#f0efe9` |
| Text Primary | `--theme-text-primary` | `text-text-primary` | `#1a1a2e` |
| Text Secondary | `--theme-text-secondary` | `text-text-secondary` | `#6b6b7b` |
| Accent | `--theme-accent` | `bg-accent`, `text-accent` | `#c9a96e` |

### Design Tokens

| Token | CSS Variable | Controls |
|-------|-------------|----------|
| Border Radius | `--radius` | Roundness of all components (`rounded-sm` through `rounded-xl`) |
| Spacing Scale | `--spacing-scale` | Layout density |
| Font Family | `--theme-font-family` | Global typeface |

### Color Palettes (8 presets)

Pre-configured palettes switchable from the admin dashboard:
Midnight Gold, Forest & Sage, Ocean Breeze, Rose Blush, Monochrome, Terracotta, Arctic Slate, Wine & Velvet.

### Rule: No Hardcoded Colors

| Never Use | Always Use |
|-----------|-----------|
| `bg-white` | `bg-background` |
| `bg-gray-50` | `bg-surface` |
| `text-gray-900` | `text-text-primary` |
| `text-gray-500` | `text-text-secondary` |
| `border-gray-200` | `border-border` |
| `text-blue-600` | `text-primary` |

---

## 7. Atomic Design Component Architecture

Components follow the Atomic Design methodology with 4 levels:

### Atoms (zero logic, pure UI primitives)

```
src/components/atoms/
├── button/Button.tsx          → Variant/size record pattern
├── container/Container.tsx    → Max-width wrapper with size options
├── image/DynamicImage.tsx     → Responsive images
├── progress-bar/              → Page transition bar
└── typography/                → Typography, Heading, Text, Label, Caption
```

### Molecules (small groups of atoms)

```
src/components/molecules/
├── feature-card/
├── image-uploader/
├── nav-item/
└── product-card/
```

### Organisms (complex, self-contained UI blocks)

```
src/components/organisms/
├── footer/          → FooterModern, FooterAesthetic, FooterRobotic
├── navbar/          → NavbarModern, NavbarAesthetic, NavbarRobotic
└── product-grid/
```

### Sections (full viewport-width page sections)

```
src/components/sections/
├── hero/            → 3 variants + index.ts
├── featured/        → 3 variants + index.ts
├── top-selling/     → 3 variants + index.ts
├── testimonials/    → 3 variants + index.ts
├── products/        → 3 variants + index.ts
├── support/         → 3 variants + index.ts
├── contact/         → 3 variants + index.ts
└── section-renderer/SectionRenderer.tsx
```

### Component Rules

1. Every component accepts `className?: string` and merges with `cn()`
2. All text uses `<Typography variant="...">` — never raw `<h1>`, `<p>`, `<span>`
3. Atoms use the **variant/size record pattern**:

```tsx
type Variant = "primary" | "secondary" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = { ... };
const sizeClasses: Record<Size, string> = { ... };

className={cn("base", variantClasses[variant], sizeClasses[size], className)}
```

4. `"use client"` only when using hooks or event handlers
5. Components never import from `services/`, `queries/`, or `@supabase/*`

---

## 8. Folder Structure

```
src/
├── app/                          # Next.js App Router
│   ├── (admin)/dashboard/        # Admin pages (protected)
│   ├── (auth)/login/             # Auth pages
│   ├── (site)/                   # Public site pages
│   ├── layout.tsx                # Root layout (fonts, metadata)
│   └── globals.css               # Theme variables, Tailwind config
│
├── components/
│   ├── atoms/                    # UI primitives (Button, Typography, Container)
│   ├── molecules/                # Atom combinations (ProductCard, NavItem)
│   ├── organisms/                # Complex blocks (Navbar, Footer, ProductGrid)
│   ├── sections/                 # Full-page sections with 3 variants each
│   └── ui/                       # shadcn/ui components (Radix-based)
│
├── config/
│   ├── design-system.ts          # Default colors, tokens, palettes, presets
│   ├── site.ts                   # Site name, description, currency presets
│   └── typography.ts             # Typography variant configs
│
├── lib/supabase/
│   ├── client.ts                 # Browser Supabase client
│   └── server.ts                 # Server Supabase client + service role client
│
├── queries/                      # Raw Supabase reads (return Row types)
│   ├── contact.query.ts
│   ├── page.query.ts
│   ├── product.query.ts
│   ├── section.query.ts
│   └── theme.query.ts
│
├── services/                     # "use server" — business logic + CRUD
│   ├── auth.service.ts
│   ├── contact.service.ts
│   ├── page.service.ts
│   ├── product.service.ts
│   ├── section.service.ts
│   ├── theme.service.ts
│   └── upload.service.ts
│
├── types/                        # TypeScript interfaces (Row + Domain types)
│   ├── contact.types.ts
│   ├── page.types.ts
│   ├── product.types.ts
│   ├── section.types.ts
│   ├── site.types.ts
│   ├── theme.types.ts
│   └── typography.types.ts
│
└── utils/                        # Pure utility functions
    ├── cn.ts                     # clsx + tailwind-merge
    ├── crop-image.ts
    ├── format-currency.ts
    ├── image-loader.ts
    ├── logo-classes.ts
    └── slugify.ts
```

### Naming Conventions

| What | Convention | Example |
|------|-----------|---------|
| Component files | PascalCase | `ProductCard.tsx` |
| Component folders | kebab-case | `product-card/` |
| Service files | kebab-case + `.service.ts` | `product.service.ts` |
| Query files | kebab-case + `.query.ts` | `product.query.ts` |
| Type files | kebab-case + `.types.ts` | `product.types.ts` |
| Utility files | kebab-case | `format-currency.ts` |

---

## 9. Data Flow & Layered Architecture

Strict separation of concerns with 4 layers:

```
Supabase DB
    ↓
queries/*.query.ts       ← Raw reads. Return Row types (snake_case). No logic.
    ↓
services/*.service.ts    ← "use server". Maps Row → Domain (camelCase). All logic.
    ↓
app/**/page.tsx          ← Server Components. Call services. Pass data as props.
    ↓
components/              ← Pure UI. ZERO data fetching. ZERO Supabase imports.
```

### Dual Type Pattern (every Supabase table)

```ts
// Row type — matches Supabase columns exactly (snake_case)
interface ProductRow {
  id: string;
  title: string;
  is_featured: boolean;
  created_at: string;
}

// Domain type — used in the app (camelCase)
interface Product {
  id: string;
  title: string;
  isFeatured: boolean;
  createdAt: string;
}
```

### Mapping Function (in service files)

```ts
function mapProductRow(row: ProductRow): Product {
  return {
    id: row.id,
    title: row.title,
    isFeatured: row.is_featured,
    createdAt: row.created_at,
  };
}
```

### Server Action Pattern

```ts
"use server";

// 1. Private mapper
function mapSomeRow(row: SomeRow): Some { ... }

// 2. Read operations
export async function fetchSomething(): Promise<Some[]> {
  const rows = await getSomeData();
  return rows.map(mapSomeRow);
}

// 3. Write operations — always return { success, error? }
export async function createSomething(data: { ... }): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from("table").insert({ ... });
    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, error: message };
  }
}
```

---

## 10. Supabase Integration

### Client Setup

Two Supabase clients in `src/lib/supabase/`:

| Client | File | Key Used | Purpose |
|--------|------|----------|---------|
| Browser | `client.ts` | `ANON_KEY` | Client-side queries |
| Server (normal) | `server.ts` → `createServerSupabaseClient()` | `ANON_KEY` | Server Components, respects RLS |
| Server (admin) | `server.ts` → `createServiceRoleClient()` | `SERVICE_ROLE_KEY` | Bypasses RLS for admin ops |

### Database Schema

Single source of truth: `supabase-schema.sql` (idempotent, re-runnable via DROP).

**Tables:**
- `theme_settings` — Single row: colors, tokens, branding, site info
- `sections` — Dynamic page sections with variant + config_json
- `products` — Product catalog
- `pages` — Static content pages (About, Privacy, Terms)
- `contact_submissions` — Contact form entries

**RLS Pattern:**
- Public tables: `anon` can SELECT, `authenticated` can INSERT/UPDATE/DELETE
- Contact submissions: `anon` can INSERT, `authenticated` can SELECT/DELETE

### No Multi-Tenancy

This is a **single-site** app. No `site_id` columns. All data is global.

---

## 11. Section Variant System

Every content section has **3 visual variants** that can be switched from the admin dashboard:

### Variant Map Pattern

```ts
// src/components/sections/hero/index.ts
export const heroVariants: Record<SectionVariant, typeof HeroModern> = {
  modern: HeroModern,
  aesthetic: HeroAesthetic,
  robotic: HeroRobotic,
};
```

### SectionRenderer (dynamic dispatch)

```ts
// SectionRenderer.tsx — switches on section.type
case "hero": {
  const HeroComponent = heroVariants[variant];
  return <HeroComponent key={section.id} config={config as unknown as HeroConfig} />;
}
```

### Variant Design Rules

| Property | Modern | Aesthetic | Robotic |
|----------|--------|-----------|---------|
| Background | `bg-background` (white) | Gradient blobs, `blur-3xl` | `bg-text-primary` (dark) |
| Text | `text-text-primary` | Gradient text via `bg-clip-text` | `text-white`, `font-mono` |
| Borders | `border-border`, `rounded-xl` | `border-border/50`, `rounded-2xl` | `border-secondary/20`, sharp |
| Shadows | `shadow-sm` | `shadow-primary/5` | Glow: `shadow-[0_0_20px_var(--color-secondary)]` |
| Buttons | Rounded-lg default | `rounded-full px-8` | `rounded-none font-mono uppercase` |
| Accents | Theme primary | Gradients | `text-secondary` (NOT `text-primary`) |

---

## 12. Typography System

### Configuration-Driven

Typography variants are defined in `src/config/typography.ts` and consumed by `<Typography>`:

```tsx
<Typography variant="h1">Title</Typography>
<Typography variant="body" className="text-text-secondary">Description</Typography>
```

### Available Variants

`display`, `h1`, `h2`, `h3`, `h4`, `bodyLarge`, `body`, `bodySmall`, `caption`, `label`

### Convenience Wrappers

```tsx
<Heading level={2}>Section Title</Heading>
<Text size="large">Body content</Text>
<Label>Form label</Label>
<Caption>Small annotation</Caption>
```

Responsive sizing is handled internally — never manually write `text-3xl md:text-4xl`.

---

## 13. Utility Patterns

### `cn()` — Class Merging

Every component uses `cn()` from `@/utils/cn`:

```ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

Combines conditional class joining (`clsx`) with Tailwind conflict resolution (`tailwind-merge`).

### Other Utilities

| Utility | Purpose |
|---------|---------|
| `format-currency.ts` | Format prices with locale-aware currency |
| `crop-image.ts` | Client-side image cropping |
| `image-loader.ts` | Next.js image loader |
| `logo-classes.ts` | Logo sizing based on orientation |
| `slugify.ts` | URL-safe slug generation |

---

## 14. Routing & Layout Strategy

### Route Groups (Next.js App Router)

```
src/app/
├── (site)/           # Public-facing pages — theme CSS vars injected via layout
│   ├── layout.tsx    # Fetches theme from DB, injects as inline CSS variables
│   ├── page.tsx      # Homepage — parallel data fetching, SectionRenderer
│   ├── landing/      # Marketing landing page
│   ├── products/     # Product listing + detail pages
│   └── [slug]/       # Dynamic static pages (About, Privacy, Terms)
│
├── (admin)/
│   └── dashboard/    # Admin panel — sections, products, theme, branding, settings, contacts, pages
│
├── (auth)/
│   └── login/        # Login page with form
│
├── layout.tsx        # Root — fonts, metadata, toast, progress bar
└── globals.css       # Theme variables + Tailwind v4 config
```

### Theme Injection Flow

```tsx
// src/app/(site)/layout.tsx
export default async function SiteLayout({ children }) {
  let cssVars = {};
  try {
    cssVars = await buildThemeCssVariables();
  } catch {
    // Falls back to CSS defaults
  }
  return <div style={cssVars}>{children}</div>;
}
```

### Homepage Data Fetching

```tsx
// src/app/(site)/page.tsx — parallel fetch
const [sections, featuredProducts, allProducts, branding, settings] =
  await Promise.all([
    fetchSections(),
    fetchFeaturedProducts(),
    fetchAllProducts(),
    fetchBranding(),
    fetchSiteSettings(),
  ]);
```

---

## 15. Third-Party UI (shadcn/ui)

shadcn components live in `src/components/ui/` — separate from the Atomic Design hierarchy.

### Available Components

| Component | Radix Primitive | Client Component |
|-----------|----------------|-----------------|
| Input | — | No |
| Textarea | — | No |
| UILabel | `@radix-ui/react-label` | Yes |
| Badge | — | No |
| Card | — | No |
| Separator | `@radix-ui/react-separator` | Yes |
| Switch | `@radix-ui/react-switch` | Yes |
| Dialog | `@radix-ui/react-dialog` | Yes |
| Select | `@radix-ui/react-select` | Yes |
| Tabs | `@radix-ui/react-tabs` | Yes |
| DropdownMenu | `@radix-ui/react-dropdown-menu` | Yes |
| Tooltip | `@radix-ui/react-tooltip` | Yes |

### Theme Bridge

shadcn components are bridged to the project theme system in `globals.css`:

```css
/* shadcn reads these, which map to our --theme-* vars */
--color-foreground: var(--theme-text-primary);
--color-card: var(--theme-background);
--color-muted: var(--theme-surface);
--color-muted-foreground: var(--theme-text-secondary);
```

### Rules

- All `ui/` components use `cn()` from `@/utils/cn` (not `@/lib/utils`)
- All colors remapped to theme tokens before adding
- `ui/` components supplement atoms — they do not replace `<Button>`, `<Typography>`, or `<Container>`

---

## 16. Font Loading Strategy

Four Google Fonts loaded in the root layout with CSS variable binding:

```tsx
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const poppins = Poppins({ subsets: ["latin"], variable: "--font-poppins", weight: [...], display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], variable: "--font-playfair", display: "swap" });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });
```

The active font is controlled by `--theme-font-family` from the database. The service maps font names to CSS variables:

```ts
const fontMap: Record<string, string> = {
  Inter: "var(--font-inter)",
  Poppins: "var(--font-poppins)",
  "Playfair Display": "var(--font-playfair)",
  "JetBrains Mono": "var(--font-jetbrains)",
  "system-ui": "system-ui",
};
```

`globals.css` dynamically assigns `--font-sans` based on the value of `--theme-font-family`.

---

## 17. Environment Variables

| Variable | Required | Public | Purpose |
|----------|----------|--------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Yes | Supabase anonymous key (RLS-protected) |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | No | Supabase admin key (bypasses RLS) |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Yes | Deployed URL for OG images & metadata |

**Note:** `NEXT_PUBLIC_` prefixed variables are exposed to the browser. The service role key is server-only.

---

## Summary

This project follows a **convention-over-configuration** approach where:

1. **Types define the contract** — Every DB table has Row + Domain types
2. **Queries are dumb** — Raw reads, no logic
3. **Services own the logic** — Mapping, validation, CRUD via server actions
4. **Components are pure** — Accept props, render UI, zero data fetching
5. **Theme is dynamic** — CSS variables flow from DB → layout → Tailwind → components
6. **Variants are pluggable** — Record-based dispatch selects visual styles at runtime
7. **Everything is typed** — No `any`, strict mode, explicit interfaces
