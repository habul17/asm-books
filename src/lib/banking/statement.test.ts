import { describe, expect, it } from "vitest";

import { checkStatement, matchLines, modeFromNarration, partyInNarration, prefillQuery, scannedStatementSchema, type BankRecord } from "./statement";

const read = (lines: Record<string, unknown>[], extra: Record<string, unknown> = {}) =>
  checkStatement(scannedStatementSchema.parse({ doubts: [], lines, ...extra }));

describe("checkStatement", () => {
  it("keeps good lines and checks the running balance", () => {
    const r = read(
      [
        { date: "2026-11-06", narration: "NEFT CR A", credit: "50,000.00", balance: 150000 },
        { date: "2026-11-07", narration: "UPI DR B", debit: 1239, balance: 148761 },
      ],
      { openingBalance: 100000, closingBalance: 148761 },
    );
    expect(r.lines.map((l) => [l.n, l.flow, l.amount])).toEqual([
      [1, "in", 50000],
      [2, "out", 1239],
    ]);
    expect(r.warnings).toEqual([]);
  });

  it("warns when balances do not add up or a line cannot be read", () => {
    const r = read(
      [
        { date: "2026-11-06", narration: "A", credit: 100, balance: 1200 },
        { date: "07/11/2026", narration: "bad date", debit: 5, balance: 1195 },
      ],
      { openingBalance: 1000, closingBalance: 1195 },
    );
    expect(r.lines).toHaveLength(1);
    expect(r.warnings.join(" ")).toMatch(/Line 2.*left out.*running balance does not add up/);
  });
});

describe("matchLines", () => {
  const line = (n: number, date: string, amount: number, narration = "", flow: "in" | "out" = "in") => ({ n, date, narration, reference: null, flow, amount });
  const rec = (key: string, date: string, amount: number, reference: string | null = null, flow: "in" | "out" = "in"): BankRecord => ({ key, flow, date, amount, reference, label: key, href: "#" });

  it("prefers a shared reference, then the nearest date; each record once", () => {
    const lines = [line(1, "2026-11-07", 500, "UPI/CR/631907458812/RAVI"), line(2, "2026-11-07", 500)];
    const records = [rec("near", "2026-11-07", 500), rec("byref", "2026-11-05", 500, "631907458812")];
    const m = matchLines(lines, records);
    expect(m.get(1)?.key).toBe("byref");
    expect(m.get(2)?.key).toBe("near");
  });

  it("does not match a different amount, direction or a date too far away", () => {
    const m = matchLines([line(1, "2026-11-07", 500)], [rec("a", "2026-11-07", 501), rec("b", "2026-11-07", 500, null, "out"), rec("c", "2026-11-20", 500)]);
    expect(m.size).toBe(0);
  });
});

describe("statement helpers", () => {
  it("reads the payment mode from the narration", () => {
    expect(modeFromNarration("UPI/CR/1234/RAVI")).toBe("upi");
    expect(modeFromNarration("CHQ DEP 001234")).toBe("cheque");
    expect(modeFromNarration("NEFT-ABC123-DEMO")).toBe("bank");
  });

  it("finds the party by the mobile number in a UPI ID, then by a whole name", () => {
    const parties = [
      { id: 1, name: "Sample Motors", mobile: "9000000003" },
      { id: 2, name: "Demo Auto Spares", mobile: null },
    ];
    expect(partyInNarration("UPI/CR/631907458812/RAVI KUMAR/9000000003@ybl", parties)).toBe(1);
    expect(partyInNarration("IMPS/P2A/631711224455/DEMO AUTO SPARES/DAS-1023", parties)).toBe(2);
    expect(partyInNarration("NEFT FROM SOMEONE", parties)).toBeNull();
  });

  it("builds a form link with the UTR as the reference", () => {
    const q = new URLSearchParams(prefillQuery({ n: 1, date: "2026-11-13", narration: "IMPS/631711224455/DEMO", reference: null, flow: "out", amount: 1239 }, { vendor: 22 }));
    expect(Object.fromEntries(q)).toMatchObject({ amount: "1239", date: "2026-11-13", mode: "bank", ref: "631711224455", vendor: "22" });
  });
});
