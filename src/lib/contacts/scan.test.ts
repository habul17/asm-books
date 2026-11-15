import { describe, expect, it } from "vitest";

import { checkGstin } from "@/lib/gst";

import { reviewContact, scannedContactSchema } from "./scan";

/** A made-up GSTIN with a correct check character. */
const validGstin = (first14: string) =>
  [..."0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((ch) => first14 + ch).find((g) => checkGstin(g).ok)!;

const review = (raw: Record<string, unknown>) => reviewContact(scannedContactSchema.parse({ doubts: [], ...raw }));

describe("reviewContact", () => {
  it("fills the form from a clear visiting card", () => {
    const d = review({
      name: "Sample Car Decors",
      contactPerson: "Ravi Kumar",
      mobile: "+91 90000-00003",
      otherPhones: "0422 2345678",
      email: "Sales@Example.com",
      address: "12, Sample Road, Gandhipuram",
      city: "Coimbatore",
      pincode: "641 012",
      state: "Tamil Nadu",
      extra: "Seat covers and accessories",
    });
    expect(d).toMatchObject({
      name: "Sample Car Decors",
      mobile: "9000000003",
      email: "sales@example.com",
      pincode: "641012",
      stateCode: "33",
      notes: "Other phones: 0422 2345678\nSeat covers and accessories",
    });
    expect(d.warnings).toEqual([]);
  });

  it("takes the state from a valid GSTIN", () => {
    const gstin = validGstin("29ABCDE1234F1Z");
    const d = review({ name: "X", gstin: gstin.toLowerCase(), state: "Tamil Nadu" });
    expect(d).toMatchObject({ gstin, stateCode: "29", warnings: [] });
  });

  it("keeps a GSTIN that fails the check, with a warning", () => {
    const d = review({ name: "X", gstin: "33ABCDE1234F1Z0" });
    expect(d.gstin).toBe("33ABCDE1234F1Z0");
    expect(d.warnings.join(" ")).toMatch(/GSTIN/);
  });

  it("flags a missing name, a bad PIN code and a bad email", () => {
    const d = review({ pincode: "6410", email: "not-an-email" });
    expect(d.pincode).toBeNull();
    expect(d.email).toBeNull();
    expect(d.warnings).toHaveLength(3);
  });

  it("keeps a landline as printed", () => {
    expect(review({ name: "X", mobile: "0422 2345678" }).mobile).toBe("0422 2345678");
  });
});
