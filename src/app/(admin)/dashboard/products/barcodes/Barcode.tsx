/**
 * Draws a Code 128 symbol as a pure SVG, so it renders on the server and prints
 * with no client-side work. The encoding lives in `@/lib/barcode/code128`.
 */

import { code128Bars } from "@/lib/barcode/code128";

interface BarcodeProps {
  value: string;
  /** Bar height in px (SVG user units). */
  height?: number;
  /** Width of one module (narrowest bar) in px (SVG user units). */
  moduleWidth?: number;
  /** Quiet-zone width in modules on each side (spec minimum is 10). */
  quietZone?: number;
  /**
   * Physical width of one module, in millimetres. When set, the SVG is sized so
   * a module prints at exactly this width instead of being stretched to fill its
   * container. Pick a whole number of printer dots (0.25mm is exactly 2 dots on
   * a 203dpi thermal head): a fractional module width makes each bar edge round
   * to a different dot, so a 1-module bar lands on 2 dots in one place and 3 in
   * another and the reader can no longer recover the width ratios.
   */
  moduleMm?: number;
  className?: string;
}

export function Barcode({
  value,
  height = 56,
  moduleWidth = 3,
  quietZone = 10,
  moduleMm,
  className,
}: BarcodeProps) {
  const { bars, modules } = code128Bars(value);
  const totalModules = modules + quietZone * 2;
  const width = totalModules * moduleWidth;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      // Bars scale independently on each axis so the symbol fills whatever box
      // CSS gives it. The horizontal scale is uniform, so the module-width
      // ratios that make it scannable survive.
      preserveAspectRatio="none"
      // Without this the renderer anti-aliases every bar edge into a grey
      // fringe. A printer then thresholds or dithers that grey, widening some
      // bars and thinning others, which is enough to make a dense symbol
      // unreadable. Hard edges only.
      shapeRendering="crispEdges"
      style={
        moduleMm
          ? { width: `${(totalModules * moduleMm).toFixed(3)}mm`, maxWidth: "100%" }
          : undefined
      }
      className={className}
      role="img"
      aria-label={`Barcode ${value}`}
    >
      <rect width={width} height={height} fill="#ffffff" />
      {bars.map((bar, i) => (
        <rect
          key={i}
          x={(bar.x + quietZone) * moduleWidth}
          y={0}
          width={bar.width * moduleWidth}
          height={height}
          fill="#000000"
        />
      ))}
    </svg>
  );
}
