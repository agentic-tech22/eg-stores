import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import { cn } from "@/utils/cn";

export interface FaqItem {
  question: string;
  answer: string;
}

interface FaqProps {
  items: FaqItem[];
  title: string;
  eyebrow?: string;
  description?: string;
  /** Tint the section to separate it from the block above. */
  surface?: boolean;
  className?: string;
  id?: string;
}

/**
 * Expandable question list.
 *
 * Built on <details>/<summary> rather than React state so it stays a server
 * component: open/close is native browser behaviour, keyboard support and the
 * accessibility tree come for free, and the answers are in the HTML where search
 * engines can read them. A JS accordion would cost a client bundle for less.
 */
export function Faq({
  items,
  title,
  eyebrow,
  description,
  surface = false,
  className,
  id,
}: FaqProps) {
  if (items.length === 0) return null;

  return (
    <section
      id={id}
      className={cn("py-16 lg:py-24", surface && "bg-surface", className)}
    >
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
            <Typography variant="body" className="text-text-secondary max-w-2xl">
              {description}
            </Typography>
          )}
        </div>

        <div className="mx-auto flex max-w-3xl flex-col gap-4">
          {items.map((item) => (
            <details
              key={item.question}
              className="group border-border/60 bg-background hover:border-primary/30 rounded-2xl border px-6 py-5 transition-colors"
            >
              <summary className="focus-visible:ring-ring flex cursor-pointer list-none items-center justify-between gap-4 rounded-md focus-visible:ring-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                <Typography
                  as="span"
                  variant="body"
                  className="font-heading text-text-primary font-semibold"
                >
                  {item.question}
                </Typography>
                <span
                  aria-hidden="true"
                  className="text-secondary shrink-0 transition-transform duration-300 group-open:rotate-45"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.8}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 4.5v15m7.5-7.5h-15"
                    />
                  </svg>
                </span>
              </summary>
              <Typography
                variant="bodySmall"
                className="text-text-secondary mt-4"
              >
                {item.answer}
              </Typography>
            </details>
          ))}
        </div>
      </Container>
    </section>
  );
}
