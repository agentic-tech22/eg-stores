// Locales that render currency symbols in non-Latin scripts: override to English
const localeOverrides: Record<string, string> = {
  "ne-NP": "en-NP",
  "ar-AE": "en-AE",
};

export function formatCurrency(
  amount: number,
  currency: string = "NPR",
  locale: string = "en-NP",
): string {
  const resolvedLocale = localeOverrides[locale] ?? locale;
  return new Intl.NumberFormat(resolvedLocale, {
    style: "currency",
    currency,
  }).format(amount);
}
