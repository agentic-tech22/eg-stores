import { cn } from "@/utils/cn";

type SectionTitleVariant = "bold" | "spaced";

interface SectionTitleProps {
  title: string;
  /**
   * Small letter-spaced line above the title, ruled either side. Use it for a
   * section that needs a frame ("Come say hello"), not on every heading: the
   * page reads cleaner when most titles stand on their own.
   */
  eyebrow?: string;
  description?: string;
  /**
   * `bold` is the storefront's ordinary heading. `spaced` is the wide-tracked
   * brand-red caps reserved for the one product showcase on the page; used
   * more than once it stops reading as the headline section.
   */
  variant?: SectionTitleVariant;
  as?: "h1" | "h2";
  className?: string;
}

const titleClasses: Record<SectionTitleVariant, string> = {
  bold: "text-text-primary text-2xl font-bold tracking-tight md:text-[2rem] md:leading-tight",
  spaced:
    "text-accent text-xl font-normal tracking-[0.3em] uppercase md:text-[2.25rem] md:tracking-[0.25em]",
};

/**
 * The centred heading every home page section opens with, so the page keeps
 * one rhythm from top to bottom instead of each section setting its own.
 */
export function SectionTitle({
  title,
  eyebrow,
  description,
  variant = "bold",
  as: Tag = "h2",
  className,
}: SectionTitleProps) {
  return (
    <div
      className={cn(
        "mb-10 flex flex-col items-center gap-4 text-center lg:mb-12",
        className,
      )}
    >
      {eyebrow && (
        <p className="text-accent flex items-center gap-4 text-[11px] font-medium tracking-[0.3em] uppercase">
          <span aria-hidden="true" className="bg-accent/60 h-px w-10" />
          {eyebrow}
          <span aria-hidden="true" className="bg-accent/60 h-px w-10" />
        </p>
      )}
      <Tag className={cn("font-heading text-balance", titleClasses[variant])}>
        {title}
      </Tag>
      {description && (
        <p className="text-text-secondary max-w-2xl text-sm leading-relaxed md:text-base">
          {description}
        </p>
      )}
    </div>
  );
}
