import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import { cn } from "@/utils/cn";

export interface ValueProp {
  /** SVG path data for a 24×24 stroked icon. */
  iconPath: string;
  title: string;
  body: string;
}

interface ValuePropsProps {
  items: ValueProp[];
  title: string;
  eyebrow?: string;
  description?: string;
  className?: string;
  id?: string;
}

export function ValueProps({
  items,
  title,
  eyebrow,
  description,
  className,
  id,
}: ValuePropsProps) {
  if (items.length === 0) return null;

  return (
    <section id={id} className={cn("py-16 lg:py-24", className)}>
      <Container>
        <div className="mb-12 flex flex-col items-center gap-3 text-center">
          {eyebrow && (
            <Typography variant="label" className="text-secondary">
              {eyebrow}
            </Typography>
          )}
          <Typography variant="h2" className="text-text-primary">
            {title}
          </Typography>
          {description && (
            <Typography
              variant="body"
              className="text-text-secondary max-w-2xl"
            >
              {description}
            </Typography>
          )}
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.title}
              className="border-border/60 bg-background hover:border-primary/30 hover:shadow-primary/5 flex h-full flex-col gap-4 rounded-2xl border p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
            >
              <span className="bg-primary/10 text-primary inline-flex h-11 w-11 items-center justify-center rounded-xl">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.8}
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

              <Typography as="h3" variant="h4" className="text-text-primary">
                {item.title}
              </Typography>
              <Typography variant="bodySmall" className="text-text-secondary">
                {item.body}
              </Typography>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
