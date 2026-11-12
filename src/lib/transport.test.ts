import { describe, expect, it } from "vitest";

import { EWAY_BILL_LIMIT, needsEwayBill, parseTransport, transportRows } from "./transport";

const form = (values: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(values)) f.set(k, v);
  return f;
};

describe("parseTransport", () => {
  it("keeps only the boxes that were filled in", () => {
    expect(parseTransport(form({})).value).toEqual({});
    expect(parseTransport(form({ transporter: "  ZZ Roadways ", vehicleNo: "tn 37 ab-1234", mode: "road" })).value).toEqual({
      transporter: "ZZ Roadways",
      vehicleNo: "TN37AB1234",
      mode: "road",
    });
  });

  it("reads the e-way bill number with its dates", () => {
    const r = parseTransport(
      form({ ewayBillNo: "1234 5678 9012", ewayBillDate: "2010-05-01", ewayValidUntil: "2010-05-03", distanceKm: "120" }),
    );
    expect(r.value).toEqual({
      ewayBillNo: "123456789012",
      ewayBillDate: "2010-05-01",
      ewayValidUntil: "2010-05-03",
      distanceKm: 120,
    });
  });

  it("rejects values that cannot be right", () => {
    expect(parseTransport(form({ ewayBillNo: "12345" })).error).toMatch(/12 digits/);
    expect(parseTransport(form({ vehicleNo: "??" })).error).toMatch(/Vehicle number/);
    expect(parseTransport(form({ transporterId: "33ABC" })).error).toMatch(/15 letters/);
    expect(parseTransport(form({ mode: "bike" })).error).toBeTruthy();
    expect(parseTransport(form({ distanceKm: "0" })).error).toMatch(/at least 1/);
    expect(parseTransport(form({ distanceKm: "12.5" })).error).toMatch(/whole/);
    expect(parseTransport(form({ ewayBillDate: "2010-05-01" })).error).toMatch(/e-way bill number/);
    expect(
      parseTransport(form({ ewayBillNo: "123456789012", ewayBillDate: "2010-05-03", ewayValidUntil: "2010-05-01" })).error,
    ).toMatch(/cannot be before/);
  });
});

describe("transportRows", () => {
  it("lists what prints on the document", () => {
    expect(transportRows({})).toEqual([]);
    expect(transportRows({ transporter: "ZZ Roadways", vehicleNo: "TN37AB1234", ewayBillNo: "123456789012", ewayValidUntil: "2010-05-03", distanceKm: 5 })).toEqual([
      { label: "Transporter", value: "ZZ Roadways" },
      { label: "Vehicle No", value: "TN37AB1234" },
      { label: "E-Way Bill No", value: "123456789012" },
      { label: "EWB Valid Till", value: "03-05-2010" },
    ]);
  });
});

describe("needsEwayBill", () => {
  it("is true from the limit upwards until a number is entered", () => {
    expect(needsEwayBill(EWAY_BILL_LIMIT - 0.01, {})).toBe(false);
    expect(needsEwayBill(EWAY_BILL_LIMIT, {})).toBe(true);
    expect(needsEwayBill(EWAY_BILL_LIMIT, { ewayBillNo: "123456789012" })).toBe(false);
  });
});
