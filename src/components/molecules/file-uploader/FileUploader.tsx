"use client";

import { useRef, useState } from "react";
import { FileText, Paperclip, Upload, X } from "lucide-react";
import { cn } from "@/utils/cn";
import type { VendorAttachment } from "@/types/vendor.types";

interface FileUploaderProps {
  label?: string;
  description?: string;
  /** Already-attached files. */
  attachments: VendorAttachment[];
  /** Uploads one file and returns its public URL. */
  onUpload: (
    formData: FormData,
  ) => Promise<{ success: boolean; url?: string; error?: string }>;
  /** Called with the new file after a successful upload. */
  onAdd: (attachment: VendorAttachment) => void;
  /** Called when a file is removed (index into `attachments`). */
  onRemove: (index: number) => void;
  acceptedTypes?: string;
  maxSizeMb?: number;
  className?: string;
}

const DEFAULT_ACCEPT = "image/png,image/jpeg,image/webp,application/pdf";

function isImage(type: string): boolean {
  return type.startsWith("image/");
}

/**
 * Multi-file uploader for bill attachments (images and PDFs). Unlike
 * ImageUploader it does not crop: bills are photographed or scanned, so the
 * original file is uploaded as-is. Each selected file is uploaded immediately
 * and its returned URL handed back via `onAdd`; the caller decides when to
 * persist the list (and cleans up orphans on cancel).
 */
export function FileUploader({
  label = "Attachments",
  description = "Upload photos or PDFs of the bill. Max 10MB each.",
  attachments,
  onUpload,
  onAdd,
  onRemove,
  acceptedTypes = DEFAULT_ACCEPT,
  maxSizeMb = 10,
  className,
}: FileUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList) {
    setError(null);
    const allowed = acceptedTypes.split(",").map((t) => t.trim());
    setBusy(true);
    try {
      for (const file of Array.from(files)) {
        if (!allowed.includes(file.type)) {
          setError(`"${file.name}" is not an accepted file type.`);
          continue;
        }
        if (file.size > maxSizeMb * 1024 * 1024) {
          setError(`"${file.name}" is larger than ${maxSizeMb}MB.`);
          continue;
        }
        const formData = new FormData();
        formData.append("file", file);
        const result = await onUpload(formData);
        if (result.success && result.url) {
          onAdd({ url: result.url, name: file.name, type: file.type });
        } else {
          setError(result.error ?? "Upload failed.");
        }
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className={className}>
      {label && (
        <label className="mb-2 block text-[11px] font-medium uppercase tracking-widest text-admin-text-muted">
          {label} ({attachments.length})
        </label>
      )}

      {attachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-3">
          {attachments.map((att, i) => (
            <div
              key={att.url}
              className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border border-admin-border bg-admin-card/50"
            >
              {isImage(att.type) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={att.url}
                  alt={att.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={att.name}
                  className="flex h-full w-full flex-col items-center justify-center gap-1 p-1 text-admin-text-muted transition-colors hover:text-admin-accent"
                >
                  <FileText className="h-6 w-6" />
                  <span className="w-full truncate text-center text-[9px]">
                    {att.name}
                  </span>
                </a>
              )}
              <button
                type="button"
                onClick={() => onRemove(i)}
                aria-label={`Remove ${att.name}`}
                className="absolute right-1 top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
              >
                <X className="h-3 w-3" strokeWidth={2.5} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className={cn(
          "flex w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-admin-border bg-admin-card/30 px-4 py-6 text-center transition-colors hover:border-admin-accent/40 disabled:opacity-50",
        )}
      >
        {busy ? (
          <>
            <Upload className="h-5 w-5 animate-pulse text-admin-accent" />
            <span className="text-xs font-semibold text-admin-text-muted">
              Uploading…
            </span>
          </>
        ) : (
          <>
            <Paperclip className="h-5 w-5 text-admin-text-muted" />
            <span className="text-xs font-semibold text-admin-text">
              Click to add files
            </span>
            <span className="text-[11px] text-admin-text-muted">
              {description}
            </span>
          </>
        )}
      </button>

      {error && <p className="mt-2 text-xs text-admin-danger">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept={acceptedTypes}
        multiple
        onChange={(e) => {
          if (e.target.files?.length) void handleFiles(e.target.files);
        }}
        className="hidden"
      />
    </div>
  );
}
