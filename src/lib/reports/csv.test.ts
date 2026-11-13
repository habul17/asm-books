import { describe, expect, it } from "vitest";

import { csvCell, csvFileName, money, toCsv } from "./csv";

describe("csvCell", () => {
  it("writes numbers and empty values plainly", () => {
    expect(csvCell(1250.5)).toBe("1250.5");
    expect(csvCell(-40)).toBe("-40");
    expect(csvCell(0)).toBe("0");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
    expect(csvCell(Number.NaN)).toBe("");
  });

  it("quotes commas, quotes and line breaks", () => {
    expect(csvCell("Sri Murugan Motors")).toBe("Sri Murugan Motors");
    expect(csvCell("Bolt, 10mm")).toBe('"Bolt, 10mm"');
    expect(csvCell('5" hose')).toBe('"5"" hose"');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
  });

  it("stops text from running as a formula", () => {
    expect(csvCell("=SUM(A1:A9)")).toBe("'=SUM(A1:A9)");
    expect(csvCell("+91 98765 43210")).toBe("'+91 98765 43210");
    expect(csvCell("-12A")).toBe("'-12A");
    expect(csvCell("@home")).toBe("'@home");
    expect(csvCell('=HYPERLINK("x","y")')).toBe(`"'=HYPERLINK(""x"",""y"")"`);
  });
});

describe("toCsv", () => {
  it("joins rows with a UTF-8 mark and Windows line ends", () => {
    expect(toCsv([["Item", "Sold"], ["Oil filter", 1200]])).toBe("﻿Item,Sold\r\nOil filter,1200\r\n");
  });
});

describe("csvFileName", () => {
  it("builds a safe file name", () => {
    expect(csvFileName("sales-by-item", "2026-04-01", "to", "2026-11-13")).toBe("sales-by-item_2026-04-01_to_2026-11-13.csv");
    expect(csvFileName("gst", '../x"y')).toBe("gst_x-y.csv");
    expect(csvFileName("low-stock", "")).toBe("low-stock.csv");
  });
});

describe("money", () => {
  it("rounds to paise", () => {
    expect(money(10.006)).toBe(10.01);
    expect(money(0.1 + 0.2)).toBe(0.3);
  });
});
