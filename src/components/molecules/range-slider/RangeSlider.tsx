"use client";

import { cn } from "@/utils/cn";

interface RangeSliderProps {
  min: number;
  max: number;
  step?: number;
  /** Current [low, high]. Always within [min, max], low <= high. */
  value: [number, number];
  onChange: (next: [number, number]) => void;
  /** Renders the two end labels, e.g. as currency. */
  formatValue?: (amount: number) => string;
  className?: string;
}

/**
 * Two native range inputs stacked into one two-handle slider.
 *
 * Native inputs rather than a hand-rolled drag implementation, because the
 * things a hand-rolled one gets wrong are the things people rely on: arrow keys
 * and Home/End, touch targets that match the platform, and the input being
 * announced as a slider with its value. Stacking two is the cost of that.
 *
 * The stacking needs care. Both inputs cover the full width, so the upper one
 * would swallow every click meant for the lower. Pointer events are therefore
 * switched off on the inputs themselves and back on for just their thumbs, so
 * each handle is grabbable and the track beneath stays inert.
 */
export function RangeSlider({
  min,
  max,
  step = 1,
  value,
  onChange,
  formatValue = (amount) => String(amount),
  className,
}: RangeSliderProps) {
  const [low, high] = value;
  const span = max - min || 1;
  const lowPercent = ((low - min) / span) * 100;
  const highPercent = ((high - min) / span) * 100;

  // Handles must not cross: dragging one past the other pins it instead, which
  // is what keeps the pair a range rather than two independent numbers.
  function handleLow(next: number) {
    onChange([Math.min(next, high), high]);
  }
  function handleUp(next: number) {
    onChange([low, Math.max(next, low)]);
  }

  const thumb = cn(
    "pointer-events-none absolute inset-x-0 top-1/2 h-0 w-full -translate-y-1/2 appearance-none bg-transparent focus:outline-none",
    // WebKit
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4",
    "[&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:cursor-grab",
    "[&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2",
    "[&::-webkit-slider-thumb]:border-shop-ink [&::-webkit-slider-thumb]:bg-shop-ink-accent",
    "[&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:transition-transform",
    "[&::-webkit-slider-thumb]:hover:scale-115 [&::-webkit-slider-thumb]:active:cursor-grabbing",
    // Firefox
    "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4",
    "[&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full",
    "[&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-shop-ink",
    "[&::-moz-range-thumb]:bg-shop-ink-accent [&::-moz-range-thumb]:shadow-md",
    // The focus ring has to go on the thumb: the input itself is zero-height.
    "focus-visible:[&::-webkit-slider-thumb]:ring-shop-ink-accent/50 focus-visible:[&::-webkit-slider-thumb]:ring-4",
    "focus-visible:[&::-moz-range-thumb]:ring-shop-ink-accent/50 focus-visible:[&::-moz-range-thumb]:ring-4",
  );

  return (
    <div className={cn("flex flex-col gap-3", className)}>
      <div className="relative h-5">
        {/* Track */}
        <div className="bg-shop-ink-border absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full" />
        {/* The selected span */}
        <div
          className="bg-shop-ink-accent absolute top-1/2 h-1 -translate-y-1/2 rounded-full"
          style={{
            left: `${lowPercent}%`,
            width: `${Math.max(highPercent - lowPercent, 0)}%`,
          }}
        />

        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={low}
          onChange={(event) => handleLow(Number(event.target.value))}
          aria-label="Minimum price"
          className={thumb}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={high}
          onChange={(event) => handleUp(Number(event.target.value))}
          aria-label="Maximum price"
          className={thumb}
        />
      </div>

      <div className="text-shop-ink-text flex items-center justify-between text-xs font-semibold tabular-nums">
        <span>{formatValue(low)}</span>
        <span>{formatValue(high)}</span>
      </div>
    </div>
  );
}
