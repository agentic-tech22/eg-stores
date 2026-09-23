// Shop-floor details for the public /visit page.
//
// Address and phone deliberately do NOT live here: those come from the shop's
// business profile (Settings → Business) via `fetchMembershipShopInfo`, so they
// stay correct without a redeploy. Opening hours have no home in the database
// yet, so they sit here as the single place to edit them.
//
// !! These hours are placeholders. Replace them with the shop's real timings
// before this page goes live — a wrong closing time sends someone to a shut
// shutter, which is worse than showing no hours at all.

export interface OpeningHours {
  /** Day or range, e.g. "Sunday – Friday". */
  days: string;
  /** Hours, or the word used when closed. */
  hours: string;
  /** Renders muted, for the closed day. */
  closed?: boolean;
}

export const STORE_HOURS: OpeningHours[] = [
  { days: "Sunday – Thursday", hours: "10:00 am – 7:30 pm" },
  { days: "Friday", hours: "10:00 am – 6:00 pm" },
  { days: "Saturday", hours: "Closed", closed: true },
];

/**
 * Landmark directions, shown under the map. Kept as free text rather than
 * structured fields because "opposite the pharmacy, first floor" is how people
 * actually find a shop in Nepal, and that does not fit a schema.
 *
 * Set to null to hide the block entirely rather than showing a vague placeholder.
 */
export const STORE_DIRECTIONS: string | null = null;

/**
 * Google Maps embed for an address, with no API key required.
 *
 * The keyless `output=embed` form is used on purpose: an API-key embed would put
 * a billable key in the client bundle for what is a static pin on a shop page.
 */
export function mapEmbedUrl(address: string): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;
}

/** Turn-by-turn directions in the visitor's own maps app. */
export function mapDirectionsUrl(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

/**
 * The home page hero.
 *
 * `coverImage` is the photograph behind the headline: the shop's own counter
 * shot of the Omega automatic, chosen because it is the only watch photo in
 * the catalogue that is already lit for this — dark, with the display case and
 * the EG Store sign behind it — rather than a flat-lay on a white desk, which
 * goes grey under the hero's ink wash.
 *
 * It is copied into `public/assets/images/` rather than linked from the
 * product that supplied it, so re-photographing or deleting that product
 * cannot blank the front page. Swap the file, or point this at another path
 * or a remote URL.
 *
 * Set it to null and the hero falls back to the shop's own product
 * photography, blurred into a wash behind the headline. That fallback is
 * deliberate: a stock photo of a generic phone shop is worse than no photo at
 * all, because it is the one thing on the page that is not actually this shop.
 */
export const STORE_HERO: {
  coverImage: string | null;
  tagline: string;
} = {
  coverImage: "/assets/images/hero-cover.jpg",
  tagline: "Mobile accessories · Audio · Charging · Wearables",
};
