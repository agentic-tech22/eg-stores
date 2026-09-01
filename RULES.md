# Up Site — Development Rules

> Read this file completely before writing or modifying code.
> Every rule is grounded in patterns that already exist in this codebase.
> Violating a rule means stopping, refactoring, then continuing.

---

## 1. Pre-Implementation Checklist

Before writing a single line, answer these five questions:

1. **Which architectural layer does this change touch?**
   `types/` → `queries/` → `services/` → `components/` → `app/`
2. **Does a similar pattern already exist?** Search the codebase first.
3. **Which Atomic Design level is the component?** atom / molecule / organism / section
4. **Does this need a new Supabase table, column, or query?**
5. **Does the SectionRenderer need updating?**

Do not start coding until all five are answered.

---

## 2. File & Folder Conventions

### Naming

| What | Convention | Example |
|------|-----------|---------|
| Component files | PascalCase | `ProductCard.tsx` |
| Component folders | kebab-case | `product-card/` |
| Service files | kebab-case, `.service.ts` | `product.service.ts` |
| Query files | kebab-case, `.query.ts` | `product.query.ts` |
| Type files | kebab-case, `.types.ts` | `product.types.ts` |
| Utility files | kebab-case | `format-currency.ts` |
| Config files | kebab-case | `design-system.ts` |

### Placement

| File type | Location |
|-----------|----------|
| Atoms (zero logic) | `src/components/atoms/<name>/` |
| Molecules (atom combos) | `src/components/molecules/<name>/` |
| Organisms (molecule combos) | `src/components/organisms/<name>/` |
| Full-page sections | `src/components/sections/<name>/` |
| Server actions & business logic | `src/services/` |
| Raw Supabase reads | `src/queries/` |
| TypeScript interfaces | `src/types/` |
| Reusable helpers | `src/utils/` |
| Design tokens & constants | `src/config/` |
| Supabase client setup | `src/lib/supabase/` |
| Public site pages | `src/app/(site)/` |
| shadcn/ui components | `src/components/ui/` |
| Admin pages | `src/app/(admin)/dashboard/` |

Never put a component in the wrong atomic level. If unsure:
- Can it exist alone as a UI primitive? → **atom**
- Is it a small group of atoms? → **molecule**
- Is it a complex, self-contained UI block? → **organism**
- Is it a full viewport-width page section with Container? → **section**

---

## 3. Type System Rules

### Dual Type Pattern (mandatory for every Supabase table)

Every table needs two interfaces in `src/types/`:

```ts
// Row type — matches Supabase snake_case columns exactly
interface ProductRow {
  id: string;
  title: string;
  is_featured: boolean;
  created_at: string;
}

// Domain type — camelCase, used everywhere in the app
interface Product {
  id: string;
  title: string;
  isFeatured: boolean;
  createdAt: string;
}
```

### Mapping Function (mandatory in the service file)

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

### Rules

- **Never use `any`.** No exceptions.
- Row types use `snake_case` fields. Domain types use `camelCase` fields.
- Mapping functions live in the corresponding service file, not in queries or components.
- Section config types (e.g., `HeroConfig`, `FeaturedConfig`) are defined in `src/types/section.types.ts`.
- Component props are defined as interfaces in the same component file, not exported to `types/`.

---

## 4. Data Flow (strict layering)

```
Supabase DB
    ↓
src/queries/*.query.ts       ← Raw reads. Return Row types. No business logic.
    ↓
src/services/*.service.ts    ← "use server". Maps Row → Domain. Contains all logic.
    ↓
src/app/**/page.tsx          ← Server Components call services. Pass data as props.
    ↓
src/components/              ← Pure UI. ZERO data fetching. ZERO Supabase imports.
```

### What goes where

