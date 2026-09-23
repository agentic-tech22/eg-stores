import Link from "next/link";
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import { SUPPORT_WHATSAPP_TEL, SUPPORT_WHATSAPP_URL } from "@/config/contact";
import type { FooterConfig } from "@/types/layout.types";
import { cn } from "@/utils/cn";
import { getFooterLogoClasses } from "@/utils/logo-classes";

interface FooterAestheticProps {
  config: FooterConfig;
  className?: string;
}

/**
 * Site footer, on the same ink as the header.
 *
 * It used to be one centered column: logo, a paragraph, and every link in the
 * site flattened into a single wrapping row. That looked considered and worked
 * badly — the grouping the config already carried was thrown away, so "Your
 * cart" sat next to "WhatsApp us" with nothing to say which was which. The
 * groups are now columns, which is also what lets the contact details have a
 * home.
 */
export function FooterAesthetic({ config, className }: FooterAestheticProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={cn("bg-shop-ink mt-auto", className)}>
      <Container>
        <div className="grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr] lg:gap-16 lg:py-16">
          {/* Identity */}
          <div className="flex flex-col items-start gap-4">
            {config.logoUrl ? (
              /* Shop logos are arbitrary remote URLs from the business profile. */
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={config.logoUrl}
                alt={config.siteName}
                className={cn(
                  "object-contain",
                  getFooterLogoClasses(config.logoOrientation),
                )}
              />
            ) : (
              <span className="font-heading text-shop-ink-text-active text-2xl font-bold tracking-tight">
                {config.siteName}
              </span>
            )}

            <Typography
              variant="bodySmall"
              className="text-shop-ink-text max-w-sm leading-relaxed"
            >
              {config.description}
            </Typography>

            <div className="mt-2 flex flex-col gap-2">
              <a
                href={`tel:${SUPPORT_WHATSAPP_TEL}`}
                className="text-shop-ink-text hover:text-shop-ink-text-active group inline-flex items-center gap-2.5 text-sm transition-colors"
              >
                <span className="bg-shop-ink-raised text-shop-ink-accent group-hover:bg-shop-ink-accent inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors group-hover:text-white">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.9}
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"
                    />
                  </svg>
                </span>
                {SUPPORT_WHATSAPP_TEL}
              </a>

              <a
                href={SUPPORT_WHATSAPP_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-shop-ink-text hover:text-shop-ink-text-active group inline-flex items-center gap-2.5 text-sm transition-colors"
              >
                <span className="bg-shop-ink-raised text-shop-ink-accent group-hover:bg-shop-ink-accent inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors group-hover:text-white">
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.9}
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 20.25c4.97 0 9-3.694 9-8.25s-4.03-8.25-9-8.25S3 7.444 3 12c0 2.104.859 4.023 2.273 5.48.432.447.74 1.04.586 1.641a4.483 4.483 0 01-.923 1.785A5.969 5.969 0 006 21c1.282 0 2.47-.402 3.445-1.087.81.22 1.668.337 2.555.337z"
                    />
                  </svg>
                </span>
                Chat on WhatsApp
              </a>
            </div>
          </div>

          {/* Link groups, kept as the groups the config declares. */}
          {config.links.map((group) => (
            <nav key={group.group} aria-label={group.group}>
              <p className="text-shop-ink-muted mb-4 text-[10px] font-bold tracking-[0.2em] uppercase">
                {group.group}
              </p>
              <ul className="flex flex-col gap-3">
                {group.items.map((item) => {
                  const external = item.href.startsWith("http");
                  const classes =
                    "text-shop-ink-text hover:text-shop-ink-text-active inline-block text-sm transition-all duration-200 hover:translate-x-0.5";
                  return (
                    <li key={item.href}>
                      {external ? (
                        <a
                          href={item.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={classes}
                        >
                          {item.label}
                        </a>
                      ) : (
                        <Link href={item.href} className={classes}>
                          {item.label}
                        </Link>
                      )}
                    </li>
                  );
                })}
              </ul>
            </nav>
          ))}
        </div>

        <div className="border-shop-ink-border flex flex-col items-center justify-between gap-3 border-t py-6 sm:flex-row">
          <Typography
            as="span"
            variant="caption"
            className="text-shop-ink-muted"
          >
            © {currentYear} {config.siteName}. All rights reserved.
          </Typography>
          <Typography
            as="span"
            variant="caption"
            className="text-shop-ink-muted"
          >
            eSewa · Fonepay · Cash on delivery
          </Typography>
        </div>
      </Container>
    </footer>
  );
}
