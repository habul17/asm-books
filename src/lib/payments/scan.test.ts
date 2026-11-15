import { describe, expect, it } from "vitest";

import { matchParty, mobileIn, reviewSlip, scannedSlipSchema } from "./scan";

const TODAY = "2026-11-16";
const PARTIES = [
  { id: 1, name: "Sample Car Decors", mobile: "98765 43210" },
  { id: 2, name: "Demo Auto Spares", mobile: null },
  { id: 3, name: "Demo Auto Spares Annex", mobile: null },
  { id: 4, name: "Test Motors", mobile: null },
];
const review = (raw: Record<string, unknown>, direction: "in" | "out" = "in") =>
  reviewSlip(scannedSlipSchema.parse({ doubts: [], ...raw }), { today: TODAY, direction, parties: PARTIES });

describe("mobileIn", () => {
  it("finds the mobile number in a UPI ID or a phone with +91", () => {
    expect(mobileIn("9876543210@ybl")).toBe("9876543210");
    expect(mobileIn("+91 98765-43210")).toBe("9876543210");
    expect(mobileIn("samplecars@okaxis")).toBeNull();
  });
});

describe("matchParty", () => {
  it("matches on the mobile number first", () => {
    expect(matchParty("Someone Else", "9876543210@ybl", PARTIES)).toBe(1);
  });
  it("prefers an exact name over a longer one that contains it", () => {
    expect(matchParty("DEMO AUTO SPARES", null, PARTIES)).toBe(2);
  });
  it("matches a name that is part of the saved name when only one fits", () => {
    expect(matchParty("Test Motors Coimbatore", null, PARTIES)).toBe(4);
  });
  it("gives up when more than one could be meant", () => {
    expect(matchParty("Demo Auto", null, PARTIES)).toBeNull();
  });
});

describe("reviewSlip", () => {
  it("fills money received from a clear UPI screenshot", () => {
    const d = review({ amount: "2,632.00", date: "2026-11-07", reference: "531122334455", mode: "UPI", status: "success", fromName: "Test Motors", toName: "Shop" });
    expect(d).toMatchObject({ amount: 2632, date: "2026-11-07", mode: "upi", reference: "531122334455", partyId: 4 });
    expect(d.warnings).toEqual([]);
  });
  it("uses the payee for money paid out", () => {
    expect(review({ amount: 100, fromName: "Test Motors", toName: "Demo Auto Spares" }, "out").partyId).toBe(2);
  });
  it("warns about failed payments, future dates and unknown payers", () => {
    const d = review({ amount: 50, status: "failed", date: "2026-12-01", fromName: "Stranger" });
    expect(d.date).toBeNull();
    expect(d.partyId).toBeNull();
    expect(d.warnings.join(" ")).toMatch(/FAILED.*future.*Stranger/);
  });
});
