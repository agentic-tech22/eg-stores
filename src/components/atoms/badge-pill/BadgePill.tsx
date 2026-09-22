import { cn } from "@/utils/cn";

type BadgeTone =
  | "brand"
  | "accent"
  | "success"
  | "warning"
  | "danger"
  | "neutral";
type BadgeSize = "sm" | "md";

interface BadgePillProps {
  tone?: BadgeTone;
  size?: BadgeSize;
  className?: string;
  children: React.ReactNode;
}

const toneClasses: Record<BadgeTone, string> = {
  brand: "bg-secondary text-white",
  accent: "bg-accent text-white",
  success: "bg-primary/10 text-primary",
  warning: "bg-accent/15 text-text-primary",
  danger: "bg-destructive text-destructive-foreground",
  neutral: "bg-surface text-text-secondary",
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: "px-2.5 py-0.5 text-[10px]",
  md: "px-3 py-1 text-[11px]",
};

/**
 * Small status pill for product state ("Combo", "Only 2 left", "Sold out").
 * Purely presentational — the caller decides which tone a given state deserves.
 */
export function BadgePill({
  tone = "brand",
  size = "sm",
  className,
  children,
}: BadgePillProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-bold tracking-widest uppercase",
        toneClasses[tone],
        sizeClasses[size],
        className,
      )}
    >
      {children}
    </span>
  );
}
