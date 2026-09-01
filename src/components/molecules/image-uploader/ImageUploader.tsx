"use client";

import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";
import Cropper from "react-easy-crop";
import type { Area, Point } from "react-easy-crop";
import { cn } from "@/utils/cn";
import { getCroppedImageBlob } from "@/utils/crop-image";

interface ImageUploaderProps {
  label: string;
  description: string;
  currentImageUrl: string | null;
  aspectRatio: number;
  outputWidth?: number;
  outputHeight?: number;
  cropHeight?: string;
  acceptedTypes?: string;
  maxSizeMb?: number;
  onUpload: (formData: FormData) => Promise<{ success: boolean; url?: string; error?: string }>;
  onRemove?: () => Promise<{ success: boolean; error?: string }>;
  className?: string;
}

type UploaderState = "idle" | "selected" | "cropping" | "uploading";

export function ImageUploader({
  label,
  description,
  currentImageUrl,
  aspectRatio,
  outputWidth,
  outputHeight,
  cropHeight = "h-64",
  acceptedTypes = "image/png,image/jpeg,image/webp,image/svg+xml",
  maxSizeMb = 5,
  onUpload,
  onRemove,
  className,
}: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<UploaderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedArea, setCroppedArea] = useState<Area | null>(null);

  const onCropComplete = useCallback((_: Area, pixels: Area) => { setCroppedArea(pixels); }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const allowed = acceptedTypes.split(",").map((t) => t.trim());
    if (!allowed.includes(file.type)) { setError(`Invalid file type.`); return; }
    if (file.size > maxSizeMb * 1024 * 1024) { setError(`Max ${maxSizeMb}MB.`); return; }
    setSelectedFile(file);
    if (file.type === "image/svg+xml") {
      setPreviewUrl(URL.createObjectURL(file));
      setState("selected");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => { setPreviewUrl(reader.result as string); setCrop({ x: 0, y: 0 }); setZoom(1); setState("cropping"); };
    reader.onerror = () => setError("Failed to read file.");
    reader.readAsDataURL(file);
  }

  async function handleUpload() {
    if (!selectedFile && !previewUrl) return;
    setError(null);
    setState("uploading");
    try {
      let fileToUpload: File;
      if (state === "selected" || selectedFile?.type === "image/svg+xml") {
        fileToUpload = selectedFile!;
      } else if (croppedArea && previewUrl) {
        const blob = await getCroppedImageBlob(previewUrl, croppedArea, outputWidth, outputHeight);
        const baseName = (selectedFile?.name ?? "image").replace(/\.[^.]+$/, "");
        fileToUpload = new File([blob], `${baseName}.jpg`, { type: "image/jpeg" });
      } else { setError("No crop area."); setState("cropping"); return; }
      const formData = new FormData();
      formData.append("file", fileToUpload);
      formData.append("folder", label.toLowerCase().replace(/\s+/g, "-"));
      const result = await onUpload(formData);
      if (result.success) { handleReset(); } else { setError(result.error ?? "Upload failed."); setState("cropping"); }
    } catch (err) { setError(err instanceof Error ? err.message : "Upload error."); setState("cropping"); }
  }

  function handleReset() {
    setState("idle"); setPreviewUrl(null); setSelectedFile(null); setCrop({ x: 0, y: 0 }); setZoom(1); setCroppedArea(null); setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function handleRemove() {
    if (!onRemove) return;
    setError(null); setState("uploading");
    const result = await onRemove();
    if (result.success) { handleReset(); } else { setError(result.error ?? "Remove failed."); setState("idle"); }
  }

  const isUploading = state === "uploading";

  return (
    <div className={cn("rounded-2xl border border-admin-border bg-admin-surface", className)}>
      {/* Header */}
      <div className="border-b border-admin-border-subtle px-5 py-4">
        <p className="text-sm font-medium text-admin-text">{label}</p>
        <p className="mt-0.5 text-[11px] text-admin-text-muted">{description}</p>
      </div>

      <div className="p-5">
        {/* Cropper */}
        {state === "cropping" && previewUrl && (
          <div className="space-y-4">
            <div className={cn("relative w-full overflow-hidden rounded-xl bg-admin-card/50", cropHeight)}>
              <Cropper image={previewUrl} crop={crop} zoom={zoom} aspect={aspectRatio} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} objectFit="contain" showGrid={false} style={{ containerStyle: { borderRadius: "0.375rem" }, mediaStyle: { objectFit: "contain" } }} />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] text-admin-text-muted">Zoom</span>
              <input type="range" min={1} max={3} step={0.1} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-admin-border accent-admin-accent" aria-label="Zoom" />
              <span className="w-8 text-right font-mono text-[11px] text-admin-text-muted">{zoom.toFixed(1)}x</span>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleUpload} disabled={isUploading} className="rounded-xl bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-admin-accent-hover disabled:opacity-40">{isUploading ? "Uploading..." : "Save"}</button>
              <button type="button" onClick={handleReset} disabled={isUploading} className="rounded-xl border border-admin-border px-4 py-2 text-sm text-admin-text-secondary hover:bg-admin-card disabled:opacity-40">Cancel</button>
            </div>
          </div>
        )}

        {/* SVG preview */}
        {state === "selected" && previewUrl && (
          <div className="space-y-4">
            <div className="flex h-32 items-center justify-center rounded-xl bg-admin-card/50 p-4">
              <img src={previewUrl} alt="Preview" className="max-h-full max-w-full object-contain" />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={handleUpload} disabled={isUploading} className="rounded-xl bg-admin-accent px-4 py-2 text-sm font-medium text-white hover:bg-admin-accent-hover disabled:opacity-40">{isUploading ? "Uploading..." : "Save"}</button>
              <button type="button" onClick={handleReset} disabled={isUploading} className="rounded-xl border border-admin-border px-4 py-2 text-sm text-admin-text-secondary hover:bg-admin-card disabled:opacity-40">Cancel</button>
            </div>
          </div>
        )}

        {/* Idle */}
        {state === "idle" && (
          <div className="space-y-4">
            {currentImageUrl ? (
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-admin-border bg-admin-card/50 p-1.5">
                  <img src={currentImageUrl} alt={label} className="max-h-full max-w-full object-contain" />
                </div>
                <div className="flex flex-1 flex-col gap-1">
                  <p className="text-xs text-admin-text-muted">Currently set</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => inputRef.current?.click()} className="rounded-xl border border-admin-border px-3 py-1.5 text-xs text-admin-text-secondary hover:bg-admin-card hover:text-admin-text">Replace</button>
                    {onRemove && (
                      <button type="button" onClick={handleRemove} className="rounded-xl px-3 py-1.5 text-xs text-admin-danger hover:bg-admin-danger/10">Remove</button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <button type="button" onClick={() => inputRef.current?.click()} className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-admin-border bg-admin-card/50/50 px-6 py-8 transition-colors hover:border-admin-accent/40 hover:bg-admin-card/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-admin-accent">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-admin-accent/10">
                  <Upload className="h-4 w-4 text-admin-accent" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-admin-text">Click to upload</p>
                  <p className="mt-0.5 text-[11px] text-admin-text-muted">PNG, JPG, WebP, or SVG &middot; Max {maxSizeMb}MB</p>
                </div>
              </button>
            )}
          </div>
        )}

        {state === "uploading" && !previewUrl && (
          <div className="flex items-center justify-center py-8">
            <p className="text-sm text-admin-text-muted">Processing...</p>
          </div>
        )}

        {error && (
          <div role="alert" className="mt-4 rounded-xl bg-admin-danger/10 px-3 py-2 text-sm text-admin-danger">{error}</div>
        )}
      </div>

      <input ref={inputRef} type="file" accept={acceptedTypes} onChange={handleFileSelect} className="hidden" aria-label={`Upload ${label}`} />
    </div>
  );
}
