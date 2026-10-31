import Link from "next/link";
import { Container } from "@/components/atoms/container/Container";
import { cn } from "@/utils/cn";

interface ImageBannerProps {
  imageUrl: string;
  eyebrow?: string;
  title: string;
  description?: string;
  cta?: { label: string; href: string };
  className?: string;
  id?: string;
}

/**
 * A full-bleed photograph with copy over its left side: the page's one dark,
 * cinematic beat between the white sections either side.
 *
 * The scrim runs left to right and gives up past the middle, so the copy
 * column is legible and the right of the photograph is left alone.
 */
export function ImageBanner({
  imageUrl,
  eyebrow,
  title,
  description,
  cta,
  className,
  id,
}: ImageBannerProps) {
  return (
    <section
      id={id}
      className={cn("relative overflow-hidden bg-black", className)}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={imageUrl}
        alt=""
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-linear-to-r from-black/85 via-black/60 via-50% to-black/20"
      />

      <Container className="relative">
        <div className="flex max-w-3xl flex-col items-start gap-5 py-20 lg:py-32">
          {eyebrow && (
            <p className="text-shop-ink-accent text-sm font-medium tracking-[0.12em] uppercase">
              {eyebrow}
            </p>
          )}
          <h2 className="font-heading text-4xl leading-[1.1] font-normal text-balance text-white md:text-5xl lg:text-6xl">
            {title}
          </h2>
          {description && (
            <p className="max-w-2xl text-base leading-relaxed text-white/85 md:text-lg">
              {description}
            </p>
          )}
          {cta && (
            <Link
              href={cta.href}
              className="bg-primary hover:bg-secondary focus-visible:ring-offset-black mt-2 inline-flex h-12 items-center justify-center px-7 text-base font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {cta.label}
            </Link>
          )}
        </div>
      </Container>
    </section>
  );
}
