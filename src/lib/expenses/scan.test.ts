import { describe, expect, it } from "vitest";

import { reviewReceipt, scannedReceiptSchema } from "./scan";

const TODAY = "2026-11-16";
const CATEGORIES = ["Rent", "Fuel", "Electricity", "Other"];
const review = (raw: Record<string, unknown>) =>
  reviewReceipt(scannedReceiptSchema.parse({ doubts: [], ...raw }), { today: TODAY, categories: CATEGORIES });

describe("reviewReceipt", () => {
  it("fills the form from a clear fuel receipt", () => {
    const d = review({ sellerName: "Sri Murugan Fuels", date: "2026-11-14", total: "1,050.00", category: "fuel", paidBy: "UPI", receiptNo: "F-221", summary: "Petrol 10.2 L" });
    expect(d).toMatchObject({ date: "2026-11-14", amount: 1050, gstRate: 0, category: "Fuel", mode: "upi", reference: "F-221", paidTo: "Sri Murugan Fuels", notes: "Petrol 10.2 L" });
    expect(d.warnings).toEqual([]);
  });

  it("works out the GST slab from the amounts when the rate is missing", () => {
    const d = review({ total: 1180, gstTotal: 180, sellerGstin: "33AAAAA0000A1Z5" });
    expect(d.gstRate).toBe(18);
  });

  it("warns when GST is shown without a GSTIN", () => {
    const d = review({ total: 1180, gstRate: 18 });
    expect(d.gstRate).toBe(18);
    expect(d.warnings.join(" ")).toMatch(/GSTIN/);
  });

  it("drops a wrong GSTIN and a future date with a warning", () => {
    const d = review({ total: 100, sellerGstin: "33ABCDE", date: "2026-12-01" });
    expect(d.sellerGstin).toBeNull();
    expect(d.date).toBeNull();
    expect(d.warnings).toHaveLength(2);
  });

  it("asks for the amount when it could not be read", () => {
    const d = review({ total: null });
    expect(d.amount).toBeNull();
    expect(d.warnings.join(" ")).toMatch(/amount/);
  });

  it("ignores a category or payment mode that is not offered", () => {
    const d = review({ total: 50, category: "Party", paidBy: "crypto" });
    expect(d.category).toBeNull();
    expect(d.mode).toBeNull();
  });
});
