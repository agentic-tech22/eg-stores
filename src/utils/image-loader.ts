import type { ImageLoaderProps } from "next/image";

export function supabaseImageLoader({ src, width, quality }: ImageLoaderProps): string {
  if (src.startsWith("http")) {
    return `${src}?width=${width}&quality=${quality ?? 75}`;
  }
  return src;
}
