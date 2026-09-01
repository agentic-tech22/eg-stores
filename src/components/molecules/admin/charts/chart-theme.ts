/**
 * Chart colors for the dashboard's light working area.
 *
 * Recharts takes colors as SVG attributes (`stroke`, `fill`, tick `fill`), not
 * classes, so these can't come from Tailwind utilities the way the rest of the
 * dashboard's color does — they have to be literal values in JS. Keeping them in
 * one module at least means the charts re-tint together, and that they stay
 * visibly in step with the `--admin-*` content tokens in globals.css rather than
 * each chart carrying its own drifting copy.
 *
 * These belong to the CONTENT palette, not the navigation rail's dark one: every
 * chart renders on `--admin-surface` (white), so the values are picked for
 * contrast against white.
 */

/** Categorical series palette, reused in order (donut slices, multi-series). */
export const CHART_SERIES = [
  "#6b4eff", // violet — brand accent, leads the palette
  "#06b6d4", // cyan
  "#059669", // emerald
  "#d97706", // amber
  "#e11d48", // rose
  "#2563eb", // blue
] as const;

/** Named roles, for the series that mean a specific thing. */
export const CHART_REVENUE = "#6b4eff";
export const CHART_PROFIT = "#059669";

/** Chrome: axis ticks and the horizontal grid rules behind the plot. */
export const CHART_GRID = "#e3e6ef";
export const CHART_TICK = "#858e9f";

/** Surface for recharts' own built-in tooltip (the donut still uses it). */
export const CHART_TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #e3e6ef",
  backgroundColor: "#ffffff",
  color: "#12141b",
  fontSize: 12,
  fontWeight: 600,
} as const;
