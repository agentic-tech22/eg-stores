"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export function useActiveLink(links: { href: string }[]): string {
  const pathname = usePathname();
  const [activeHash, setActiveHash] = useState("");

  useEffect(() => {
    const hashLinks = links.filter((l) => l.href.startsWith("#"));
    if (hashLinks.length === 0 || pathname !== "/") return;

    function onScroll() {
      const offset = 150;
      let closestHref = "";
      let closestDistance = Infinity;

      for (const link of hashLinks) {
        const id = link.href.replace("#", "");
        const el = document.getElementById(id);
        if (!el) continue;

        const rect = el.getBoundingClientRect();
        const distance = Math.abs(rect.top - offset);

        // Only consider sections that are at or above the offset point
        if (rect.top <= offset && distance < closestDistance) {
          closestDistance = distance;
          closestHref = link.href;
        }
      }

      setActiveHash(closestHref);
    }

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [links, pathname]);

  return links.reduce((active, link) => {
    if (!link.href.startsWith("#") && link.href === pathname) return link.href;
    if (link.href.startsWith("#") && link.href === activeHash && pathname === "/")
      return link.href;
    return active;
  }, "");
}
