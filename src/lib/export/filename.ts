/** Inclusive date bounds for an export, or null for "everything". */
export interface ExportDateRange {
  start: string;
  end: string;
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function today(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * `sales_2026-01-01_to_2026-08-09.csv` for a bounded export,
 * `customers_all-time_2026-08-09.csv` for an unbounded one.
 *
 * `now` is injectable so the tests don't depend on the clock. Nothing
 * user-supplied is interpolated — the dataset key is a fixed union.
 */
export function buildExportFilename(
  dataset: string,
  range: ExportDateRange | null,
  now: Date = new Date(),
): string {
  const scope = range
    ? `${range.start}_to_${range.end}`
    : `all-time_${today(now)}`;
  return `${slug(dataset)}_${scope}.csv`;
}
