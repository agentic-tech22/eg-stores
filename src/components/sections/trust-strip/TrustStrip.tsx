import { Container } from "@/components/atoms/container/Container";
import { ScrollReveal } from "@/components/atoms/scroll-reveal/ScrollReveal";
import { Typography } from "@/components/atoms/typography";
import { cn } from "@/utils/cn";

export interface TrustPoint {
  /** SVG path data for a 24x24 stroked icon. */
  iconPath: string;
  title: string;
  /** One short line. Anything longer belongs on /why-us. */
  detail: string;
}

interface TrustStripProps {
  items: TrustPoint[];
  className?: string;
}

/**
 * The band of reassurances directly under the hero.
 *
 * Distinct from ValueProps further down the page, and deliberately thinner: the
 * job here is to answer "is this shop real and will my money be safe" in the
 * two seconds before the shopper scrolls, not to argue the case. Four items,
 * one line each. The argument is what /why-us is for.
 */
export function TrustStrip({ items, className }: TrustStripProps) {
  if (items.length === 0) return null;

  return (
    <section className={cn("border-border/70 border-b py-8", className)}>
      <Container>
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 lg:grid-cols-4">
          {items.map((item, index) => (
            /* The separators only appear at `lg`, where the four items are a
               single row. `divide-x` would have been shorter and wrong: on the
               two-column layout it draws a rule down the left of every item but
               the first, including the ones that start a new row. */
            <ScrollReveal
              key={item.title}
              delay={index * 80}
              className="lg:border-border/70 lg:border-l lg:first:border-l-0"
            >
              <div className="flex items-start gap-3 lg:px-5">
                <span className="bg-primary/10 text-primary inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl">
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.9}
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d={item.iconPath}
                    />
                  </svg>
                </span>
                <div className="min-w-0">
                  <Typography
                    as="p"
                    variant="bodySmall"
                    className="font-heading text-text-primary font-bold"
                  >
                    {item.title}
                  </Typography>
                  <Typography
                    variant="caption"
                    className="text-text-secondary mt-0.5 block"
                  >
                    {item.detail}
                  </Typography>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </Container>
    </section>
  );
}
