import { describe, expect, it } from "vitest";

import { parseVendor } from "./validation";

// The bill scanner adds a vendor from just the name and GSTIN, with every other box empty.
const empty = Object.fromEntries(
  ["contactPerson", "mobile", "email", "address", "city", "stateCode", "pincode", "openingBalance", "paymentTermsDays", "notes"].map((k) => [k, ""]),
);

describe("a vendor added from a scanned bill", () => {
  it("is accepted with only a name and GSTIN, and takes the state from the GSTIN", () => {
    const r = parseVendor({ ...empty, name: "A.M AUTO PARTS", gstin: "32BLDPA5840B1ZX", active: "on" });
    expect(r.error).toBeUndefined();
    expect(r.value).toMatchObject({ name: "A.M AUTO PARTS", gstin: "32BLDPA5840B1ZX", stateCode: "32", openingBalance: 0 });
  });
});
