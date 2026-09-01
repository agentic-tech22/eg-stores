import { describe, expect, it } from "vitest";
import { CSV_BOM, escapeCsvCell, toCsv, type ExportColumn } from "./csv";

/**
 * A spreadsheet never sees our escaping decisions: it sees a byte stream that it
 * parses back into a grid. These tests therefore decode the output with an
 * independent RFC 4180 parser written below, the way Excel would, so a
 * serializer bug can't hide behind an assertion that happens to match it.
 */

/** Minimal RFC 4180 reader: quoted fields, doubled quotes, CRLF row breaks. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let i = 0;

  while (i < text.length) {
    const char = text[i]!;

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      quoted = true;
      i += 1;
    } else if (char === ",") {
      row.push(field);
      field = "";
      i += 1;
    } else if (char === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i += 2;
    } else {
      field += char;
      i += 1;
    }
  }

  row.push(field);
  rows.push(row);
  return rows;
}

interface Row {
  a: CsvValue;
  b: CsvValue;
}
type CsvValue = string | number | boolean | null | undefined;

const columns: ExportColumn<Row>[] = [
  { header: "A", value: (r) => r.a },
  { header: "B", value: (r) => r.b },
];

describe("escapeCsvCell", () => {
  it("leaves plain text unquoted", () => {
    expect(escapeCsvCell("Cotton Shirt")).toBe("Cotton Shirt");
  });

  it("returns an empty cell for null, undefined and empty string", () => {
    expect(escapeCsvCell(null)).toBe("");
    expect(escapeCsvCell(undefined)).toBe("");
    expect(escapeCsvCell("")).toBe("");
  });

  it("returns an empty cell for non-finite numbers", () => {
    expect(escapeCsvCell(NaN)).toBe("");
    expect(escapeCsvCell(Infinity)).toBe("");
    expect(escapeCsvCell(-Infinity)).toBe("");
  });

  it("emits negative numbers raw — the formula guard must not touch them", () => {
    // A guarded "-250" would import as text and break every SUM in the sheet.
    expect(escapeCsvCell(-250)).toBe("-250");
    expect(escapeCsvCell(-0.5)).toBe("-0.5");
  });

  it("quotes fields with leading or trailing whitespace", () => {
    expect(escapeCsvCell(" padded ")).toBe('" padded "');
  });
});

describe("toCsv", () => {
  it("emits a header-only document for an empty row set", () => {
    const csv = toCsv([], columns);
    expect(csv).toBe("A,B");
    expect(parseCsv(csv)).toEqual([["A", "B"]]);
  });

  it("does not end with a trailing newline", () => {
    const csv = toCsv([{ a: "x", b: "y" }], columns);
    expect(csv.endsWith("\n")).toBe(false);
  });

  it("round-trips a plain grid in input and column order", () => {
    const csv = toCsv(
      [
        { a: "one", b: 1 },
        { a: "two", b: 2 },
      ],
      columns,
    );
    expect(parseCsv(csv)).toEqual([
      ["A", "B"],
      ["one", "1"],
      ["two", "2"],
    ]);
  });

  it("quotes and doubles embedded quotes", () => {
    const csv = toCsv([{ a: 'He said "hi"', b: null }], columns);
    expect(csv).toContain('"He said ""hi"""');
    expect(parseCsv(csv)[1]![0]).toBe('He said "hi"');
  });

  it("keeps a comma inside one field", () => {
    const csv = toCsv([{ a: "Shirt, Blue", b: 10 }], columns);
    expect(parseCsv(csv)[1]).toEqual(["Shirt, Blue", "10"]);
  });

  it("preserves newlines inside a field", () => {
    const csv = toCsv(
      [{ a: "line one\nline two", b: "crlf\r\nhere" }],
      columns,
    );
    const parsed = parseCsv(csv);
    expect(parsed).toHaveLength(2);
    expect(parsed[1]![0]).toBe("line one\nline two");
    expect(parsed[1]![1]).toBe("crlf\r\nhere");
  });

  it("neutralises formula-injection payloads", () => {
    // These reach the DB from the public storefront checkout, so they are the
    // realistic attack path, not a theoretical one.
    const payloads = [
      '=HYPERLINK("http://evil","click")',
      "+1+1",
      "-cmd|'/c calc'",
      "@SUM(A1)",
      "\tleading tab",
    ];
    const csv = toCsv(
      payloads.map((a) => ({ a, b: null })),
      columns,
    );
    const parsed = parseCsv(csv);

    payloads.forEach((payload, i) => {
      const cell = parsed[i + 1]![0]!;
      expect(cell).toBe(`'${payload}`);
      expect(cell.startsWith("'")).toBe(true);
    });
  });

  it("passes Devanagari and emoji through unchanged", () => {
    const csv = toCsv([{ a: "सुहेल खान", b: "काठमाडौँ 🇳🇵" }], columns);
    expect(parseCsv(csv)[1]).toEqual(["सुहेल खान", "काठमाडौँ 🇳🇵"]);
  });

  it("does not embed the BOM — that belongs to the download layer", () => {
    expect(toCsv([{ a: "x", b: "y" }], columns).includes(CSV_BOM)).toBe(false);
  });

  it("passes the row index to column value functions", () => {
    const indexed: ExportColumn<Row>[] = [
      { header: "#", value: (_r, i) => i + 1 },
      ...columns,
    ];
    const csv = toCsv(
      [
        { a: "p", b: 1 },
        { a: "q", b: 2 },
      ],
      indexed,
    );
    expect(
      parseCsv(csv)
        .slice(1)
        .map((r) => r[0]),
    ).toEqual(["1", "2"]);
  });
});
