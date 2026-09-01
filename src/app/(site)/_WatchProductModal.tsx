"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { siteConfig } from "@/config/site";
import { PlayCircle } from "./_icons";

/**
 * Converts any Google Drive share link into Drive's optimized `/preview`
 * streaming embed (which handles range requests, adaptive quality and
 * fullscreen, unlike a raw `uc?export=download` URL in a <video> tag).
 * Returns null when no real file id can be parsed (e.g. the placeholder), so
 * the caller can show a friendly fallback instead of a broken iframe.
 */
function toDrivePreviewUrl(url: string): string | null {
  if (!url) return null;
  const id =
    url.match(/\/file\/d\/([^/]+)/)?.[1] ?? url.match(/[?&]id=([^&]+)/)?.[1];
  if (!id || id === "FILE_ID") return null;
  return `https://drive.google.com/file/d/${id}/preview`;
}

const previewUrl = toDrivePreviewUrl(siteConfig.productVideoUrl);

export function WatchProductModal() {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/20 px-7 text-sm font-medium text-white/90 backdrop-blur-sm transition-colors duration-200 hover:bg-white/10">
        <PlayCircle className="h-5 w-5" />
        Watch the product
      </DialogTrigger>

      <DialogContent className="w-[95vw] max-w-4xl overflow-hidden border-white/10 bg-black p-0 text-white sm:max-w-4xl">
        <DialogTitle className="sr-only">Product video</DialogTitle>
        <div className="relative aspect-video w-full bg-black">
          {previewUrl ? (
            // Mounted only while the dialog is open (Radix unmounts content on
            // close), so the video stops and frees the connection on close.
            <iframe
              src={previewUrl}
              title="Product video"
              allow="autoplay; encrypted-media; fullscreen"
              allowFullScreen
              className="absolute inset-0 h-full w-full border-0"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
              <PlayCircle className="h-10 w-10 text-white/50" />
              <p className="text-sm font-medium text-white/80">
                Product video coming soon
              </p>
              <p className="text-xs text-white/50">
                Add a Google Drive link in <code>siteConfig.productVideoUrl</code>.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
