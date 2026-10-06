type LogoOrientation = "horizontal" | "vertical" | "square";

// A square logo is usually a bare monogram, but a badge-style mark carries its
// own wordmark inside it, and at 32px that text is too small to read. Sized up,
// with w-auto so the object-contain on the <img> keeps the real aspect ratio.
const navbarLogoClasses: Record<LogoOrientation, string> = {
  horizontal: "h-7 w-auto",
  square: "h-11 w-auto",
  vertical: "h-10 w-auto",
};

const footerLogoClasses: Record<LogoOrientation, string> = {
  horizontal: "h-6 w-auto",
  square: "h-14 w-auto",
  vertical: "h-10 w-auto",
};

export function getNavbarLogoClasses(orientation?: string): string {
  return navbarLogoClasses[(orientation as LogoOrientation) ?? "horizontal"];
}

export function getFooterLogoClasses(orientation?: string): string {
  return footerLogoClasses[(orientation as LogoOrientation) ?? "horizontal"];
}
