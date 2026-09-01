"use client";

import { usePathname } from "next/navigation";

/**
 * On sub-pages (/products, /about, etc.), hash links like #features
 * need to become /#features so they navigate back to the homepage section.
 * On the homepage itself, they stay as #features for smooth scrolling.
 */
export function useResolvedHref(): (href: string) => string {
  const pathname = usePathname();
  const isHome = pathname === "/";

  return (href: string) => {
    if (href.startsWith("#") && !isHome) {
      return `/${href}`;
    }
    return href;
  };
}
