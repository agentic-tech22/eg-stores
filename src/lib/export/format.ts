/**
 * Cell formatters for CSV export.
 *
 * The rule behind all of these: emit values a spreadsheet can *parse*, not
 * values that look pretty. That means ISO dates, raw decimal numbers, and no
 * currency symbols or thousands separators — `formatCurrency()` is deliberately
 * never used here, because its `Intl` output ("रू 1,234.56") imports as text and
 * can't be summed.
 */

const DATE_PREFIX = /^\d{4}-\d{2}-\d{2}/;

/** `YYYY-MM-DD` from a date or timestamp string; empty for null/garbage. */
export function isoDate(value: string | null | undefined): string {
  if (!value) return "";
  return DATE_PREFIX.test(value) ? value.slice(0, 10) : "";
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * `YYYY-MM-DD HH:mm:ss` in local time. A space rather than `T`, and no trailing
 * `Z`: Excel imports a full ISO-8601 timestamp as text, but parses this shape as
 * a real date-time.
 */
export function isoDateTime(value: string | null | undefined): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const day = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  return `${day} ${time}`;
}

/** Money: fixed 2dp, no symbol, no grouping. Empty for null/undefined. */
export function amount(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "";
  // `+ 0` collapses -0 to 0, so a zeroed line never exports as "-0.00".
  return (value + 0).toFixed(2);
}

/** Counts and quantities: plain number, empty for null/undefined. */
export function num(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value))
    return "";
  return String(value);
}

/** Booleans as Yes/No — readable, and never mistaken for a formula. */
export function bool(value: boolean | null | undefined): string {
  if (value === null || value === undefined) return "";
  return value ? "Yes" : "No";
}

/**
 * Tags a money column with the shop currency: `money("Total", "NPR")` →
 * `"Total (NPR)"`. The code lives in the header rather than in a repeated
 * per-row column, which would be dead width — the shop has one currency.
 */
export function money(header: string, currencyCode: string): string {
  return `${header} (${currencyCode})`;
}

/** `{ Color: "Red", Size: "M" }` → `"Color=Red; Size=M"`. */
export function attributes(
  attrs: Record<string, string> | null | undefined,
): string {
  if (!attrs) return "";
  return Object.entries(attrs)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

/** Gross margin as a percentage of price, blank when price is zero/unknown. */
export function marginPercent(
  price: number | null | undefined,
  cost: number | null | undefined,
): string {
  if (!price || !Number.isFinite(price) || price === 0) return "";
  if (cost === null || cost === undefined || !Number.isFinite(cost)) return "";
  return (((price - cost) / price) * 100).toFixed(2);
}
