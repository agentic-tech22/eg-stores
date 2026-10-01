"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Container } from "@/components/atoms/container/Container";
import { Typography } from "@/components/atoms/typography";
import { cn } from "@/utils/cn";
import { slideOffset, slidePose, wrapIndex } from "./carousel-position";

export interface HeroSlide {
  id: string;
  imageUrl: string;
  /** Small tinted line above the headline. */
  eyebrow?: string;
  title: string;
  /** Tinted second half of the headline. */
  titleAccent?: string;
  description?: string;
  cta?: { label: string; href: string };
}

interface HeroCarouselProps {
  slides: HeroSlide[];
  /** Milliseconds between advances. 0 turns auto-play off. */
  interval?: number;
  className?: string;
}

/** How far a swipe has to travel before it counts as one. */
const SWIPE_THRESHOLD = 48;

function ArrowIcon({ back = false }: { back?: boolean }) {
  return (
    <svg
      className={cn("h-5 w-5", back && "rotate-180")}
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
      />
    </svg>
  );
}

/**
 * The home page's opening carousel.
 *
 * The hero it replaces was one still photograph and a headline, which said
 * everything it had to say in the first second and then just sat there. A shop
 * front page has more than one thing worth leading with — what the shop is, and
 * what is actually on the shelves — and a carousel is how it gets to say all of
 * them without four screens of scrolling.
 *
 * Slides are stacked rather than laid side by side: the neighbours sit behind
 * the active one, scaled down and bleeding off the edges of the stage, so the
 * peek itself tells you there is more to come. The maths for that lives in
 * carousel-position, which is where to look before changing how it feels.
 *
 * Auto-play stops on hover, on keyboard focus, and entirely under
 * `prefers-reduced-motion` — a hero that keeps moving while someone is reading
 * it or tabbing through it is working against them.
 */
