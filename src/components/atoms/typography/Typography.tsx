import { typographyConfig } from "@/config/typography";
import type { TypographyProps } from "@/types/typography.types";
import { cn } from "@/utils/cn";

export function Typography({
  variant,
  as,
  className,
  children,
}: TypographyProps) {
  const config = typographyConfig[variant];
  const Tag = as ?? config.tag;

  return <Tag className={cn(config.classes, className)}>{children}</Tag>;
}
