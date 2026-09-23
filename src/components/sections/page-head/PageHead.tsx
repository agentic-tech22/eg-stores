import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import { cn } from "@/utils/cn";

interface PageHeadProps {
  /** Small tinted line above the title. */
  eyebrow: string;
  title: string;
  /**
   * Sits opposite the title on a wide screen and under it on a narrow one.
   * A count, a step trail — anything that describes the page rather than
   * navigates away from it.
   */
  meta?: React.ReactNode;
  className?: string;
}

/**
 * The strip every inner storefront page opens with.
 *
 * It exists as a component because /products, /cart and /checkout each had
 * their own idea of what the top of a page looks like, and a shop that changes
 * its clothes between the grid and the cart does not read as one shop.
 *
 * Light, not ink. The dark chrome is spent where it earns its place — the
 * header, the hero and the footer, which frame the page — and a fourth black
 * band directly under the header made every inner page look like it was mostly
 * navigation, and squeezed the checkout form into what was left. Here a tinted
 * strip and a rule are enough to separate the title from the content.
 */
export function PageHead({ eyebrow, title, meta, className }: PageHeadProps) {
  return (
    <section className={cn("bg-surface border-border/70 border-b", className)}>
      <Container>
        <div className="flex flex-col gap-2 py-7 lg:py-9">
          <Typography
            variant="label"
            className="text-secondary motion-safe:animate-rise"
          >
            {eyebrow}
          </Typography>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <Typography
              variant="h2"
              className="text-text-primary motion-safe:animate-rise [animation-delay:80ms]"
            >
              {title}
            </Typography>
            {meta && (
              <div className="motion-safe:animate-rise [animation-delay:160ms]">
                {meta}
              </div>
            )}
          </div>
        </div>
      </Container>
    </section>
  );
}
