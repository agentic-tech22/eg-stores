/** A gap in the page list, drawn as "…". */
export const GAP = "gap" as const;

export type PageSlot = number | typeof GAP;

/**
 * The page buttons to draw: always the first and last page, the current page
 * with `siblings` either side, and a gap wherever pages are skipped.
 *
 * The slot count never changes as you page through (seven with the default one
 * sibling), so the buttons do not shift under the cursor. A gap that would
 * hide a single page shows that page instead, since "…" is no shorter than
 * the number it replaces.
 */
export function pageWindow(
  page: number,
  totalPages: number,
  siblings = 1,
): PageSlot[] {
  // first + last + current + siblings + two gaps
  const slots = siblings * 2 + 5;
  if (totalPages <= slots) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const current = Math.min(Math.max(page, 1), totalPages);
  // How many numbers sit between the first page and a gap, or a gap and the
  // last page, when the window is pinned to that end.
  const edgeRun = slots - 2;

  if (current <= edgeRun - siblings) {
    return [...range(1, edgeRun), GAP, totalPages];
  }
  if (current >= totalPages - (edgeRun - siblings) + 1) {
    return [1, GAP, ...range(totalPages - edgeRun + 1, totalPages)];
  }
  return [
    1,
    GAP,
    ...range(current - siblings, current + siblings),
    GAP,
    totalPages,
  ];
}

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i);
}
