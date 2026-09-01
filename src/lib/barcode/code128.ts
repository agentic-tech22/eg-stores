/**
 * Dependency-free Code 128 encoder. Pure logic, no React, so it can be unit
 * tested on its own; the `Barcode` component draws the output as SVG.
 *
 * Auto-switches between subset B (all printable ASCII) and subset C (two digits
 * per symbol) so numeric codes encode at roughly half the width and stay legible
 * on a small label, while alphanumeric codes still work.
 */

// Canonical Code 128 element-width patterns, indexed by symbol value 0-106.
// Each string is the module widths of alternating bar/space, starting with a
// bar. Index 103/104/105 = Start A/B/C, 106 = Stop (7 elements incl. the final
// terminating bar).
export const PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",
];

export const CODE_C = 99; // switch to subset C
export const CODE_B = 100; // switch to subset B
export const START_B = 104;
export const START_C = 105;
export const STOP = 106;

function isDigit(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

/** Count consecutive digits in `value` starting at index `i`. */
function digitRun(value: string, i: number): number {
  let n = 0;
  while (i + n < value.length && isDigit(value[i + n])) n++;
  return n;
}

/**
 * Encode a string to Code 128 symbol values (Start + data + checksum + Stop).
 * Numeric codes pack two digits per symbol in subset C, so an 8-digit code is
 * only 6 symbols wide; mixed codes like "BC-00000001" keep the letters in B and
 * pack the digit run in C.
 */
export function encodeCode128(value: string): number[] {
  const symbols: number[] = [];
  let mode: "B" | "C";
  let i = 0;

  // Start in C when the value opens with a digit run long enough to pay back the
  // switch (a fully-numeric even-length code, or a leading run of 4+ digits).
  const lead = digitRun(value, 0);
  if (value.length >= 2 && (lead >= 4 || (lead === value.length && lead % 2 === 0))) {
    symbols.push(START_C);
    mode = "C";
  } else {
    symbols.push(START_B);
    mode = "B";
  }

  while (i < value.length) {
    if (mode === "C") {
      if (i + 1 < value.length && isDigit(value[i]) && isDigit(value[i + 1])) {
        symbols.push(Number(value.slice(i, i + 2))); // "00".."99" -> 0..99
        i += 2;
      } else {
        symbols.push(CODE_B); // odd digit left or a non-digit ahead, drop to B
        mode = "B";
      }
    } else {
      // In B, switch to C for a digit run worth the two switch symbols: one that
      // runs to the end with even length, or any interior run of 6+.
      const run = digitRun(value, i);
      const reachesEnd = i + run === value.length;
      if ((reachesEnd && run >= 4 && run % 2 === 0) || run >= 6) {
        symbols.push(CODE_C);
        mode = "C";
      } else {
        // Subset B maps printable ASCII 32-126 to values 0-94.
        const code = value.charCodeAt(i) - 32;
        if (code < 0 || code > 94) {
          // A non-printable-ASCII char can't be represented; silently mapping it
          // to another symbol would make the barcode decode to a value that no
          // longer matches the product. Flag it so the source data is fixed.
          if (process.env.NODE_ENV !== "production") {
            console.warn(
              `Barcode: character "${value[i]}" in "${value}" is outside Code 128 (printable ASCII) and will not scan correctly.`,
            );
          }
        }
        symbols.push(code >= 0 && code <= 94 ? code : 0);
        i += 1;
      }
    }
  }

  // Checksum: start value (weight 1) plus each following symbol times its
  // 1-based position, mod 103.
  let checksum = symbols[0];
  for (let p = 1; p < symbols.length; p++) checksum += symbols[p] * p;
  symbols.push(checksum % 103);
  symbols.push(STOP);
  return symbols;
}

export interface Bar {
  /** Left edge, in module units from the start of the symbol. */
  x: number;
  /** Width in module units. */
  width: number;
}

/** Black bars (in module units) and the total module width for a value. */
export function code128Bars(value: string): { bars: Bar[]; modules: number } {
  const out: Bar[] = [];
  let x = 0;
  for (const symbol of encodeCode128(value)) {
    const pattern = PATTERNS[symbol];
    for (let i = 0; i < pattern.length; i++) {
      const w = Number(pattern[i]);
      if (i % 2 === 0) out.push({ x, width: w }); // even index = bar
      x += w;
    }
  }
  return { bars: out, modules: x };
}