| Layer | Does | Does NOT |
|-------|------|----------|
| `queries/` | Supabase `.select()`, `.eq()`, `.order()` | Transform data, contain logic, use `"use server"` |
| `services/` | Map rows, validate, CRUD via server actions | Render UI, import React |
| `components/` | Render UI, accept props, use `cn()` | Import from `queries/`, `services/`, or `@supabase/*` |
| `app/` pages | Call services, compose components | Contain inline business logic |

### Server Action Pattern

Every service file starts with `"use server"` and follows this structure:

```ts
"use server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getSomeData } from "@/queries/some.query";
import type { SomeRow, Some } from "@/types/some.types";

// 1. Private mapper
function mapSomeRow(row: SomeRow): Some { ... }

// 2. Read operations
export async function fetchSomething(): Promise<Some[]> {
  const rows = await getSomeData();
  return rows.map(mapSomeRow);
}

// 3. Write operations — always return { success, error? }
export async function createSomething(
  data: { ... },
): Promise<{ success: boolean; error?: string }> {
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

### Client Components Calling Server Actions

```ts
"use client";

import { useTransition } from "react";
import { createSomething } from "@/services/some.service";

// Inside the component:
const [isPending, startTransition] = useTransition();

function handleSubmit() {
  startTransition(async () => {
    const result = await createSomething(data);
    if (result.success) {
      window.location.reload();
    }
  });
}
```

---

## 5. Component Rules

### All Text Through Typography

Never write raw `<h1>`, `<p>`, `<span>` with text. Always use:

```tsx
<Typography variant="h1">Title</Typography>
<Typography variant="body" className="text-text-secondary">Description</Typography>
```

Available variants: `display`, `h1`, `h2`, `h3`, `h4`, `bodyLarge`, `body`, `bodySmall`, `caption`, `label`

Convenience wrappers: `<Heading level={2}>`, `<Text size="large">`, `<Label>`, `<Caption>`

Responsive sizing is handled inside Typography. Never manually write `text-3xl md:text-4xl`.

### Class Merging with `cn()`

Every component that accepts `className` must merge it using `cn()`:

```tsx
import { cn } from "@/utils/cn";

export function MyComponent({ className }: { className?: string }) {
  return <div className={cn("base-classes", className)} />;
}
```

### Variant/Size Record Pattern (for atoms)

```tsx
type Variant = "primary" | "secondary";
type Size = "sm" | "md" | "lg";

const variantClasses: Record<Variant, string> = { ... };
const sizeClasses: Record<Size, string> = { ... };

// In JSX:
className={cn("base", variantClasses[variant], sizeClasses[size], className)}
```

### No Hardcoded Colors (mandatory)

Every color in every component must use **theme tokens**, never raw Tailwind colors. Hardcoded colors bypass the theme system and will not respond to admin theme changes.

| Hardcoded (NEVER use) | Theme Token (ALWAYS use) |
|-----------------------|--------------------------|
| `bg-white` | `bg-background` |
| `bg-white/80` | `bg-background/80` |
| `bg-gray-50`, `bg-slate-50` | `bg-surface` |
| `bg-gray-100`, `bg-slate-100` | `bg-muted` |
| `border-gray-100`, `border-gray-200`, `border-gray-300` | `border-border` |
| `text-gray-500`, `text-slate-500` | `text-text-secondary` |
| `text-gray-900`, `text-slate-900` | `text-text-primary` |
| `text-blue-600` | `text-primary` |
| `text-purple-600` | `text-secondary` |
| `text-yellow-500` | `text-accent` |
| `bg-blue-600` | `bg-primary` |
| `bg-red-500` | `bg-destructive` |
| `ring-blue-500` | `ring-ring` |

**Exception:** The `robotic` variant uses `bg-text-primary` for dark backgrounds — this is allowed because it references a theme token (it inverts the text color as a background).

### "use client" Directive

Only add `"use client"` when the component uses:
- `useState`, `useEffect`, `useTransition`, or other React hooks
- Browser-only APIs
- Event handlers like `onClick`, `onChange`, `onSubmit`

If a component only receives props and renders JSX → it is a Server Component. Do not add `"use client"`.

---

## 6. Theme System

### How It Works

```
config/design-system.ts      → Default hex values + --theme-* CSS variable mapping
        ↓
