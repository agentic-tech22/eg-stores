export type TypographyVariant =
  | "display"
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "bodyLarge"
  | "body"
  | "bodySmall"
  | "caption"
  | "label";

export type TypographyTag =
  | "h1"
  | "h2"
  | "h3"
  | "h4"
  | "h5"
  | "h6"
  | "p"
  | "span"
  | "div"
  | "label";

export interface TypographyVariantConfig {
  tag: TypographyTag;
  classes: string;
}

export interface TypographyProps {
  variant: TypographyVariant;
  as?: TypographyTag;
  className?: string;
  children: React.ReactNode;
}
