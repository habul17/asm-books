import { describe, expect, it } from "vitest";

import { withCheckChar } from "@/lib/gst";

import {
  indexParts,
  isScanMimeType,
  matchPart,
  partKey,
  reviewScan,
  SCANNED_BILL_JSON_SCHEMA,
  scannedBillSchema,
  type CataloguePart,
} from "./scan";

const GSTIN = withCheckChar("33ABCDE1234F1Z");

const parts: CataloguePart[] = [
  { id: 1, partNo: "BP-1234", description: "Brake pad front", unit: "Set", gstRate: 28, lastPrice: 400 },
  { id: 2, partNo: "OF 5501 A", description: "Oil filter", unit: "Nos", gstRate: null, lastPrice: null },
  { id: 3, partNo: "HL77", description: "Head lamp", unit: "Nos", gstRate: 18, lastPrice: 900 },
  { id: 4, partNo: "MIR-200-L", description: "Side mirror left", unit: "Nos", gstRate: 18, lastPrice: 150 },
  { id: 5, partNo: "MIR-200-R", description: "Side mirror right", unit: "Nos", gstRate: 18, lastPrice: 150 },
];
const index = indexParts(parts);

const line = (over: Record<string, unknown> = {}) => ({
  partNo: "BP-1234",
  description: "BRAKE PAD FRT",
  hsn: "8708",
  qty: 2,
  rate: 410,
  discountPct: 0,
  gstRate: 28,
  amount: 820,
  ...over,
});

const bill = (over: Record<string, unknown> = {}) =>
  scannedBillSchema.parse({
    supplierName: "Sri Balaji Motors",
    supplierGstin: GSTIN,
    billNo: "SB/1042",
    date: "2026-11-05",
    lines: [line()],
    taxableTotal: 820,
    gstTotal: 229.6,
    grandTotal: 1050,
    doubts: [],
    ...over,
  });

const context = { parts, defaultGstRate: 18, today: "2026-11-11", vendorFound: true };

describe("scannedBillSchema", () => {
  it("cleans what the reader sends", () => {
    const b = scannedBillSchema.parse({
      supplierName: "  Sri Balaji Motors ",
      billNo: 1042,
      lines: [{ partNo: " BP-1234 ", qty: "2", rate: "1,250.50", amount: "₹ 2,501.00", gstRate: "x" }],
      grandTotal: "3,201",
      doubts: ["  Row 1 smudged ", "", 7],
    });
    expect(b.supplierName).toBe("Sri Balaji Motors");
    expect(b.billNo).toBeNull();
    expect(b.lines[0]).toMatchObject({ partNo: "BP-1234", qty: 2, rate: 1250.5, amount: 2501, gstRate: null, description: null });
    expect(b.grandTotal).toBe(3201);
    expect(b.doubts).toEqual(["Row 1 smudged"]);
  });

  it("treats a missing or odd answer as an empty bill instead of failing", () => {
    expect(scannedBillSchema.parse({}).lines).toEqual([]);
    expect(scannedBillSchema.parse({ lines: "none" }).lines).toEqual([]);
    expect(scannedBillSchema.safeParse(null).success).toBe(false);
  });

  it("asks the reader for exactly the fields it parses", () => {
    expect(Object.keys(SCANNED_BILL_JSON_SCHEMA.properties).sort()).toEqual(Object.keys(scannedBillSchema.shape).sort());
    expect([...SCANNED_BILL_JSON_SCHEMA.properties.lines.items.required].sort()).toEqual(Object.keys(line()).sort());
  });
});

describe("matching parts", () => {
  it("ignores spaces, dashes and case", () => {
    expect(partKey(" bp-1234 ")).toBe("BP1234");
    expect(matchPart({ partNo: "bp 1234", description: null }, index)).toMatchObject({ how: "exact", part: { id: 1 } });
    expect(matchPart({ partNo: "OF5501A", description: null }, index)).toMatchObject({ how: "exact", part: { id: 2 } });
  });

  it("offers a near match only when exactly one part fits", () => {
    expect(matchPart({ partNo: "BP-1234-X", description: null }, index)).toMatchObject({ how: "near", part: { id: 1 } });
    // Two mirrors contain "MIR200": no guess.
    expect(matchPart({ partNo: "MIR-200", description: null }, index)).toBeNull();
    // Too short to trust.
    expect(matchPart({ partNo: "HL7", description: null }, index)).toBeNull();
  });

  it("finds a part number printed inside the description", () => {
    expect(matchPart({ partNo: null, description: "Oil filter OF-5501-A premium" }, index)).toMatchObject({ how: "near", part: { id: 2 } });
    expect(matchPart({ partNo: null, description: "Oil filter" }, index)).toBeNull();
  });

  it("does not match a wrong digit", () => {
    expect(matchPart({ partNo: "BP-1235", description: "Brake pad" }, index)).toBeNull();
  });
});