export function HeroCarousel({
  slides,
  interval = 5000,
  className,
}: HeroCarouselProps) {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const dragStartX = useRef<number | null>(null);

  const total = slides.length;

  const go = useCallback(
    (delta: number) => setActive((current) => wrapIndex(current, delta, total)),
    [total],
  );

  useEffect(() => {
    if (paused || interval <= 0 || total < 2) return;
    // Someone who has asked for less motion should not be handed a hero that
    // rearranges itself every few seconds.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const timer = window.setInterval(() => go(1), interval);
    return () => window.clearInterval(timer);
    // `active` is a dependency so the clock restarts whenever the slide
    // changes. Without it, picking a dot could be followed a hundred
    // milliseconds later by an auto-advance off the slide you just chose.
  }, [paused, interval, total, go, active]);

  if (total === 0) return null;

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      go(1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      go(-1);
    }
  }

  // Pointer events rather than touch events, which is what "swipe" meant the
  // first time round: touch events never fire for a mouse, so dragging the
  // carousel on a desktop did precisely nothing. Pointer events cover mouse,
  // touch and pen through one pair of handlers.
  function handlePointerDown(event: React.PointerEvent) {
    // Left button only; a right-click drag is not a swipe.
    if (event.pointerType === "mouse" && event.button !== 0) return;
    dragStartX.current = event.clientX;
  }

  function handlePointerUp(event: React.PointerEvent) {
    const start = dragStartX.current;
    dragStartX.current = null;
    if (start === null) return;
    const travelled = event.clientX - start;
    // Below the threshold this was a click, not a drag, so leave it to
    // whatever was clicked.
    if (Math.abs(travelled) < SWIPE_THRESHOLD) return;
    go(travelled < 0 ? 1 : -1);
  }

  return (
    <section
      className={cn("bg-shop-ink relative overflow-hidden", className)}
      aria-roledescription="carousel"
      aria-label="Featured"
      onKeyDown={handleKeyDown}
    >
      {/* Ambient wash, so the ink behind the stack is not flat black. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(50rem_30rem_at_50%_-20%,rgba(139,123,255,0.22),transparent_70%)]"
      />

      <Container className="relative">
        {/* Hover and focus pause the carousel, but only over the card and its
            controls. Hanging these off the <section> meant the full-width
            margins either side counted too, so on a wide screen a cursor
            resting anywhere near the top of the page held it still and it
            looked like autoplay was broken. */}
        <div
          className="mx-auto max-w-4xl py-8 lg:py-12"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={() => setPaused(false)}
        >
          {/* Stage. Neighbours are allowed to overflow it and are clipped by
              the section instead, which is what produces the peek.

              `touch-pan-y` lets a vertical drag scroll the page as usual while
              leaving horizontal drags to us; `select-none` stops a swipe
              highlighting the headline on the way past. */}
          <div
            className="relative h-[24rem] touch-pan-y select-none sm:h-[26rem] lg:h-[30rem]"
            onPointerDown={handlePointerDown}
            onPointerUp={handlePointerUp}
            onPointerCancel={() => {
              dragStartX.current = null;
            }}
          >
            {slides.map((slide, index) => {
              const offset = slideOffset(index, active, total);
              const pose = slidePose(offset);
              const isActive = offset === 0;

              return (
                <article
                  key={slide.id}
                  aria-hidden={!isActive}
                  aria-roledescription="slide"
                  aria-label={`${index + 1} of ${total}`}
                  className={cn(
                    "border-shop-ink-border absolute inset-0 overflow-hidden rounded-3xl border shadow-2xl shadow-black/60 transition-[transform,opacity] duration-700 ease-out",
                    !isActive && "pointer-events-none",
                  )}
                  style={{
                    transform: `translateX(${pose.translate}%) scale(${pose.scale})`,
                    opacity: pose.opacity,
                    zIndex: pose.zIndex,
                  }}
                >
                  {/* Product and cover photos are arbitrary remote URLs, as
                      everywhere else on the storefront. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={slide.imageUrl}
                    alt=""
                    // The first slide is the largest thing above the fold.
                    fetchPriority={index === 0 ? "high" : "auto"}
                    // Otherwise the browser's native image drag hijacks the
                    // swipe and you end up dragging a ghost of the photo.
                    draggable={false}
                    className="absolute inset-0 h-full w-full object-cover"
                  />

                  {/* Scrim, in two layers that have to be read together: they
                      stack, so their opacities compound rather than average. At
                      solid ink across the middle plus 90% along the bottom, the
                      first version buried the photograph almost everywhere and
                      the slide may as well have been a dark card with a caption.

                      Now the horizontal layer does the work and gives up by
                      halfway, and the vertical one is a light footing under the
                      CTA rather than a second full-strength wash. Legibility no
                      longer rests on them alone — the copy carries its own
                      shadow, which is what lets the photograph through across
                      the right-hand side of the card. */}
                  <div
                    aria-hidden="true"
                    className="from-shop-ink/85 via-shop-ink/35 absolute inset-0 bg-linear-to-r via-50% to-transparent"
                  />
                  <div
                    aria-hidden="true"
                    className="from-shop-ink/45 absolute inset-0 bg-linear-to-t via-transparent via-45% to-transparent"
                  />

                  <div className="relative flex h-full max-w-xl flex-col justify-end gap-3 p-6 sm:p-10 lg:gap-4 lg:p-12">
                    {slide.eyebrow && (
                      <Typography
                        variant="label"
                        className="border-shop-ink-border bg-shop-ink-raised/80 text-shop-ink-text w-fit rounded-full border px-3 py-1 backdrop-blur-sm"
                      >
                        {slide.eyebrow}
                      </Typography>
                    )}

                    <Typography
                      variant="h2"
                      className="text-shop-ink-text-active text-balance [text-shadow:0_2px_14px_rgba(0,0,0,0.55)]"
                    >
                      {slide.title}
                      {slide.titleAccent && (
                        <>
                          {" "}
                          <span className="text-shop-ink-accent">
                            {slide.titleAccent}
                          </span>
                        </>
                      )}
                    </Typography>

                    {slide.description && (
                      <Typography
                        variant="body"
                        className="text-shop-ink-text max-w-md text-pretty [text-shadow:0_2px_12px_rgba(0,0,0,0.5)]"
                      >
                        {slide.description}
                      </Typography>
                    )}

                    {slide.cta && (
                      <Link
                        href={slide.cta.href}
                        // Off-centre slides are decoration; they must not be
                        // reachable by tab or announced as links.
                        tabIndex={isActive ? undefined : -1}
                        className="bg-shop-ink-accent hover:bg-shop-ink-accent/85 focus-visible:ring-shop-ink-accent focus-visible:ring-offset-shop-ink mt-1 inline-flex h-11 w-fit items-center justify-center rounded-full px-7 text-xs font-bold tracking-wide text-white shadow-lg shadow-black/30 transition-all duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                      >
                        {slide.cta.label}
                      </Link>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          {/* Controls */}
          {total > 1 && (
            <div className="mt-6 flex items-center justify-center gap-5">
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous slide"
                className="border-shop-ink-border text-shop-ink-text hover:border-shop-ink-accent/60 hover:text-shop-ink-text-active flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border transition-colors"
              >
                <ArrowIcon back />
              </button>

              <div className="flex items-center gap-2">
                {slides.map((slide, index) => {
                  const isActive = index === active;
                  return (
                    <button
                      key={slide.id}
                      type="button"
                      onClick={() => setActive(index)}
                      aria-label={`Go to slide ${index + 1}`}
                      aria-current={isActive ? "true" : undefined}
                      className={cn(
                        "h-2 cursor-pointer rounded-full transition-all duration-300",
                        isActive
                          ? "bg-shop-ink-accent w-7"
                          : "bg-shop-ink-text/40 hover:bg-shop-ink-text/70 w-2",
                      )}
                    />
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next slide"
                className="border-shop-ink-border text-shop-ink-text hover:border-shop-ink-accent/60 hover:text-shop-ink-text-active flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border transition-colors"
              >
                <ArrowIcon />
              </button>
            </div>
          )}
        </div>
      </Container>
    </section>
  );
}
