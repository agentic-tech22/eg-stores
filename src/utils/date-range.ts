/**
 * Date-range presets for filtering sales by `sale_date` (a YYYY-MM-DD DATE).
 * All math uses local-time components so a preset like "Today" matches the
 * user's calendar day rather than a UTC day (which can drift by hours).
 */

export type DatePreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "this_month"
  | "last_month"
  | "all";

export const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "last_month", label: "Last Month" },
  { value: "all", label: "All" },
];

/** Format a Date as a local YYYY-MM-DD string (no timezone conversion). */
export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Inclusive [start, end] date strings for a preset, or null for "all" (no
 * bound). Compare against `sale.saleDate.slice(0, 10)`.
 */
export function getPresetRange(
  preset: DatePreset,
): { start: string; end: string } | null {
  if (preset === "all") return null;

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":
      return { start: toLocalDateStr(today), end: toLocalDateStr(today) };
    case "yesterday": {
      const yesterday = new Date(today);
      yesterday.setDate(today.getDate() - 1);
      return {
        start: toLocalDateStr(yesterday),
        end: toLocalDateStr(yesterday),
      };
    }
    case "this_week": {
      const startOfWeek = new Date(today);
      startOfWeek.setDate(today.getDate() - today.getDay());
      return { start: toLocalDateStr(startOfWeek), end: toLocalDateStr(today) };
    }
    case "this_month":
      return {
        start: toLocalDateStr(new Date(today.getFullYear(), today.getMonth(), 1)),
        end: toLocalDateStr(today),
      };
    case "last_month": {
      const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);
      return {
        start: toLocalDateStr(
          new Date(today.getFullYear(), today.getMonth() - 1, 1),
        ),
        end: toLocalDateStr(lastMonthEnd),
      };
    }
  }
}

/** Inclusive number of days spanned by a [start, end] range (YYYY-MM-DD). */
function dayCount(start: string, end: string): number {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  return Math.round((e.getTime() - s.getTime()) / 86_400_000) + 1;
}

/**
 * The equal-length window immediately preceding `range`, for period-over-period
 * comparison (e.g. "this month so far" vs "the same number of days before it").
 * Returns null when `range` is null (all-time has no baseline).
 */
export function previousRange(
  range: { start: string; end: string } | null,
): { start: string; end: string } | null {
  if (!range) return null;
  const n = dayCount(range.start, range.end);
  const prevEnd = new Date(`${range.start}T00:00:00`);
  prevEnd.setDate(prevEnd.getDate() - 1);
  const prevStart = new Date(prevEnd);
  prevStart.setDate(prevStart.getDate() - (n - 1));
  return { start: toLocalDateStr(prevStart), end: toLocalDateStr(prevEnd) };
}

/** The equal-length window immediately preceding a preset's range. */
export function getPreviousPresetRange(
  preset: DatePreset,
): { start: string; end: string } | null {
  return previousRange(getPresetRange(preset));
}
