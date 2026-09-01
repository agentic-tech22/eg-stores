type LogoOrientation = "horizontal" | "vertical" | "square";

const navbarLogoClasses: Record<LogoOrientation, string> = {
  horizontal: "h-7 w-auto",
  square: "h-8 w-8",
  vertical: "h-10 w-auto",
};

const footerLogoClasses: Record<LogoOrientation, string> = {
  horizontal: "h-6 w-auto",
  square: "h-8 w-8",
  vertical: "h-10 w-auto",
};

export function getNavbarLogoClasses(orientation?: string): string {
  return navbarLogoClasses[(orientation as LogoOrientation) ?? "horizontal"];
}

export function getFooterLogoClasses(orientation?: string): string {
  return footerLogoClasses[(orientation as LogoOrientation) ?? "horizontal"];
}
