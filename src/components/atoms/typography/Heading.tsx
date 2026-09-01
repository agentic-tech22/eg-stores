import type { TypographyTag } from "@/types/typography.types";
import { Typography } from "./Typography";

interface HeadingProps {
  level?: 1 | 2 | 3 | 4;
  as?: TypographyTag;
  className?: string;
  children: React.ReactNode;
}

export function Heading({
  level = 1,
  as,
  className,
  children,
}: HeadingProps) {
  const variantMap = {
    1: "h1",
    2: "h2",
    3: "h3",
    4: "h4",
  } as const;

  return (
    <Typography variant={variantMap[level]} as={as} className={className}>
      {children}
    </Typography>
  );
}
