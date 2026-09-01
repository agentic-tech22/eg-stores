import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import type { FooterConfig } from "@/types/layout.types";
import { cn } from "@/utils/cn";
import { getFooterLogoClasses } from "@/utils/logo-classes";

interface FooterAestheticProps {
  config: FooterConfig;
  className?: string;
}

export function FooterAesthetic({ config, className }: FooterAestheticProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={cn("relative overflow-hidden", className)}>
      {/* Blobs */}
      <div className="pointer-events-none absolute top-0 left-1/4 h-96 w-96 rounded-full bg-secondary/5 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-1/4 h-96 w-96 rounded-full bg-primary/5 blur-3xl" />

      <div className="relative z-10 rounded-t-[3rem] bg-background/70 shadow-[0_-20px_50px_rgba(26,26,46,0.03)] backdrop-blur-xl">
        <Container size="md">
          <div className="flex flex-col items-center gap-10 py-20 text-center">
            {/* Logo / Name */}
            {config.logoUrl ? (
              <img src={config.logoUrl} alt={config.siteName} className={cn("object-contain", getFooterLogoClasses(config.logoOrientation))} />
            ) : (
              <span className="font-heading text-5xl font-bold text-primary">
                {config.siteName}
              </span>
            )}

            {/* Description */}
            <Typography variant="bodyLarge" className="max-w-xl leading-relaxed text-text-secondary">
              {config.description}
            </Typography>

            {/* Links */}
            <div className="flex flex-wrap justify-center gap-x-10 gap-y-4">
              {config.links.flatMap((group) =>
                group.items.map((item, i) => (
                  <a
                    key={`${group.group}-${i}`}
                    href={item.href}
                    className={cn(
                      "text-sm transition-all duration-200 hover:scale-105",
                      i === 0
                        ? "text-secondary underline decoration-secondary/30"
                        : "text-text-secondary hover:text-secondary",
                    )}
                  >
                    {item.label}
                  </a>
                )),
              )}
            </div>

            {/* Divider */}
            <div className="h-px w-24 bg-gradient-to-r from-transparent via-secondary/30 to-transparent" />

            {/* Copyright */}
            <Typography variant="label" className="tracking-widest text-text-secondary/60">
              © {currentYear} {config.siteName}. All rights reserved.
            </Typography>
          </div>
        </Container>
      </div>
    </footer>
  );
}
