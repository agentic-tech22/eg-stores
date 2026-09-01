import type { TypographyTag } from "@/types/typography.types";
import { Typography } from "./Typography";

interface LabelProps {
  as?: TypographyTag;
  className?: string;
  children: React.ReactNode;
}

export function Label({ as, className, children }: LabelProps) {
  return (
    <Typography variant="label" as={as} className={className}>
      {children}
    </Typography>
  );
}
