# UPGRADES — Adding Sections & Variants

> This file is the **single source of truth** for extending the site with new sections or new visual variants.
> Follow every step exactly. Do not skip steps. Do not improvise file locations or naming.
> After completing all steps, run `pnpm build` — the build must pass before the task is done.

---

## Table of Contents

1. [Add a New Section Type](#1-add-a-new-section-type)
2. [Add a New Variant to All Sections](#2-add-a-new-variant-to-all-sections)
3. [Migration SQL Templates](#3-migration-sql-templates)
4. [Variant Design System](#4-variant-design-system)
5. [Component Anatomy](#5-component-anatomy)
6. [File Reference Map](#6-file-reference-map)

---

## 1. Add a New Section Type

**Example used throughout: adding a `testimonials` section.**

Replace `testimonials`/`Testimonials` with your actual section name everywhere below.

---

### Step 1 — Define the Type

**File: `src/types/section.types.ts`**

Add to the `SectionType` union:

```ts
export type SectionType =
  | "navbar"
  | "hero"
  | "top_selling"
  | "featured"
  | "testimonials"
  | "products"
  | "support"
  | "footer"
  | "new_section";  // ← add here
```

Add the config interface at the bottom of the same file:

```ts
export interface TestimonialsConfig {
  title: string;
  subtitle: string;
  testimonials: {
    name: string;
    role: string;
    quote: string;
    avatar: string;
  }[];
}
```

**Rules for config interfaces:**
- Every field must be typed — no `any`, no `unknown`
- Arrays of objects must have their own inline type or a named interface
- The interface name is `PascalCaseSectionName` + `Config`
- These fields map 1:1 to the JSON stored in `config_json` in Supabase

---

### Step 2 — Create the Section Folder

Create the folder: `src/components/sections/testimonials/`

You need exactly 4 files:

```
src/components/sections/testimonials/
├── TestimonialsModern.tsx
├── TestimonialsAesthetic.tsx
├── TestimonialsRobotic.tsx
└── index.ts
```

---

### Step 3 — Build the 3 Variant Components

All 3 variants receive **identical props**. Only the visual design differs.

**Props interface (same in all 3 files):**

```tsx
interface TestimonialsSectionProps {
  config: TestimonialsConfig;
  className?: string;
}
```

**If the section needs product data**, add `products: Product[]` to the props — see TopSelling for reference.

**Modern variant** — `TestimonialsModern.tsx`:

```tsx
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import type { TestimonialsConfig } from "@/types/section.types";
import { cn } from "@/utils/cn";

interface TestimonialsSectionProps {
  config: TestimonialsConfig;
  className?: string;
}

export function TestimonialsModern({ config, className }: TestimonialsSectionProps) {
  return (
    <section id="testimonials" className={cn("py-16 lg:py-24", className)}>
      <Container>
        <div className="mb-12 text-center">
          <Typography variant="h2" className="mb-4">
            {config.title}
          </Typography>
          <Typography variant="bodyLarge" className="mx-auto max-w-2xl text-text-secondary">
            {config.subtitle}
          </Typography>
        </div>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {config.testimonials.map((item, index) => (
            <div
              key={index}
              className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
            >
              {/* ... card content using Typography ... */}
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
```

**Aesthetic variant** — `TestimonialsAesthetic.tsx`:
- Same props interface
- Export as `TestimonialsAesthetic`
- Follow aesthetic design rules (see Section 4)

**Robotic variant** — `TestimonialsRobotic.tsx`:
- Same props interface
- Export as `TestimonialsRobotic`
- Follow robotic design rules (see Section 4)

---

### Step 4 — Create the Variant Map

**File: `src/components/sections/testimonials/index.ts`**

```ts
import type { SectionVariant } from "@/types/section.types";
import { TestimonialsAesthetic } from "./TestimonialsAesthetic";
import { TestimonialsModern } from "./TestimonialsModern";
import { TestimonialsRobotic } from "./TestimonialsRobotic";

export const testimonialsVariants: Record<
  SectionVariant,
  typeof TestimonialsModern
> = {
  modern: TestimonialsModern,
  aesthetic: TestimonialsAesthetic,
  robotic: TestimonialsRobotic,
};
```

**Rules:**
- The Record type anchor is always `typeof <Name>Modern`
- The export name is `camelCaseName` + `Variants`
- Import order: Aesthetic, Modern, Robotic (alphabetical)

---

### Step 5 — Register in SectionRenderer

**File: `src/components/sections/section-renderer/SectionRenderer.tsx`**

Add the import at the top:

```ts
import { testimonialsVariants } from "@/components/sections/testimonials";
```

Add the import for the config type:

```ts
import type {
  // ... existing imports ...
  TestimonialsConfig,
} from "@/types/section.types";
```

Add a new case inside the switch statement:

```ts
case "testimonials": {
  const TestimonialsComponent = testimonialsVariants[variant];
  return (
    <TestimonialsComponent
      key={section.id}
      config={config as unknown as TestimonialsConfig}
    />
  );
}
```

**If the section needs products**, pass them:

```ts
case "testimonials": {
  const TestimonialsComponent = testimonialsVariants[variant];
  return (
    <TestimonialsComponent
      key={section.id}
      config={config as unknown as TestimonialsConfig}
      products={products}
    />
  );
}
```

---

### Step 6 — Insert into Supabase

Run this SQL in your Supabase SQL Editor:

```sql
INSERT INTO sections (type, name, variant, sort_order, is_enabled, config_json) VALUES
  ('testimonials', 'Testimonials', 'modern', 5, true, '{
    "title": "What Our Customers Say",
    "subtitle": "Hear from the people who use our platform every day",
    "testimonials": [
      {
        "name": "Jane Doe",
        "role": "CEO at Acme",
        "quote": "This platform transformed our online presence.",
        "avatar": ""
      },
      {
        "name": "John Smith",
        "role": "Developer",
        "quote": "The section builder is incredibly intuitive.",
        "avatar": ""
      }
    ]
  }'::JSONB);
```

**Rules:**
- `sort_order` determines position relative to other sections (navbar=0, footer=99)
- `variant` must be one of: `modern`, `aesthetic`, `robotic`
- `config_json` must match the TypeScript config interface exactly
- `is_enabled` controls visibility

---

### Step 7 — Verify

```bash
pnpm build
```

**Must pass with zero errors.** If it fails, check:
- Config interface matches the JSON structure
- All 3 variant components export the correct function name
- The index.ts maps all 3 variants
- The SectionRenderer case uses the correct variant map and config type

---

### What You Do NOT Need to Change

These files work generically and require zero modification when adding a new section:

- `src/queries/section.query.ts` — already fetches all sections
- `src/services/section.service.ts` — already maps all rows
- `src/app/(site)/page.tsx` — already passes all sections to SectionRenderer
- `src/app/(admin)/dashboard/sections/SectionManager.tsx` — already shows all sections with variant selector
- `src/app/(admin)/dashboard/sections/page.tsx` — already loads all sections

---

## 2. Add a New Variant to All Sections

**Example: adding a `retro` variant.**

This is a larger change — every section folder needs a new component.

---

### Step 1 — Update the Type

**File: `src/types/section.types.ts`**

```ts
export type SectionVariant = "modern" | "aesthetic" | "robotic" | "retro";
```

---

### Step 2 — Update the Admin UI

**File: `src/app/(admin)/dashboard/sections/SectionManager.tsx`**

```ts
const VARIANTS: SectionVariant[] = ["modern", "aesthetic", "robotic", "retro"];
```

This is the only line that changes in this file.

---

### Step 3 — Create a New Component in Every Section Folder

For **each** of these folders, create a `*Retro.tsx` file:

| Folder | New File |
|--------|----------|
| `src/components/sections/hero/` | `HeroRetro.tsx` |
| `src/components/sections/featured/` | `FeaturedRetro.tsx` |
| `src/components/sections/top-selling/` | `TopSellingRetro.tsx` |
| `src/components/sections/testimonials/` | `TestimonialsRetro.tsx` |
| `src/components/sections/products/` | `ProductsRetro.tsx` |
| `src/components/sections/support/` | `SupportRetro.tsx` |
| `src/components/organisms/navbar/` | `NavbarRetro.tsx` |
| `src/components/organisms/footer/` | `FooterRetro.tsx` |
| *(plus any other sections you've added)* | `*Retro.tsx` |

Each file:
- Uses the **same props interface** as the other variants in that folder
- Exports a function named `<SectionName>Retro`
- Follows the retro design language you define

---

### Step 4 — Update Every index.ts Variant Map

Add the new entry to every variant map. Example for hero:

**File: `src/components/sections/hero/index.ts`**

```ts
import type { SectionVariant } from "@/types/section.types";
import { HeroAesthetic } from "./HeroAesthetic";
import { HeroModern } from "./HeroModern";
import { HeroRetro } from "./HeroRetro";
import { HeroRobotic } from "./HeroRobotic";

export const heroVariants: Record<
  SectionVariant,
  typeof HeroModern
> = {
  modern: HeroModern,
  aesthetic: HeroAesthetic,
  robotic: HeroRobotic,
  retro: HeroRetro,
};
```

Repeat for every section's `index.ts`.

---

### Step 5 — Verify

```bash
pnpm build
```

If the build fails with a type error like `Property 'retro' is missing`, it means you missed updating a variant map. The `Record<SectionVariant, ...>` type enforces that every variant has a component.

---

## 3. Migration SQL Templates

### Insert a new section

```sql
INSERT INTO sections (type, name, variant, sort_order, is_enabled, config_json)
VALUES (
  'section_type',           -- must match SectionType union
  'Human Readable Name',    -- shown in admin
  'modern',                 -- default variant
  5,                        -- sort order (0=navbar, 99=footer)
  true,                     -- enabled by default
  '{
    "key": "value"
  }'::JSONB                 -- must match the Config interface
);
```

### Change a section's variant

```sql
UPDATE sections SET variant = 'aesthetic' WHERE type = 'hero';
```

### Reorder sections

```sql
UPDATE sections SET sort_order = 1 WHERE type = 'hero';
UPDATE sections SET sort_order = 2 WHERE type = 'testimonials';
UPDATE sections SET sort_order = 3 WHERE type = 'featured';
```

### Disable a section

```sql
UPDATE sections SET is_enabled = false WHERE type = 'testimonials';
```

### Update section content

```sql
UPDATE sections
SET config_json = '{
  "title": "New Title",
  "subtitle": "New subtitle text"
}'::JSONB,
updated_at = now()
WHERE type = 'hero';
```

### Full schema reset (destructive)

```sql
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS sections CASCADE;
DROP TABLE IF EXISTS theme_settings CASCADE;
-- Then run supabase-schema.sql
```

---

## 4. Variant Design System

When building variant components, follow these design rules strictly. This ensures visual consistency across all sections sharing the same variant.

### Modern

| Property | Value |
|----------|-------|
| Background | `bg-background` (white), `bg-surface` for alternating |
| Text | `text-text-primary`, `text-text-secondary` |
| Borders | `border-border`, `rounded-xl` |
| Shadows | `shadow-sm`, `hover:shadow-md` |
| Font | Default sans-serif (no `font-mono`) |
| Buttons | `<Button>` atom with default rounded-lg |
| Spacing | `py-16 lg:py-24` for sections |
| Grid | `grid-cols-1 md:grid-cols-2 lg:grid-cols-3` |

### Aesthetic

| Property | Value |
|----------|-------|
| Background | Transparent blobs with `blur-3xl`, gradients from `primary/5` to `secondary/5` |
| Text | Gradient text via `bg-gradient-to-r from-text-primary to-text-secondary bg-clip-text text-transparent` |
| Borders | `border-border/50`, `rounded-2xl` |
| Shadows | `hover:shadow-lg hover:shadow-primary/5` |
| Font | Default sans-serif, add `tracking-widest` to labels |
| Decorations | `<Caption>` tags with uppercase tracking as section labels, gradient divider lines |
| Buttons | `<Button>` with `rounded-full px-8` |
| Spacing | `py-20 lg:py-32` for sections (more generous) |
| Cards | `bg-gradient-to-b from-surface to-background`, `hover:border-primary/30` |

### Robotic

| Property | Value |
|----------|-------|
| Background | `bg-text-primary` (dark), always dark mode feel |
| Text | `text-white` for headings, `text-white/50` or `text-white/40` for body |
| Accent | `text-secondary` for highlights, `border-secondary/20` for borders (NOT `text-primary` — it's the same color as the dark bg) |
| Glow effects | `shadow-[0_0_20px_var(--color-secondary)]` on small elements |
| Font | `font-mono` on headings and labels, uppercase tracking |
| Decorations | CSS grid overlays, geometric shapes (rotated boxes), numbered items `[01]` |
| Buttons | `rounded-none border border-secondary bg-secondary/10 font-mono uppercase tracking-wider text-secondary hover:bg-secondary hover:text-white` |
| Spacing | `py-20 lg:py-28` for sections |
| Cards | `bg-text-primary` cells separated by `gap-px` with `bg-secondary/10` showing through |
| Labels | `// Comment style` prefixes in mono, e.g. `// Features`, `// Subscribe` |
| Status dots | `<span className="h-2 w-2 animate-pulse rounded-full bg-secondary" />` |
| **IMPORTANT** | Robotic uses `text-secondary`/`bg-secondary` for accents, NOT `text-primary`/`bg-primary`. Primary and text-primary are the same dark color — using `text-primary` on `bg-text-primary` is invisible. |

---

## 5. Component Anatomy

Every section variant component must follow this exact structure:

```tsx
// 1. "use client" ONLY if using hooks (useState, useEffect, etc.)
//    Omit for server components

// 2. Imports — atoms and utils only, never services or queries
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import type { TestimonialsConfig } from "@/types/section.types";
import { cn } from "@/utils/cn";

// 3. Props interface — defined in this file, not exported
interface TestimonialsSectionProps {
  config: TestimonialsConfig;
  className?: string;
  // Add products?: Product[] if the section displays products
}

// 4. Named export — PascalCase: SectionNameVariant
export function TestimonialsModern({ config, className }: TestimonialsSectionProps) {
  return (
    // 5. Root element is always <section> with optional id and cn()
    <section id="testimonials" className={cn("py-16 lg:py-24", className)}>
      {/* 6. Always wrap in <Container> for max-width and padding */}
      <Container>
        {/* 7. Section header pattern */}
        <div className="mb-12 text-center">
          <Typography variant="h2" className="mb-4">
            {config.title}
          </Typography>
          <Typography variant="bodyLarge" className="mx-auto max-w-2xl text-text-secondary">
            {config.subtitle}
          </Typography>
        </div>

        {/* 8. Content grid — responsive by default */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {config.testimonials.map((item, index) => (
            <div key={index} className="...">
              {/* 9. All text through Typography — never raw h1/p/span */}
              <Typography variant="body">
                {item.quote}
              </Typography>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
```

### Responsive Rules

Responsiveness is **built into the component structure**, not applied by the consumer:

| Element | Mobile | Tablet (md) | Desktop (lg) |
|---------|--------|-------------|--------------|
| Section padding | `py-16` | `py-16` | `py-24` |
| Grid columns | `grid-cols-1` | `grid-cols-2` | `grid-cols-3` |
| Typography | Handled by `<Typography>` internally | — | — |
| Container padding | `px-4` | `px-6` | `px-8` |
| Section header | `text-center`, `max-w-2xl` | — | — |

**Never assume the consumer will add responsive classes.** The variant component itself must be fully responsive.

### Mandatory Imports

Every variant component uses at minimum:

```tsx
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import type { YourConfig } from "@/types/section.types";
import { cn } from "@/utils/cn";
```

Optional additional imports:
- `import { Button } from "@/components/atoms/button/Button"` — for CTAs
- `import { ProductCard } from "@/components/molecules/product-card/ProductCard"` — for product display
- `import { ProductGrid } from "@/components/organisms/product-grid/ProductGrid"` — for product grids
- `import type { Product } from "@/types/product.types"` — if section displays products
- `import { formatCurrency } from "@/utils/format-currency"` — if showing prices

### What a Variant Component Must NEVER Do

- Import from `@/services/*`, `@/queries/*`, or `@supabase/*`
- Fetch data
- Use `"use server"`
- Define types that belong in `src/types/`
- **Hardcode any color** — this breaks the theme system. Use the mapping below:

| NEVER use | ALWAYS use instead |
|-----------|--------------------|
| `bg-white`, `bg-white/80` | `bg-background`, `bg-background/80` |
| `bg-gray-50`, `bg-slate-50` | `bg-surface` |
| `bg-gray-100`, `bg-slate-100` | `bg-muted` |
| `border-gray-*`, `border-slate-*` | `border-border` |
| `text-gray-500`, `text-slate-500` | `text-text-secondary` |
| `text-gray-900`, `text-slate-900` | `text-text-primary` |
| `text-blue-*`, `bg-blue-*` | `text-primary`, `bg-primary` |
| `text-purple-*`, `bg-purple-*` | `text-secondary`, `bg-secondary` |
| `text-yellow-*`, `bg-yellow-*` | `text-accent`, `bg-accent` |
| `bg-red-*` | `bg-destructive` |
| `ring-blue-*` | `ring-ring` |

The **only exception** is the `robotic` variant which uses `bg-text-primary` for dark backgrounds — this is a theme token, not a hardcoded color.

---

## 6. File Reference Map

### Files You MODIFY When Adding a New Section

| # | File | What to Change |
|---|------|---------------|
| 1 | `src/types/section.types.ts` | Add to `SectionType` union + add `Config` interface |
| 2 | `src/components/sections/<name>/TestModern.tsx` | Create (new file) |
| 3 | `src/components/sections/<name>/TestAesthetic.tsx` | Create (new file) |
| 4 | `src/components/sections/<name>/TestRobotic.tsx` | Create (new file) |
| 5 | `src/components/sections/<name>/index.ts` | Create (new file) — variant map |
| 6 | `src/components/sections/section-renderer/SectionRenderer.tsx` | Add import + case |
| 7 | Supabase SQL Editor | INSERT row |

### Files You MODIFY When Adding a New Variant

| # | File | What to Change |
|---|------|---------------|
| 1 | `src/types/section.types.ts` | Add to `SectionVariant` union |
| 2 | `src/app/(admin)/dashboard/sections/SectionManager.tsx` | Add to `VARIANTS` array |
| 3 | Every `index.ts` in every section/organism folder | Add new entry to variant map |
| 4 | Every section/organism folder | Create new `*VariantName.tsx` file |

### Files That NEVER Change for These Operations

| File | Why |
|------|-----|
| `src/queries/section.query.ts` | Generic — fetches all sections |
| `src/services/section.service.ts` | Generic — maps all rows, variant update already exists |
| `src/app/(site)/page.tsx` | Generic — passes all sections to renderer |
| `src/app/(site)/layout.tsx` | Theme injection only |
| `src/app/(admin)/dashboard/sections/page.tsx` | Generic — loads all sections |
| `src/config/*` | Design tokens, not section-specific |
| `src/lib/supabase/*` | Client setup only |
| `src/utils/*` | Utilities only |

---

## Quick Checklist (copy-paste for each task)

### New Section Checklist

```
[ ] 1. Added type to SectionType union in section.types.ts
[ ] 2. Added Config interface in section.types.ts
[ ] 3. Created src/components/sections/<name>/ folder
[ ] 4. Created <Name>Modern.tsx with responsive layout
[ ] 5. Created <Name>Aesthetic.tsx with gradient/blob design
[ ] 6. Created <Name>Robotic.tsx with dark/mono design
[ ] 7. Created index.ts with variant map export
[ ] 8. Added import + case in SectionRenderer.tsx
[ ] 9. Ran INSERT SQL in Supabase
[ ] 10. Ran pnpm build — passes with zero errors
```

### New Variant Checklist

```
[ ] 1. Added variant name to SectionVariant union in section.types.ts
[ ] 2. Added variant to VARIANTS array in SectionManager.tsx
[ ] 3. Created *<VariantName>.tsx in sections/hero/
[ ] 4. Created *<VariantName>.tsx in sections/featured/
[ ] 5. Created *<VariantName>.tsx in sections/top-selling/
[ ] 6. Created *<VariantName>.tsx in sections/testimonials/
[ ] 7. Created *<VariantName>.tsx in sections/products/
[ ] 8. Created *<VariantName>.tsx in sections/support/
[ ] 9. Created *<VariantName>.tsx in organisms/navbar/
[ ] 10. Created *<VariantName>.tsx in organisms/footer/
[ ] 11. Updated index.ts in every section/organism folder
[ ] 12. Ran pnpm build — passes with zero errors
```
