import { CSV_BOM } from "./csv";

/**
 * Browser-only: save a string as a file. Client components import this; nothing
 * on the server may.
 *
 * The synthetic anchor carries a `download` attribute, which the nav progress
 * bar already knows to ignore (see global-loader.tsx), so no route transition
 * is triggered.
 */
export function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  // Revoke on the next tick: Safari aborts the download if the URL dies while
  // the click is still being processed.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Save a CSV document. The BOM goes on here rather than in `toCsv`, so it is
 * the first byte of the *file* — that is what makes Excel on Windows decode
 * UTF-8 and render Devanagari names and `रू` instead of mojibake.
 */
export function downloadCsv(filename: string, csv: string): void {
  downloadTextFile(filename, CSV_BOM + csv, "text/csv;charset=utf-8;");
}
