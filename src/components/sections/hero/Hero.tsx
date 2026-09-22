import { Button } from "@/components/atoms/button/Button";
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import { cn } from "@/utils/cn";

interface HeroProps {
  eyebrow?: string;
  title: string;
  /** Second line of the headline, tinted with the brand gradient. */
  titleAccent?: string;
  description: string;
  primaryCta: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  /** Short trust points shown under the buttons. Hidden when empty. */
  highlights?: string[];
  className?: string;
}

export function Hero({
  eyebrow,
  title,
  titleAccent,
  description,
  primaryCta,
  secondaryCta,
  highlights = [],
  className,
}: HeroProps) {
  return (
    <section
      className={cn("relative overflow-hidden py-20 lg:py-28", className)}
    >
      {/* Ambient brand wash. Decorative only, so it stays out of the a11y tree. */}
      <div
        aria-hidden="true"
        className="bg-secondary/10 pointer-events-none absolute -top-32 -left-24 h-[28rem] w-[28rem] rounded-full blur-3xl"
      />
      <div
        aria-hidden="true"
        className="bg-primary/10 pointer-events-none absolute -right-24 bottom-0 h-[26rem] w-[26rem] rounded-full blur-3xl"
      />

      <Container className="relative z-10">
        <div className="mx-auto flex max-w-3xl flex-col items-center gap-7 text-center">
          {eyebrow && (
            <Typography
              variant="label"
              className="bg-secondary/10 text-secondary rounded-full px-4 py-1.5"
            >
              {eyebrow}
            </Typography>
          )}

          <Typography variant="display" className="text-text-primary">
            {title}
            {titleAccent && (
              <>
                {" "}
                <span className="from-primary via-secondary to-accent bg-gradient-to-r bg-clip-text text-transparent">
                  {titleAccent}
                </span>
              </>
            )}
          </Typography>

          <Typography
            variant="bodyLarge"
            className="text-text-secondary max-w-2xl"
          >
            {description}
          </Typography>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button href={primaryCta.href} size="lg">
              {primaryCta.label}
            </Button>
            {secondaryCta && (
              <Button href={secondaryCta.href} size="lg" variant="outline">
                {secondaryCta.label}
              </Button>
            )}
          </div>

          {highlights.length > 0 && (
            <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2">
              {highlights.map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <svg
                    className="text-primary h-4 w-4 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={2.2}
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M4.5 12.75l6 6 9-13.5"
                    />
                  </svg>
                  <Typography
                    as="span"
                    variant="bodySmall"
                    className="text-text-secondary"
                  >
                    {item}
                  </Typography>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Container>
    </section>
  );
}
