import { describe, expect, it } from "vitest";
import {
  CODE_B,
  CODE_C,
  PATTERNS,
  START_B,
  START_C,
  STOP,
  code128Bars,
  encodeCode128,
} from "./code128";

/**
 * A scanner never sees our symbol array: it sees printed bars and spaces. These
 * tests therefore go all the way down to the bar/space widths and decode them
 * back independently, the way a reader would, so an encoder bug can't hide
 * behind a matching assertion.
 */

/** Rebuild the full alternating bar/space width string from the drawn bars. */
function elementWidths(value: string): string {
  const { bars, modules } = code128Bars(value);
  const widths: number[] = [];
  let cursor = 0;
  for (const bar of bars) {
    if (bar.x > cursor) widths.push(bar.x - cursor); // the space before this bar
    widths.push(bar.width);
    cursor = bar.x + bar.width;
  }
  if (cursor < modules) widths.push(modules - cursor);
  return widths.join("");
}

/** Read the symbol values back out of the printed element widths. */
function decodeSymbols(widths: string): number[] {
  const lookup = new Map(PATTERNS.map((p, value) => [p, value]));
  const symbols: number[] = [];
  let i = 0;
  while (i < widths.length) {
    // Every symbol is 6 elements wide except the 7-element Stop that ends it.
    const size = widths.length - i === 7 ? 7 : 6;
    const chunk = widths.slice(i, i + size);
    const value = lookup.get(chunk);
    if (value === undefined) throw new Error(`undecodable element run "${chunk}"`);
    symbols.push(value);
    i += size;
  }
  return symbols;
}

/** Turn decoded symbols back into the original string, honouring subset switches. */
function decodeValue(symbols: number[]): string {
  const start = symbols[0];
  if (start !== START_B && start !== START_C) throw new Error("bad start symbol");
  if (symbols[symbols.length - 1] !== STOP) throw new Error("missing stop symbol");

  // Independently recompute the mod-103 checksum over start + data.
  const data = symbols.slice(1, -2);
  const claimed = symbols[symbols.length - 2];
  let sum = start;
  data.forEach((s, idx) => {
    sum += s * (idx + 1);
  });
  expect(claimed).toBe(sum % 103);

  // Symbol meanings are mode-dependent: 99 is "switch to C" only while in B (in
  // subset C it is the digit pair "99"), and 100 is "switch to B" only while in
  // C. Decoding these unconditionally would corrupt any code containing 99.
  let mode: "B" | "C" = start === START_C ? "C" : "B";
  let out = "";
  for (const symbol of data) {
    if (mode === "B" && symbol === CODE_C) {
      mode = "C";
      continue;
    }
    if (mode === "C" && symbol === CODE_B) {
      mode = "B";
      continue;
    }
    out += mode === "C" ? String(symbol).padStart(2, "0") : String.fromCharCode(symbol + 32);
  }
  return out;
}

function roundTrip(value: string): string {
  return decodeValue(decodeSymbols(elementWidths(value)));
}

describe("Code 128 encoder: a reader decodes back to the original value", () => {
  const cases = [
    "00000001", // the 8-digit auto-assigned barcode from barcode_seq
    "00000042",
    "12345678",
    "99999999",
    "1234567890123", // 13 digits, odd length, forces a C -> B drop at the tail
    "123", // short odd numeric, stays in subset B
    "12", // shortest even numeric
    "BC-001", // mixed, leading letters
    "BC-00000001", // letters then a long digit run worth a C switch
    "ABC", // pure alphanumeric
    "SKU-99/A b", // punctuation, slash, space, lower case
  ];

  for (const value of cases) {
    it(`round-trips "${value}"`, () => {
      expect(roundTrip(value)).toBe(value);
    });
  }
});

describe("Code 128 encoder: symbol-level structure", () => {
  it("packs an 8-digit code into subset C", () => {
    // Start C, four digit pairs, checksum, Stop.
    expect(encodeCode128("12345678")).toEqual([START_C, 12, 34, 56, 78, 47, STOP]);
  });

  it("computes the mod-103 checksum for the auto-assigned format", () => {
    // 105 + 0*1 + 0*2 + 0*3 + 1*4 = 109; 109 % 103 = 6.
    expect(encodeCode128("00000001")).toEqual([START_C, 0, 0, 0, 1, 6, STOP]);
  });

  it("keeps a short mixed code entirely in subset B", () => {
    expect(encodeCode128("BC-001")).toEqual([START_B, 34, 35, 13, 16, 16, 17, 81, STOP]);
  });

  it("emits a quiet-zone-free module count that is a whole number of symbols", () => {
    // Each symbol is 11 modules; the Stop adds a 13-module terminator.
    const { modules } = code128Bars("00000001");
    const symbols = encodeCode128("00000001");
    expect(modules).toBe((symbols.length - 1) * 11 + 13);
  });

  it("always starts and ends with a bar", () => {
    const { bars, modules } = code128Bars("00000001");
    expect(bars[0].x).toBe(0);
    const last = bars[bars.length - 1];
    expect(last.x + last.width).toBe(modules);
  });
});

describe("printed geometry on the 34 x 20 mm label", () => {
  // Kept in sync with PRINT_MODULE_MM in BarcodesClient and the 0.5mm side
  // padding in the `@media print` block.
  const MODULE_MM = 0.25;
  const QUIET_ZONE = 10;
  const USABLE_MM = 34 - 0.5 * 2;

  const printedWidthMm = (value: string) =>
    (code128Bars(value).modules + QUIET_ZONE * 2) * MODULE_MM;

  it("prints an 8-digit auto barcode well inside the label", () => {
    // 99 modules at 0.25mm.
    expect(printedWidthMm("00000001")).toBeCloseTo(24.75, 5);
    expect(printedWidthMm("00000001")).toBeLessThanOrEqual(USABLE_MM);
  });

  it("still fits once the sequence reaches its widest 8-digit value", () => {
    expect(printedWidthMm("99999999")).toBeLessThanOrEqual(USABLE_MM);
  });

  it("fits every barcode the sequence can hand out", () => {
    // barcode_seq is lpad'ed to 8 digits, so this is the whole domain shape.
    for (const value of ["00000001", "00500000", "12345678", "87654321", "99999999"]) {
      expect(printedWidthMm(value)).toBeLessThanOrEqual(USABLE_MM);
    }
  });

  it("flags that a 13-digit EAN would overflow and need a narrower module", () => {
    // Not a supported case today (codes are 8 digits); this documents the limit
    // so switching to real EANs fails here rather than silently on the printer.
    expect(printedWidthMm("1234567890123")).toBeGreaterThan(USABLE_MM);
  });
});
