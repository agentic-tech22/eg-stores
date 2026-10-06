import { Typography } from "@/components/atoms/typography";
import { formatCurrency } from "@/utils/format-currency";
import { cn } from "@/utils/cn";

type PriceSize = "sm" | "md" | "lg";
type PriceTone = "default" | "muted" | "inverse";

interface PriceProps {
  /** Amount in the shop's active currency. Never pass a cost price here. */
  amount: number;
  /** ISO code, e.g. "NPR". Comes from getActiveCurrency() on the server. */
  currencyCode?: string;
  /** Formatting locale, e.g. "en-NP". */
  currencyLocale?: string;
  /**
   * Pre-discount amount, shown struck through beside the live price. Only
   * rendered when it is genuinely higher, so a combo priced at its component
   * total does not display a meaningless "was".
   */
  compareAt?: number | null;
  size?: PriceSize;
  tone?: PriceTone;
  className?: string;
}

const sizeClasses: Record<PriceSize, string> = {
  sm: "text-sm",
  md: "text-base",
  lg: "text-xl md:text-2xl",
};

const toneClasses: Record<PriceTone, string> = {
  default: "text-text-primary",
  muted: "text-text-secondary",
  inverse: "text-white",
};

const compareToneClasses: Record<PriceTone, string> = {
  default: "text-text-secondary",
  muted: "text-text-secondary",
  inverse: "text-white/60",
};

export function Price({
  amount,
  currencyCode = "NPR",
  currencyLocale = "en-NP",
  compareAt,
  size = "md",
  tone = "default",
  className,
}: PriceProps) {
  const showCompare = typeof compareAt === "number" && compareAt > amount;

  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <Typography
        as="span"
        variant="body"
        className={cn(
          "font-heading font-bold tracking-tight",
          sizeClasses[size],
          toneClasses[tone],
        )}
      >
        {formatCurrency(amount, currencyCode, currencyLocale)}
      </Typography>

      {showCompare && (
        <Typography
          as="span"
          variant="bodySmall"
          className={cn("line-through", compareToneClasses[tone])}
        >
          {formatCurrency(compareAt, currencyCode, currencyLocale)}
        </Typography>
      )}
    </span>
  );
}