services/theme.service.ts    → Fetches from Supabase, falls back to defaults
        ↓
app/(site)/layout.tsx        → Injects as inline style: { "--theme-primary": "#2563EB" }
        ↓
globals.css :root            → --theme-primary: #2563eb (base values)
globals.css @theme inline    → --color-primary: var(--theme-primary) (Tailwind tokens)
        ↓
Components use:              → bg-primary, text-text-secondary, bg-surface, etc.
```

**Important:** `:root` uses `--theme-*` prefix. `@theme inline` uses `--color-*` prefix.
Tailwind classes like `bg-primary` resolve to `--color-primary` which reads from `--theme-primary`.
Supabase overrides inject `--theme-*` values via inline style, which flow through automatically.

### Two Theme Categories

The theme system has two categories, both stored in the `theme_settings` table:

| Category | Interface | Config Map | Service Function | Editor Tab |
|----------|-----------|-----------|-----------------|------------|
| Colors | `ThemeColors` | `themeColorToCssVar` | `updateThemeColors()` | "Colors" |
| Design Tokens | `ThemeTokens` | `themeTokenToCssVar` | `updateThemeTokens()` | "Design Tokens" |

### Design Tokens

Design tokens control structural properties — not colors. They are managed from the "Design Tokens" tab in the Theme Editor.

| Token | CSS Variable | Controls | Presets in `design-system.ts` |
|-------|-------------|----------|-------------------------------|
| `borderRadius` | `--radius` | Roundness of buttons, cards, inputs, badges | `borderRadiusPresets` (None → Full) |
| `spacingScale` | `--spacing-scale` | Layout density — padding, margins, gaps | `spacingScalePresets` (Compact → Spacious) |
| `fontFamily` | `--theme-font-family` | Typeface across the entire site | `fontFamilyPresets` (Inter, System, Serif, Mono) |

### No Hardcoded Border Radius

Every component must use Tailwind's radius tokens (`rounded-md`, `rounded-lg`, `rounded-xl`) which resolve through `--radius`. Never hardcode pixel values.

| Hardcoded (NEVER use) | Token (ALWAYS use) |
|-----------------------|--------------------|
| `rounded-[4px]` | `rounded-sm` |
| `rounded-[6px]` | `rounded-md` |
| `rounded-[8px]` | `rounded-lg` |
| `rounded-[12px]` | `rounded-xl` |

**Exception:** `rounded-full` for circular elements (avatars, icon backgrounds) is always valid — it's not affected by the radius token.

### Adding a New Color

1. Add the field to `ThemeColors` in `src/types/theme.types.ts`
2. Add the column to `ThemeSettingsRow` in `src/types/theme.types.ts`
3. Add default value in `defaultThemeColors` in `src/config/design-system.ts`
4. Add CSS var mapping in `themeColorToCssVar` in `src/config/design-system.ts`
5. Add the `--theme-*` variable to `:root` in `src/app/globals.css`
6. Add the `--color-*` mapping in `@theme inline` in `src/app/globals.css`
7. Add the column to the Supabase `theme_settings` table
8. Update `mapRowToColors` in `src/services/theme.service.ts`
9. Add the field to `colorFields` array in `ThemeEditor.tsx`

### Adding a New Design Token

1. Add the field to `ThemeTokens` in `src/types/theme.types.ts`
2. Add the column to `ThemeSettingsRow` in `src/types/theme.types.ts`
3. Add default value in `defaultThemeTokens` in `src/config/design-system.ts`
4. Add CSS var mapping in `themeTokenToCssVar` in `src/config/design-system.ts`
5. Add a presets array in `src/config/design-system.ts` (e.g., `myTokenPresets`)
6. Add the CSS variable to `:root` in `src/app/globals.css`
7. Wire it in `@theme inline` if Tailwind needs to reference it
8. Add the column to the Supabase `theme_settings` table
9. Update `mapRowToTokens` in `src/services/theme.service.ts`
10. Update `updateThemeTokens` in `src/services/theme.service.ts`
11. Add the UI control in the "Design Tokens" tab of `ThemeEditor.tsx`

---

## 7. Section Variant System

Every section has **3 visual variants**: `modern`, `aesthetic`, `robotic`.

The `variant` column in the `sections` table controls which variant renders. Admins switch variants from the Section Manager dashboard.

### How It Works

```
sections table (variant: "modern" | "aesthetic" | "robotic")
    ↓
