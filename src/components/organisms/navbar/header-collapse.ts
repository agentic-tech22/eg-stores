/**
 * How much height the header gives up when it collapses: a 40px utility strip
 * (`max-h-10`) plus 8px of padding the nav drops (`py-4` to `py-3`).
 *
 * Only an approximation of the rendered value, and only used to assert the
 * thresholds below stay far enough apart.
 */
export const HEADER_COLLAPSE_HEIGHT = 48;

/** Scrolling down, the header collapses once past this. */
export const COLLAPSE_AT = 96;

/** Scrolling back up, it expands again only below this. */
export const EXPAND_AT = 24;

/**
 * The header's next shape, given the one it is in and where the page is.
 *
 * Two thresholds rather than one, and the gap between them is the whole point.
 * The header is `sticky`, so it sits in normal flow and its height is part of
 * the document: collapsing it takes ~48px off the top of the page and shifts
 * everything below. With a single boundary that shift can carry the scroll
 * position back across it, which re-expands the header, which returns the 48px
 * — and it oscillates for as long as you keep scrolling, which is what made the
 * bar flicker on the way back up.
 *
 * So the dead zone between EXPAND_AT and COLLAPSE_AT has to stay wider than
 * the height the header gives up. There is a test for exactly that, because it
 * is the kind of invariant someone breaks while nudging a number.
 */
export function nextCollapsed(collapsed: boolean, scrollY: number): boolean {
  return collapsed ? scrollY > EXPAND_AT : scrollY > COLLAPSE_AT;
}
