// Shop-floor details for the home page’s visit section.
//
// Address and phone deliberately do NOT live here: those come from the shop's
// business profile (Settings → Business) via `fetchMembershipShopInfo`, so they
// stay correct without a redeploy. Opening hours have no home in the database
// yet, so they sit here as the single place to edit them.
//
// !! These hours are placeholders. Replace them with the shop's real timings
// before this goes live — a wrong closing time sends someone to a shut
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

export interface StorePoster {
  /** Path under public/, or a remote URL. */
  imageUrl: string;
  /** Headline in the pill across the top of the poster. */
  title: string;
  /**
   * What the poster searches /products for. Matched against product titles,
   * descriptions and category names, so keep it to a word the catalogue
   * actually uses — a poster that lands on "Nothing matches" is a dead end.
   */
  query: string;
  /** Pill along the bottom. */
  ctaLabel: string;
}

/**
 * The promo posters that open the home page, each linking to a search.
 *
 * Photographs are from Unsplash, under the Unsplash License (free for
 * commercial use, no attribution required), and are copied into
 * public/assets/images/posters so a change on Unsplash cannot blank the front
 * page:
 *   watch.jpg       unsplash.com/photos/vRcSC-UN3yI
 *   earbuds.jpg     unsplash.com/photos/rN1hLIGV4gE
 *   headphones.jpg  unsplash.com/photos/P7KF3cTRKcE
 *   powerbank.jpg   unsplash.com/photos/47WaiMrtWVM
 *   speaker.jpg     unsplash.com/photos/aqQmLO30QJc
 *
 * They are stock photography, not this shop's stock: swap any of them for
 * the shop's own campaign artwork when it has some. The first three sit in
 * the top row of the grid; the fourth and fifth share the row below, the
 * fifth wide.
 */
export const STORE_POSTERS: StorePoster[] = [
  {
    imageUrl: "/assets/images/posters/watch.jpg",
    title: "Watches for every wrist",
    query: "watch",
    ctaLabel: "Now available",
  },
  {
    imageUrl: "/assets/images/posters/earbuds.jpg",
    title: "Wireless Earbuds",
    query: "earbuds",
    ctaLabel: "Now available",
  },
  {
    imageUrl: "/assets/images/posters/headphones.jpg",
    title: "Over-ear Headphones",
    query: "headphone",
    ctaLabel: "Now available",
  },
  {
    imageUrl: "/assets/images/posters/powerbank.jpg",
    title: "Power Banks",
    query: "powerbank",
    ctaLabel: "Charge on the go",
  },
  {
    imageUrl: "/assets/images/posters/speaker.jpg",
    title: "Bluetooth Speakers",
    query: "speaker",
    ctaLabel: "Now available",
  },
];

/**
 * Photographs for the home page's category tiles, keyed by category name.
 *
 * Keyed by name rather than id because ids differ between databases and a
 * name is what someone editing this file can read. Matching ignores case and
 * surrounding space. Both the shop's own spelling and the correct one are
 * listed where they differ ("Charger Adpter"), so fixing the typo in the
 * dashboard does not drop the photo.
 *
 * Categories listed here lead the grid; the rest fall back to a photo of one
 * of their own products. All are from Unsplash under the Unsplash License
 * (free for commercial use, no attribution required), copied into
 * public/assets/images/categories:
 *   mens-watch.jpg       unsplash.com/photos/LLOeIZFujCU
 *   ladies-watch.jpg     unsplash.com/photos/srz9C0zRMt4
 *   earbuds.jpg          unsplash.com/photos/wn_OWeQptbE
 *   charger-adapter.jpg  unsplash.com/photos/-DY5znt0Whs
 *   cable-charger.jpg    unsplash.com/photos/OJJhibC7cEM
 *   powerbank.jpg        unsplash.com/photos/RKURAxSs9Ao
 *   microphone.jpg       unsplash.com/photos/mWghYOJ8i1I
 *   phone-holder.jpg     unsplash.com/photos/PxkNzkSZ8LM
 *   headphone.jpg        unsplash.com/photos/ax23KYiUdJc
 *   speaker.jpg          unsplash.com/photos/eMw1fBx4_Wk
 *   iphone-cover.jpg     unsplash.com/photos/1iV9CSMrxbk
 *   smart-watch.jpg      unsplash.com/photos/BR8MqYyOPiU
 */
const CATEGORY_IMAGE_DIR = "/assets/images/categories";

export const CATEGORY_IMAGES: Record<string, string> = {
  "jens watch": `${CATEGORY_IMAGE_DIR}/mens-watch.jpg`,
  "mens watch": `${CATEGORY_IMAGE_DIR}/mens-watch.jpg`,
  "ladies watch": `${CATEGORY_IMAGE_DIR}/ladies-watch.jpg`,
  earbuds: `${CATEGORY_IMAGE_DIR}/earbuds.jpg`,
  "charger adpter": `${CATEGORY_IMAGE_DIR}/charger-adapter.jpg`,
  "charger adapter": `${CATEGORY_IMAGE_DIR}/charger-adapter.jpg`,
  "cable charger": `${CATEGORY_IMAGE_DIR}/cable-charger.jpg`,
  powerbank: `${CATEGORY_IMAGE_DIR}/powerbank.jpg`,
  microphone: `${CATEGORY_IMAGE_DIR}/microphone.jpg`,
  "phone holder": `${CATEGORY_IMAGE_DIR}/phone-holder.jpg`,
  headphone: `${CATEGORY_IMAGE_DIR}/headphone.jpg`,
  speaker: `${CATEGORY_IMAGE_DIR}/speaker.jpg`,
  "iphone cover": `${CATEGORY_IMAGE_DIR}/iphone-cover.jpg`,
  "smart watch": `${CATEGORY_IMAGE_DIR}/smart-watch.jpg`,
};

/** The curated photo for a category name, or null when there is none. */
export function categoryImageFor(name: string): string | null {
  return CATEGORY_IMAGES[name.trim().toLowerCase()] ?? null;
}
