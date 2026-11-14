import { describe, expect, it } from "vitest";

import { parseProduct } from "./product-validation";

const base = { partNo: " 52300 ", description: "Side  mirror  LH", active: "on" };

describe("parseProduct", () => {
  it("accepts the two required boxes and fills sensible defaults", () => {
    const r = parseProduct(base);
    expect(r.value).toMatchObject({
      partNo: "52300",
      description: "Side mirror LH",
      brand: null,
      categoryId: null,
      hsn: null,
      unit: "Nos",
      gstRate: null,
      listPrice: null,
      purchasePrice: null,
      minStock: null,
      active: true,
    });
  });

  it("needs a part no and a description", () => {
    expect(parseProduct({ ...base, partNo: "  " }).error).toBe("Part no is required");
    expect(parseProduct({ ...base, description: "" }).error).toBe("Description is required");
  });

  it("checks the HSN code", () => {
    expect(parseProduct({ ...base, hsn: "8708 29" }).value?.hsn).toBe("870829");
    expect(parseProduct({ ...base, hsn: "87082" }).error).toMatch(/4, 6 or 8/);
  });

  it("only allows GST rates from the list", () => {
    expect(parseProduct({ ...base, gstRate: "18" }).value?.gstRate).toBe(18);
    expect(parseProduct({ ...base, gstRate: "" }).value?.gstRate).toBeNull();
    expect(parseProduct({ ...base, gstRate: "17" }).error).toMatch(/GST/);
  });

  it("reads prices and min stock", () => {
    const r = parseProduct({ ...base, listPrice: "1,250.50", purchasePrice: "980", minStock: "2" });
    expect(r.value).toMatchObject({ listPrice: 1250.5, purchasePrice: 980, minStock: 2 });
    expect(parseProduct({ ...base, purchasePrice: "-1" }).error).toMatch(/negative/);
    expect(parseProduct({ ...base, minStock: "abc" }).error).toMatch(/number/);
  });

  it("treats an unticked box as switched off", () => {
    expect(parseProduct({ partNo: "A", description: "B" }).value?.active).toBe(false);
  });
});
