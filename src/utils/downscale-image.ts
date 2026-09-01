/** Longest edge, in pixels, a downscaled photo is kept at. */
const DEFAULT_MAX_EDGE = 1600;

/** JPEG quality of the re-encoded image; high enough to keep ID text legible. */
const DEFAULT_QUALITY = 0.85;

/**
 * Shrink a photo in the browser before it is sent to a Server Action.
 *
 * Two reasons this is not optional. A Server Action request body is capped at
 * 1MB by default, and a phone camera shot of an ID card is several times that,
 * so an un-resized upload fails outright. And a 4000px original is far more
 * detail than anyone reading a citizenship number needs, so downscaling also
 * keeps the stored document small.
 *
 * Returns the original file untouched when the image is already within bounds,
 * or when the browser cannot give us a canvas to work with — the caller's size
 * validation still applies either way.
 */
export async function downscaleImage(
  file: File,
  maxEdge: number = DEFAULT_MAX_EDGE,
  quality: number = DEFAULT_QUALITY,
): Promise<File> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = await loadImage(objectUrl);
    const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
    // Already small enough, and re-encoding would only lose quality.
    if (scale === 1 && file.size <= 1_000_000) return file;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    if (!blob) return file;

    const name = file.name.replace(/\.[^.]+$/, "") || "photo";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } catch {
    return file;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load image."));
    img.src = src;
  });
}
