import { describe, expect, it } from "vitest";

import { orderLineLabel, orderQty, scannedOrderSchema } from "./order-scan";

describe("order scan", () => {
  it("reads rows and keeps unreadable values as null", () => {
    const o = scannedOrderSchema.parse({ customerName: " Sample Motors ", lines: [{ partNo: "1503T", qty: "4" }, { description: "relay" }], doubts: [] });
    expect(o.customerName).toBe("Sample Motors");
    expect(o.lines).toEqual([
      { partNo: "1503T", description: null, qty: 4 },
      { partNo: null, description: "relay", qty: null },
    ]);
  });

  it("only accepts sensible quantities", () => {
    expect(orderQty(4)).toBe(4);
    expect(orderQty(1.23456)).toBe(1.235);
    expect(orderQty(0)).toBeNull();
    expect(orderQty(-2)).toBeNull();
    expect(orderQty(null)).toBeNull();
    expect(orderQty(1e9)).toBeNull();
  });

  it("names a row the way it was written", () => {
    expect(orderLineLabel({ partNo: "9999X", description: null, qty: 3 }, 6)).toBe("Row 6: 9999X × 3");
    expect(orderLineLabel({ partNo: null, description: null, qty: null }, 2)).toBe("Row 2: an item");
  });
});