SectionRenderer reads section.variant
    ↓
Looks up variant map: heroVariants["modern"] → HeroModern component
    ↓
Renders the resolved component with config props
```

### Variant File Structure

Each section folder contains one file per variant + an index:

```
sections/hero/
  HeroModern.tsx         ← Clean, contemporary
  HeroAesthetic.tsx      ← Artistic, gradient-rich, decorative
  HeroRobotic.tsx        ← Dark, geometric, techy, mono font
  index.ts               ← Exports variant map
```

The `index.ts` exports a variant map:

```ts
import type { SectionVariant } from "@/types/section.types";
export const heroVariants: Record<SectionVariant, typeof HeroModern> = {
  modern: HeroModern,
  aesthetic: HeroAesthetic,
  robotic: HeroRobotic,
};
```

### Sections with Variants

| Section Type | Folder | Variants |
|-------------|--------|----------|
| `navbar` | `organisms/navbar/` | NavbarModern, NavbarAesthetic, NavbarRobotic |
| `hero` | `sections/hero/` | HeroModern, HeroAesthetic, HeroRobotic |
| `featured` | `sections/featured/` | FeaturedModern, FeaturedAesthetic, FeaturedRobotic |
| `top_selling` | `sections/top-selling/` | TopSellingModern, TopSellingAesthetic, TopSellingRobotic |
| `footer` | `organisms/footer/` | FooterModern, FooterAesthetic, FooterRobotic |

### Variant Design Guidelines

| Variant | Colors | Typography | Shapes | Feel |
|---------|--------|-----------|--------|------|
| **modern** | Theme colors on white | System sans-serif | Rounded corners | Clean, professional |
| **aesthetic** | Gradients, transparent blobs | Gradient text, tracking-wide labels | Rounded-2xl, soft shadows | Artistic, premium |
| **robotic** | Dark bg (`bg-text-primary`), primary accents, glows | `font-mono`, uppercase tracking | Sharp/no corners, grid overlays | Techy, cyberpunk |

### Adding a New Section (complete checklist)

### Step 1 — Type Definition
In `src/types/section.types.ts`:
- Add the new type to the `SectionType` union: `| "testimonials"`
- Create the config interface:
  ```ts
  export interface TestimonialsConfig {
    title: string;
    subtitle: string;
    testimonials: { name: string; quote: string; role: string }[];
  }
  ```

### Step 2 — Create 3 Variant Components
Create `src/components/sections/testimonials/`:
- `TestimonialsModern.tsx` — clean, white background
- `TestimonialsAesthetic.tsx` — gradients, decorative blobs
- `TestimonialsRobotic.tsx` — dark, mono, grid lines
- `index.ts` — exports `testimonialsVariants` record

Each component:
- Accepts `config: TestimonialsConfig` and `className?: string`
- Wraps in `<section>` with `<Container>`
- Uses `cn()` for className merging
- Follows the variant design guidelines above

### Step 3 — Register in SectionRenderer
In `src/components/sections/section-renderer/SectionRenderer.tsx`:
- Import the variant map
- Add a new `case`:
  ```ts
  case "testimonials": {
    const Component = testimonialsVariants[variant];
    return <Component key={section.id} config={config as unknown as TestimonialsConfig} />;
  }
  ```

### Step 4 — Database
- Insert a row into `sections` table with `type: "testimonials"`, `variant: "modern"`, and `config_json`

### Step 5 — Admin
- No change needed — the SectionManager variant selector works automatically for all section types

### Adding a New Variant to ALL Sections

If you add a 4th variant (e.g., `"retro"`):
1. Add it to `SectionVariant` union in `types/section.types.ts`
2. Create a `*Retro.tsx` component in EVERY section folder
3. Add it to EVERY `index.ts` variant map
4. Add it to the `VARIANTS` array in `SectionManager.tsx`

---

## 8. Adding a New Supabase Table (complete checklist)

This is a **single-site** application. Tables do not have a `site_id` column. All data belongs to the one site.

### Step 1 — Types
Create `src/types/<name>.types.ts` with:
- `interface <Name>Row { ... }` — snake_case, matches DB columns exactly
- `interface <Name> { ... }` — camelCase, used in app
- No `site_id` / `siteId` fields

### Step 2 — Query
Create `src/queries/<name>.query.ts`:
- Import `createServerSupabaseClient`
- Write read-only functions that return `<Name>Row` or `<Name>Row[]`
- No `siteId` parameter — queries are global
- Handle errors with `console.error` and return `null` or `[]`

### Step 3 — Service
Create `src/services/<name>.service.ts`:
- Start with `"use server"`
- Import query functions and types
- Write private `map<Name>Row()` function
- Export `fetch*`, `create*`, `update*`, `delete*` functions
- No `siteId` parameter — services are global
- Write operations return `Promise<{ success: boolean; error?: string }>`

### Step 4 — SQL (CRITICAL)
Update `supabase-schema.sql` — this is the **single source of truth** for the database schema:

1. Add `DROP TABLE IF EXISTS <name> CASCADE;` to **Section 1** (before other drops)
2. Add `CREATE TABLE <name> (...)` to **Section 2**
3. Add indexes to **Section 3**
4. Add `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;` to **Section 4**
5. Add RLS policies (SELECT/INSERT/UPDATE/DELETE) to **Section 4**
6. Add seed data to **Section 5** (with realistic defaults)

**NEVER create separate migration files.** All schema changes go into `supabase-schema.sql`.
The file must always be runnable on a fresh database and re-runnable via DROP.

---

## 9. Responsive Design

- Use Tailwind responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`
- Mobile-first: base classes are mobile, add breakpoints for larger screens
- Typography responsiveness is built into the Typography atom — do not override
- Grid patterns: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`
- Every section wraps content in `<Container>` for consistent max-width and padding

---

## 10. Things That Are Forbidden

| Do not | Do instead |
|--------|-----------|
| Use `any` type | Define a proper interface |
| Import Supabase in components | Import from `services/` in page, pass as props |
| Write raw `<h1>`, `<p>`, `<span>` for text | Use `<Typography variant="...">` |
| Write responsive text classes manually | Typography handles it internally |
| Put business logic in components | Put it in `services/` |
| Put data mapping in queries | Put it in `services/` |
| Skip the Row ↔ Domain type split | Always have both + a mapper |
| Create a component without `className` prop | Always accept and merge with `cn()` |
| Add `"use client"` to server-renderable components | Only when hooks or events are needed |
| Fetch data in molecules/organisms | Fetch in page.tsx, pass via props |
| Skip try/catch on write operations | Always wrap and return `{ success, error? }` |
| Put component prop types in `types/` | Define them in the component file |
| Create files outside the established structure | Follow the folder placement table above |
| Use raw shadcn components with hardcoded colors | Remap all colors to theme CSS variables before adding |
| Import `cn` from `@/lib/utils` (shadcn default) | Always import from `@/utils/cn` |
| Put shadcn components in `atoms/` or `molecules/` | They live in `components/ui/` only |
| Add `site_id` columns or `siteId` params | This is a single-site app — no multi-tenancy |
| Use `bg-white`, `border-gray-*`, `text-gray-*` | Use `bg-background`, `border-border`, `text-text-secondary` etc. |
| Hardcode border radius (`rounded-[8px]`) | Use Tailwind tokens: `rounded-sm`, `rounded-md`, `rounded-lg`, `rounded-xl` |

---

## 11. Import Alias

All imports use the `@/*` alias mapped to `src/*`:

```ts
import { cn } from "@/utils/cn";
import { Typography } from "@/components/atoms/typography";
import { fetchProducts } from "@/services/product.service";
import type { Product } from "@/types/product.types";
```

Never use relative imports like `../../utils/cn`.

---

## 12. shadcn/ui Components (`src/components/ui/`)

### Architecture

shadcn components live in `src/components/ui/` — separate from the Atomic Design hierarchy in `components/atoms/`, `molecules/`, `organisms/`, and `sections/`.

```
src/components/
├── atoms/          ← Our custom atoms (Typography, Button, Container, DynamicImage)
├── molecules/      ← Our custom molecules
├── organisms/      ← Our custom organisms
├── sections/       ← Our custom sections
└── ui/             ← shadcn/ui components (themed to our system)
```

### Theme Bridge

shadcn components use their own CSS variable naming convention (`--background`, `--primary`, `--border`, etc.). These are **bridged** to our theme system in `globals.css`:

```
Our theme vars                    shadcn bridge vars
--color-primary       →           --primary
--color-background    →           --background
--color-text-primary  →           --foreground
--color-surface       →           --muted
--color-text-secondary →          --muted-foreground
--color-border        →           --border
```

Changing our theme (via Supabase or `design-system.ts`) automatically updates all shadcn components. No manual syncing needed.

### Available Components

| Component | File | Radix Primitive | "use client" |
|-----------|------|----------------|--------------|
| Input | `ui/input.tsx` | — | No |
| Textarea | `ui/textarea.tsx` | — | No |
| UILabel | `ui/label.tsx` | `@radix-ui/react-label` | Yes |
| Badge | `ui/badge.tsx` | — | No |
| Card | `ui/card.tsx` | — | No |
| Separator | `ui/separator.tsx` | `@radix-ui/react-separator` | Yes |
| Switch | `ui/switch.tsx` | `@radix-ui/react-switch` | Yes |
| Dialog | `ui/dialog.tsx` | `@radix-ui/react-dialog` | Yes |
| Select | `ui/select.tsx` | `@radix-ui/react-select` | Yes |
| Tabs | `ui/tabs.tsx` | `@radix-ui/react-tabs` | Yes |
| DropdownMenu | `ui/dropdown-menu.tsx` | `@radix-ui/react-dropdown-menu` | Yes |
| Tooltip | `ui/tooltip.tsx` | `@radix-ui/react-tooltip` | Yes |

### When to Use shadcn vs Our Atoms

| Use case | Use |
|----------|-----|
| Text rendering | `<Typography>` from atoms (mandatory — never use raw tags) |
| Primary call-to-action buttons | `<Button>` from atoms (themed with variant/size records) |
| Page-level max-width wrapper | `<Container>` from atoms |
| Responsive images | `<DynamicImage>` from atoms |
| Form inputs | `<Input>`, `<Textarea>`, `<Select>` from `ui/` |
| Form labels | `<UILabel>` from `ui/` (note: distinct from Typography's `<Label>`) |
| Toggles | `<Switch>` from `ui/` |
| Status indicators | `<Badge>` from `ui/` |
| Content cards (admin) | `<Card>` from `ui/` |
| Modals/dialogs | `<Dialog>` from `ui/` |
| Menus | `<DropdownMenu>` from `ui/` |
| Tab navigation | `<Tabs>` from `ui/` |
| Hover info | `<Tooltip>` from `ui/` |
| Visual dividers | `<Separator>` from `ui/` |

### Rules

1. **Never import raw shadcn components from external sources.** Only use the pre-themed versions in `src/components/ui/`.
2. **All `ui/` components must use our `cn()` utility** from `@/utils/cn` — never import a separate `lib/utils`.
3. **All `ui/` components must use theme CSS variables** (`bg-background`, `text-foreground`, `border-border`, etc.) — never hardcode colors like `bg-zinc-900` or `text-slate-500`.
4. **Typography still goes through our atoms.** shadcn Card titles, Dialog titles, etc. use raw `<h3>` internally — that is acceptable only inside `ui/` files. Outside `ui/`, always use `<Typography>`.
5. **`ui/` components do not replace atoms.** Our `Button`, `Container`, `Typography`, and `DynamicImage` remain the primary building blocks. `ui/` supplements them with complex interactive primitives.
6. **Every `ui/` component must accept and merge `className`** via `cn()`.

### Adding a New shadcn Component

1. Find the component on [ui.shadcn.com](https://ui.shadcn.com)
2. Install the required `@radix-ui/*` package if needed
3. Create the file in `src/components/ui/<name>.tsx`
4. **Before saving**: replace all hardcoded colors with theme variables:
   - `bg-zinc-*`, `bg-slate-*`, `bg-gray-*` → `bg-background`, `bg-muted`, `bg-surface`
   - `text-zinc-*`, `text-slate-*` → `text-foreground`, `text-muted-foreground`
   - `border-zinc-*` → `border-border`
   - Any `ring-zinc-*` → `ring-ring`
5. Replace the `cn` import: `import { cn } from "@/utils/cn"`
6. Define explicit prop interfaces (no `React.ComponentPropsWithoutRef<>` shorthand without an interface)
7. Verify build passes

### CSS Variable Layers (do not modify bridge vars directly)

```
globals.css :root
│
├── --theme-* vars              ← EDIT THESE (or override from Supabase)
│   --theme-primary: #2563eb
│   --theme-background: #ffffff
│   ...
│
globals.css @theme inline
│
├── Core tokens                 ← Tailwind reads these (bg-primary, text-surface, etc.)
│   --color-primary: var(--theme-primary)
│   --color-surface: var(--theme-surface)
│   ...
│
├── Derived tokens
│   --color-border: var(--theme-border)
│   --color-muted: var(--theme-surface)
│   ...
│
└── shadcn bridge tokens        ← For shadcn ui/ components
    --color-foreground: var(--theme-text-primary)
    --color-card: var(--theme-background)
    ...
```

---

## 13. Quick Reference — "I want to..."

| Goal | Files to touch |
|------|---------------|
| Add a new section type | `types/section.types.ts` → `components/sections/<name>/` → `SectionRenderer.tsx` → DB insert |
| Add a new atom | `components/atoms/<name>/` |
| Add a new theme color | `types/theme.types.ts` (ThemeColors) → `config/design-system.ts` → `globals.css` → `theme.service.ts` → `ThemeEditor.tsx` → DB column |
| Add a new design token | `types/theme.types.ts` (ThemeTokens) → `config/design-system.ts` (default + presets) → `globals.css` → `theme.service.ts` → `ThemeEditor.tsx` → DB column |
| Add a new DB table | `types/` → `queries/` → `services/` → `supabase-schema.sql` |
| Add an admin page | `app/(admin)/dashboard/<name>/page.tsx` + client component if interactive |
| Add a utility function | `utils/<name>.ts` |
| Add a new typography variant | `types/typography.types.ts` → `config/typography.ts` |
| Add a shadcn component | Install `@radix-ui/*` if needed → create `components/ui/<name>.tsx` → remap colors to theme vars |
| Use a form input | Import `Input`/`Textarea`/`Select` from `components/ui/` |
| Add a modal/dialog | Import `Dialog*` from `components/ui/dialog` |