describe("reviewScan", () => {
  it("fills a clean bill with nothing to check", () => {
    const r = reviewScan(bill(), context);
    expect(r).toMatchObject({ billNo: "SB/1042", date: "2026-11-05", printedTotal: 1050, roundTotal: true, warnings: [] });
    expect(r.lines).toEqual([
      { productId: 1, partNo: "BP-1234", description: "Brake pad front", unit: "Set", qty: "2", rate: "410", discountPct: "", gstRate: 28, flags: [] },
    ]);
  });

  it("flags a part that is not in the catalogue and keeps what was printed", () => {
    const r = reviewScan(bill({ lines: [line({ partNo: "ZZ-999", description: "Wiper blade" })] }), context);
    expect(r.lines[0]).toMatchObject({ productId: null, partNo: null, description: "ZZ-999 Wiper blade", unit: "Nos" });
    expect(r.lines[0].flags.map((f) => f.kind)).toEqual(["part"]);
  });

  it("flags a near match so a person confirms it", () => {
    const r = reviewScan(bill({ lines: [line({ partNo: "BP-1234-X" })] }), context);
    expect(r.lines[0].productId).toBe(1);
    expect(r.lines[0].flags[0]).toMatchObject({ kind: "part" });
  });

  it("flags unreadable quantity and rate, and leaves the boxes empty", () => {
    const r = reviewScan(bill({ lines: [line({ qty: null, rate: null, amount: null })] }), context);
    expect(r.lines[0]).toMatchObject({ qty: "", rate: "" });
    expect(r.lines[0].flags.map((f) => f.kind)).toEqual(["qty", "rate"]);
  });

  it("flags a row whose amount does not equal qty × rate", () => {
    // Rate misread as 140 instead of 410.
    const r = reviewScan(bill({ lines: [line({ rate: 140 })] }), context);
    expect(r.lines[0].flags.map((f) => f.kind)).toEqual(["amount", "price"]);
    expect(r.lines[0].flags[0].text).toContain("₹280.00");
  });

  it("accepts a row amount that includes GST, and a discount", () => {
    expect(reviewScan(bill({ lines: [line({ amount: 1049.6 })] }), context).lines[0].flags).toEqual([]);
    const discounted = reviewScan(bill({ lines: [line({ discountPct: 10, amount: 738 })] }), context).lines[0];
    expect(discounted).toMatchObject({ discountPct: "10", flags: [] });
  });

  it("flags a rate far from the last purchase price", () => {
    const r = reviewScan(bill({ lines: [line({ rate: 600, amount: 1200 })] }), context);
    expect(r.lines[0].flags).toEqual([{ kind: "price", text: "The rate changed a lot. Last purchase price was ₹400.00." }]);
  });

  it("turns half the GST rate into the full rate and falls back when it cannot be read", () => {
    const half = reviewScan(bill({ lines: [line({ gstRate: 14 })] }), context).lines[0];
    expect(half.gstRate).toBe(28);
    expect(half.flags[0].kind).toBe("gst");
    // Part 2 has no GST rate of its own, so the default is used.
    const none = reviewScan(bill({ lines: [line({ partNo: "OF 5501 A", gstRate: null })] }), context).lines[0];
    expect(none.gstRate).toBe(18);
    expect(none.flags.map((f) => f.kind)).toEqual(["gst"]);
    expect(reviewScan(bill({ lines: [line({ gstRate: 17 })] }), context).lines[0].gstRate).toBe(28);
  });

  it("warns about the supplier, bill number, date and totals", () => {
    const r = reviewScan(
      bill({
        supplierGstin: "33ABCDE1234F1Z0",
        billNo: null,
        date: "05-11-2026",
        taxableTotal: 1500,
        grandTotal: null,
        doubts: ["Row 1 rate is smudged"],
      }),
      { ...context, vendorFound: false },
    );
    expect(r.date).toBe("2026-11-11");
    expect(r.billNo).toBe("");
    expect(r.printedTotal).toBeNull();
    expect(r.warnings).toHaveLength(7);
    expect(r.warnings.join("\n")).toMatch(/not in your vendors[\s\S]*not a valid GSTIN[\s\S]*bill number[\s\S]*bill date[\s\S]*rows add up to ₹820.00[\s\S]*total could not be read[\s\S]*Reader's note: Row 1 rate is smudged/);
  });

  it("does not accept a future date, and keeps paise when the bill has them", () => {
    const r = reviewScan(bill({ date: "2026-12-01", grandTotal: 1049.6 }), context);
    expect(r.date).toBe("2026-11-11");
    expect(r.roundTotal).toBe(false);
    expect(r.warnings).toHaveLength(1);
  });

  it("says so when no items were read", () => {
    expect(reviewScan(bill({ lines: [] }), context).warnings[0]).toMatch(/No items/);
  });
});

describe("isScanMimeType", () => {
  it("allows photos and PDFs only", () => {
    expect(isScanMimeType("image/jpeg")).toBe(true);
    expect(isScanMimeType("application/pdf")).toBe(true);
    expect(isScanMimeType("image/heic")).toBe(false);
    expect(isScanMimeType("text/html")).toBe(false);
  });
});
