import type { TypographyTag } from "@/types/typography.types";
import { Typography } from "./Typography";

interface CaptionProps {
  as?: TypographyTag;
  className?: string;
  children: React.ReactNode;
}

export function Caption({ as, className, children }: CaptionProps) {
  return (
    <Typography variant="caption" as={as} className={className}>
      {children}
    </Typography>
  );
}
