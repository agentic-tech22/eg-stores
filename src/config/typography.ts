import type { TypographyVariantConfig } from "@/types/typography.types";

export const typographyConfig: Record<string, TypographyVariantConfig> = {
  display: {
    tag: "h1",
    classes:
      "font-heading text-4xl font-bold leading-[1.05] tracking-tight md:text-5xl lg:text-6xl xl:text-7xl",
  },
  h1: {
    tag: "h1",
    classes:
      "font-heading text-3xl font-bold leading-[1.1] tracking-tight md:text-4xl lg:text-5xl",
  },
  h2: {
    tag: "h2",
    classes:
      "font-heading text-2xl font-semibold leading-[1.15] tracking-tight md:text-3xl lg:text-4xl",
  },
  h3: {
    tag: "h3",
    classes: "font-heading text-xl font-semibold leading-snug md:text-2xl lg:text-3xl",
  },
  h4: {
    tag: "h4",
    classes: "font-heading text-lg font-semibold leading-snug md:text-xl",
  },
  bodyLarge: {
    tag: "p",
    classes: "text-base font-normal leading-relaxed md:text-lg",
  },
  body: {
    tag: "p",
    classes: "text-sm font-normal leading-relaxed md:text-base",
  },
  bodySmall: {
    tag: "p",
    classes: "text-xs font-normal leading-relaxed md:text-sm",
  },
  caption: {
    tag: "span",
    classes: "text-[11px] font-normal leading-normal tracking-wide",
  },
  label: {
    tag: "span",
    classes:
      "text-[11px] font-medium uppercase leading-normal tracking-[0.15em]",
  },
};
