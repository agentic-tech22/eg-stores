import { Container } from "@/components/atoms/container/Container";
import { SectionTitle } from "@/components/molecules/section-title/SectionTitle";
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

/**
 * "Why buy from us": four reasons, each a tinted icon over a short centred
 * paragraph. No cards around them; the section is a pause between the product
 * grids, and boxes would make it read as four more things to click.
 */
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
    <section id={id} className={cn("py-14 lg:py-20", className)}>
      <Container>
        <SectionTitle
          title={title}
          eyebrow={eyebrow}
          description={description}
          className="lg:mb-16"
        />

        <div className="grid grid-cols-1 gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item) => (
            <div
              key={item.title}
              className="flex flex-col items-center gap-3 text-center"
            >
              <span className="bg-primary-soft text-primary mb-3 inline-flex h-16 w-16 items-center justify-center rounded-full">
                <svg
                  className="h-7 w-7"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.6}
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

              <h3 className="font-heading text-text-primary text-lg font-bold">
                {item.title}
              </h3>
              <p className="text-text-secondary max-w-[17rem] text-sm leading-relaxed">
                {item.body}
              </p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
