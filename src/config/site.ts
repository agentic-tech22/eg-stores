export const siteConfig = {
  defaultSiteName: "EG Stores",
  // Shown under the logo in the storefront footer, so it describes the shop to a
  // customer. It used to read "sold and tracked in one place", which described
  // the software to its operator, and claimed repairs the shop does not do.
  defaultDescription:
    "Mobile accessories and everyday gadgets — audio, charging, wearables and more, from a counter you can walk into.",
  defaultFontFamily: "Work Sans",
  // Public Google Drive video shown in the landing page's "Watch the product"
  // modal. Paste any Drive share link, e.g.
  // https://drive.google.com/file/d/<FILE_ID>/view?usp=sharing, and the player
  // converts it to Drive's optimized /preview stream. The file must be shared
  // as "Anyone with the link". Leave the FILE_ID placeholder (or set "") and the
  // modal shows a "video coming soon" message instead of a broken embed.
  productVideoUrl:
    "https://drive.google.com/file/d/19DBY9YKHDkNDO-2BbLXXsuAEv9VfPgis/view?usp=sharing",
} as const;
