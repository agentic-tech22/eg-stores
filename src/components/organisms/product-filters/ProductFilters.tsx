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
    <p className="text-shop-ink-muted mb-3 text-[10px] font-bold tracking-[0.2em] uppercase">
      {children}
    </p>
  );
}

/**
 * One row in the rail. A button rather than a radio input because every option
 * here is single-select and applies immediately — there is no form to submit,
 * so the radio's grouping semantics would buy nothing and its default styling
 * would have to be fought on a near-black ground.
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
      className={cn(
        "group flex w-full cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition-colors duration-200",
        active
          ? "bg-shop-ink-accent/15 text-shop-ink-text-active font-semibold"
          : "text-shop-ink-text hover:bg-shop-ink-hover hover:text-shop-ink-text-active",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full transition-colors",
          active
            ? "bg-shop-ink-accent"
            : "bg-shop-ink-text/30 group-hover:bg-shop-ink-text/60",
        )}
      />
      <span className="flex-1 truncate">{label}</span>
      {count !== undefined && (
        <span className="text-shop-ink-muted shrink-0 text-xs tabular-nums">
          {count}
        </span>
      )}
    </button>
  );
}

/**
 * The /products filter rail, on the shop's ink.
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
    <div className={cn("flex flex-col gap-7", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-heading text-shop-ink-text-active text-sm font-bold">
          Filters
        </p>
        {isFiltered(value, range) && (
          <button
            type="button"
            onClick={() => onChange(emptyFilters(range))}
            className="text-shop-ink-accent hover:text-shop-ink-text-active cursor-pointer text-xs font-semibold transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      {categories.length > 0 && (
        <div>
          <GroupHeading>Category</GroupHeading>
          <div className="flex flex-col gap-0.5">
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

      {range && value.price && (
        <div>
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
    </div>
  );
}
