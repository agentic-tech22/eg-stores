import type { TypographyTag, TypographyVariant } from "@/types/typography.types";
import { Typography } from "./Typography";

interface TextProps {
  size?: "large" | "default" | "small";
  as?: TypographyTag;
  className?: string;
  children: React.ReactNode;
}

export function Text({ size = "default", as, className, children }: TextProps) {
  const variantMap: Record<string, TypographyVariant> = {
    large: "bodyLarge",
    default: "body",
    small: "bodySmall",
  };

  return (
    <Typography variant={variantMap[size]} as={as} className={className}>
      {children}
    </Typography>
  );
}
