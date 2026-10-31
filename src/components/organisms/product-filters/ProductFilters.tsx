"use client";

import { RangeSlider } from "@/components/molecules/range-slider/RangeSlider";
import type { Category } from "@/types/product.types";
import { formatCurrency } from "@/utils/format-currency";
import { isRangeNarrowed, type PriceRange } from "@/utils/price-range";
import { cn } from "@/utils/cn";

/** Everything the /products grid narrows itself by. */
export interface ProductFilterState {
  /** Category id, or "" for all. */
  category: string;
  /**
   * Selected [low, high] price, or null while the shop has no range worth
   * showing a slider for.
   */
  price: [number, number] | null;
}

interface ProductFiltersProps {
  categories: Category[];
  /** How many products sit in each category id, for the counts in the rail. */
  countByCategory: Record<string, number>;
  totalCount: number;
  /** Bounds for the price slider, or null to hide it. */
  range: PriceRange | null;
  currency: { code: string; locale: string };
  value: ProductFilterState;
  onChange: (next: ProductFilterState) => void;
  className?: string;
}

/** The filters in their untouched state, for a given price range. */
export function emptyFilters(range: PriceRange | null): ProductFilterState {
  return { category: "", price: range ? [range.min, range.max] : null };
}

export function isFiltered(
  state: ProductFilterState,
  range: PriceRange | null,
): boolean {
  if (state.category !== "") return true;
  return Boolean(range && state.price && isRangeNarrowed(state.price, range));
}

function GroupHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-heading text-text-primary mb-3 text-base font-semibold">
      {children}
    </p>
  );
}

/**
 * One row in the list: a square box and a label, the way a shop's filter
 * column is read at a glance. A button rather than a checkbox input because
 * every option here is single-select and applies immediately — there is no
 * form to submit, so the input's semantics would buy nothing. `aria-pressed`
 * carries the state instead.
 */
function FilterRow({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count?: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className="group focus-visible:ring-ring flex w-full cursor-pointer items-center gap-3 rounded-md py-1.5 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border-[1.5px] transition-colors",
          active
            ? "border-primary bg-primary text-white"
            : "border-accent/70 group-hover:border-primary bg-background",
        )}
      >
        {active && (
          <svg
            className="h-3 w-3"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={3.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M4.5 12.75l6 6 9-13.5"
            />
          </svg>
        )}
      </span>
      <span
        className={cn(
          "flex-1 truncate transition-colors",
          active
            ? "text-text-primary font-semibold"
            : "text-text-secondary group-hover:text-text-primary",
        )}
      >
        {label}
      </span>
      {count !== undefined && (
        <span className="text-text-muted shrink-0 text-xs tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * The /products filter column: a white panel of ruled groups under a
 * "Filter by" heading.
 *
 * Two axes, category and price. Availability used to be a third, as an "in
 * stock only" checkbox; the listing now hides sold-out stock outright, so the
 * checkbox was offering to turn off something nobody wants turned off.
 *
 * Purely controlled: it owns no state, so the same panel renders in the
 * desktop column and inside the mobile drawer without the two disagreeing.
 */
export function ProductFilters({
  categories,
  countByCategory,
  totalCount,
  range,
  currency,
  value,
  onChange,
  className,
}: ProductFiltersProps) {
  const money = (amount: number) =>
    formatCurrency(amount, currency.code, currency.locale);

  return (
    <div className={cn("flex flex-col", className)}>
      <div className="border-border flex items-center justify-between gap-3 border-b pb-4">
        <p className="font-heading text-text-primary text-base font-bold tracking-wide uppercase">
          Filter by:
        </p>
        {isFiltered(value, range) && (
          <button
            type="button"
            onClick={() => onChange(emptyFilters(range))}
            className="text-primary hover:text-secondary cursor-pointer text-xs font-semibold underline-offset-4 transition-colors hover:underline"
          >
            Reset
          </button>
        )}
      </div>

      {range && value.price && (
        <div className="border-border border-b py-6">
          <GroupHeading>Price</GroupHeading>
          <RangeSlider
            min={range.min}
            max={range.max}
            step={range.step}
            value={value.price}
            onChange={(price) => onChange({ ...value, price })}
            formatValue={money}
          />
        </div>
      )}

      {categories.length > 0 && (
        <div className="py-6">
          <GroupHeading>Category</GroupHeading>
          <div className="flex flex-col gap-1">
            <FilterRow
              label="All products"
              count={totalCount}
              active={value.category === ""}
              onClick={() => onChange({ ...value, category: "" })}
            />
            {categories.map((category) => (
              <FilterRow
                key={category.id}
                label={category.name}
                count={countByCategory[category.id] ?? 0}
                active={value.category === category.id}
                onClick={() => onChange({ ...value, category: category.id })}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
