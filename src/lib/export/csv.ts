/**
 * RFC 4180 CSV serialization, with no dependencies.
 *
 * Two rules here are load-bearing and easy to get wrong:
 *
 * 1. **Formula injection.** `customer_name` and `notes` reach us from the public
 *    storefront checkout and are copied verbatim into sales, so an anonymous
 *    visitor can plant `=HYPERLINK("http://evil","click")` in a name and have it
 *    execute when the shop owner opens the export. Any *string* starting with a
 *    formula trigger gets a leading apostrophe, which Excel and Sheets both read
 *    as "this cell is text".
 * 2. **Numbers skip that guard.** Prefixing `-250` would turn every negative
 *    discount into text and break every SUM in the sheet. Numeric cells are
 *    emitted raw, always.
 */

export type CsvCell = string | number | boolean | null | undefined;

/** One column of an export: a header and how to read it off a row. */
export interface ExportColumn<T> {
  header: string;
  value: (row: T, index: number) => CsvCell;
}

/**
 * UTF-8 byte-order mark. Excel on Windows assumes cp1252 without it, which
 * turns Devanagari names and `रू` into mojibake. Prepended at download time —
 * never inside {@link toCsv}, so the serializer stays byte-clean for tests.
 */
export const CSV_BOM = "﻿";

/** Characters that make a spreadsheet treat a leading cell as a formula. */
const FORMULA_TRIGGERS = new Set(["=", "+", "-", "@", "\t", "\r"]);

/** Safety valve: past this the browser struggles to hold the string + Blob. */
export const MAX_EXPORT_ROWS = 200_000;

/** Serialize one cell: formula guard, then quote only when required. */
export function escapeCsvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "number") {
    // Non-finite values have no spreadsheet meaning; an empty cell is honest.
    return Number.isFinite(value) ? String(value) : "";
  }

  const raw = typeof value === "boolean" ? String(value) : value;
  if (raw === "") return "";

  const guarded = FORMULA_TRIGGERS.has(raw[0]!) ? `'${raw}` : raw;

  const needsQuotes =
    guarded !== raw ||
    guarded.includes('"') ||
    guarded.includes(",") ||
    guarded.includes("\n") ||
    guarded.includes("\r") ||
    guarded !== guarded.trim();

  return needsQuotes ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

/**
 * Build a CSV document. The header row is always emitted — an empty result set
 * downloads as a header-only file rather than a blank one, so the recipient can
 * see it ran and simply matched nothing.
 */
export function toCsv<T>(
  rows: readonly T[],
  columns: readonly ExportColumn<T>[],
): string {
  const header = columns.map((c) => escapeCsvCell(c.header)).join(",");
  if (rows.length === 0) return header;

  // map/join rather than `+=`: string concatenation over 100k rows is quadratic.
  const body = rows.map((row, i) =>
    columns.map((c) => escapeCsvCell(c.value(row, i))).join(","),
  );

  return [header, ...body].join("\r\n");
}
