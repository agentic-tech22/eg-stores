import { Composition } from "remotion";
import { HeroVideo, type HeroVideoProps } from "./HeroVideo";

/**
 * Hero showcase loop for the EG Stores landing page.
 *
 * Designed as a *seamless ambient loop*: every motion is periodic with a
 * period that divides the 8s duration evenly, so the rendered video can be
 * played with `loop` without a visible seam. Render with:
 *
 *   pnpm hero:render
 */
export const RemotionRoot = () => {
  return (
    <>
      {/* Dashboard-only loop embedded in the landing hero (live HTML headline sits above it). */}
      <Composition
        id="HeroShowcase"
        component={HeroVideo}
        durationInFrames={240}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ showHeadline: false } satisfies HeroVideoProps}
      />
      {/* Full headline version, handy for social/OG share clips. */}
      <Composition
        id="HeroSocial"
        component={HeroVideo}
        durationInFrames={240}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{ showHeadline: true } satisfies HeroVideoProps}
      />
    </>
  );
};
