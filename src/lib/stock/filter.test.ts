import { describe, expect, it } from "vitest";

import { filterStock, type StockRow } from "./filter";

const row = (id: number, partNo: string, description: string, stockQty: number, value: number | null): StockRow => ({
  id,
  partNo,
  description,
  unit: "Nos",
  photo: null,
  stockQty,
  cost: null,
  value,
});

const items = [
  row(1, "3943A", "Biscuit Light Amber", 10, 500),
  row(2, "1304WS", "12V Relay With Socket", 0, 0),
  row(3, "1305", "24V Relay", 4, 900),
  row(4, "2101", "Wire Terminal", -2, 0),
];

describe("filterStock", () => {
  it("lists only parts on the shelf by default", () => {
    expect(filterStock(items, { query: "", show: "in", sort: "value" }).map((r) => r.id)).toEqual([3, 1]);
  });

  it("puts zero and negative stock under out of stock", () => {
    expect(filterStock(items, { query: "", show: "out", sort: "partNo" }).map((r) => r.id)).toEqual([2, 4]);
  });

  it("finds a part number by its start and a name by words in any order", () => {
    expect(filterStock(items, { query: "394", show: "all", sort: "partNo" }).map((r) => r.id)).toEqual([1]);
    expect(filterStock(items, { query: "relay 12v", show: "all", sort: "partNo" }).map((r) => r.id)).toEqual([2]);
  });

  it("sorts by most stock", () => {
    expect(filterStock(items, { query: "", show: "all", sort: "qty" }).map((r) => r.id)).toEqual([1, 3, 2, 4]);
  });
});
