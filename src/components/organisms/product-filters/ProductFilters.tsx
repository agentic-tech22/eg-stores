"use client";

import type { Category } from "@/types/product.types";
import { formatCurrency } from "@/utils/format-currency";
import type { PriceBand } from "@/utils/price-bands";
import { cn } from "@/utils/cn";

/** Everything the /products grid narrows itself by. */
export interface ProductFilterState {
  /** Category id, or "" for all. */
  category: string;
  /** Index into the price band list, or -1 for any price. */
  bandIndex: number;
  inStockOnly: boolean;
}

export const EMPTY_FILTERS: ProductFilterState = {
  category: "",
  bandIndex: -1,
  inStockOnly: false,
};

export function isFiltered(state: ProductFilterState): boolean {
  return (
    state.category !== "" || state.bandIndex !== -1 || state.inStockOnly
  );
}

interface ProductFiltersProps {
  categories: Category[];
  /** How many products sit in each category id, for the counts in the rail. */
  countByCategory: Record<string, number>;
  totalCount: number;
  bands: PriceBand[];
  currency: { code: string; locale: string };
  value: ProductFilterState;
  onChange: (next: ProductFilterState) => void;
  className?: string;
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
 * It replaces a row of category pills that sat above the grid. Pills only ever
 * offered one axis, they pushed the first product further down the page with
 * every category the shop added, and there was nowhere to hang price or
 * availability. A rail costs a column on desktop and gives the shopper three
 * axes that stay on screen while they scroll the grid.
 *
 * Purely controlled: it owns no state, so the same panel renders in the desktop
 * column and inside the mobile drawer without the two disagreeing.
 */
export function ProductFilters({
  categories,
  countByCategory,
  totalCount,
  bands,
  currency,
  value,
  onChange,
  className,
}: ProductFiltersProps) {
  const money = (amount: number) =>
    formatCurrency(amount, currency.code, currency.locale);

  function bandLabel(band: PriceBand): string {
    if (band.max === null) return `${money(band.min)} and above`;
    if (band.min === 0) return `Under ${money(band.max)}`;
    return `${money(band.min)} - ${money(band.max)}`;
  }

  return (
    <div className={cn("flex flex-col gap-7", className)}>
      <div className="flex items-center justify-between gap-3">
        <p className="font-heading text-shop-ink-text-active text-sm font-bold">
          Filters
        </p>
        {isFiltered(value) && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_FILTERS)}
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

      {bands.length > 0 && (
        <div>
          <GroupHeading>Price</GroupHeading>
          <div className="flex flex-col gap-0.5">
            <FilterRow
              label="Any price"
              active={value.bandIndex === -1}
              onClick={() => onChange({ ...value, bandIndex: -1 })}
            />
            {bands.map((band, index) => (
              <FilterRow
                key={`${band.min}-${band.max ?? "up"}`}
                label={bandLabel(band)}
                active={value.bandIndex === index}
                onClick={() => onChange({ ...value, bandIndex: index })}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <GroupHeading>Availability</GroupHeading>
        <label className="text-shop-ink-text hover:bg-shop-ink-hover hover:text-shop-ink-text-active flex cursor-pointer items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors">
          <input
            type="checkbox"
            checked={value.inStockOnly}
            onChange={(event) =>
              onChange({ ...value, inStockOnly: event.target.checked })
            }
            className="accent-shop-ink-accent h-4 w-4 shrink-0 cursor-pointer rounded"
          />
          In stock only
        </label>
      </div>
    </div>
  );
}
