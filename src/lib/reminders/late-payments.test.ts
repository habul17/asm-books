import { describe, expect, it } from "vitest";

import {
  daysBetween,
  findLatePayers,
  reminderMessage,
  whatsappLink,
  type OpenInvoice,
  type OwingCustomer,
} from "./late-payments";

const TODAY = "2026-11-20";

const customer = (over: Partial<OwingCustomer> = {}): OwingCustomer => ({
  id: 1,
  name: "Ravi Motors",
  mobile: "98765 43210",
  city: "Coimbatore",
  since: "2026-01-01",
  balance: 0,
  ...over,
});

let nextId = 1;
const invoice = (over: Partial<OpenInvoice>): OpenInvoice => ({
  id: nextId++,
  number: `INV/${nextId}`,
  customerId: 1,
  date: TODAY,
  dueDate: null,
  grandTotal: 0,
  newer: 0,
  ...over,
});

describe("daysBetween", () => {
  it("counts whole days across months and years", () => {
    expect(daysBetween("2026-11-05", "2026-11-20")).toBe(15);
    expect(daysBetween("2025-12-31", "2026-01-01")).toBe(1);
    expect(daysBetween("2026-11-20", "2026-11-19")).toBe(-1);
  });
});

describe("findLatePayers", () => {
  it("flags a bill on the day it turns 15 days old, not before", () => {
    const c = customer({ balance: 500 });
    const fourteen = invoice({ date: "2026-11-06", grandTotal: 500 });
    const fifteen = invoice({ date: "2026-11-05", grandTotal: 500 });
    expect(findLatePayers([c], [fourteen], TODAY, 15)).toEqual([]);
    const [late] = findLatePayers([c], [fifteen], TODAY, 15);
    expect(late).toMatchObject({ id: 1, lateAmount: 500, days: 15, oldestDate: "2026-11-05" });
  });

  it("treats payments as paying the oldest bills first", () => {
    // Bills of 1000 (old), 600 (old) and 400 (new); 1200 was paid, so 800 is owed:
    // all of the new 400 and 400 of the 600. The oldest bill is fully paid.
    const c = customer({ balance: 800 });
    const rows = [
      invoice({ number: "NEW", date: "2026-11-18", grandTotal: 400, newer: 0 }),
      invoice({ number: "MID", date: "2026-10-10", grandTotal: 600, newer: 400 }),
    ];
    const [late] = findLatePayers([c], rows, TODAY, 15);
    expect(late.lateAmount).toBe(400);
    expect(late.balance).toBe(800);
    expect(late.bills).toEqual([{ id: rows[1].id, number: "MID", date: "2026-10-10", unpaid: 400 }]);
    expect(late.days).toBe(41);
  });

  it("uses the due date when the bill has one", () => {
    const c = customer({ balance: 900 });
    const notDue = invoice({ date: "2026-10-01", dueDate: "2026-11-20", grandTotal: 900 });
    const pastDue = invoice({ date: "2026-11-15", dueDate: "2026-11-19", grandTotal: 900 });
    expect(findLatePayers([c], [notDue], TODAY, 15)).toEqual([]);
    expect(findLatePayers([c], [pastDue], TODAY, 15)).toHaveLength(1);
  });

  it("counts an opening balance from the day the customer was added", () => {
    const old = customer({ balance: 2500, since: "2026-06-01" });
    const fresh = customer({ id: 2, balance: 2500, since: "2026-11-15" });
    const result = findLatePayers([old, fresh], [], TODAY, 15);
    expect(result).toHaveLength(1);
    expect(result[0].bills).toEqual([{ id: null, number: "Opening balance", date: "2026-06-01", unpaid: 2500 }]);
  });

  it("adds an unpaid opening balance to late bills", () => {
    const c = customer({ balance: 1500, since: "2026-04-01" });
    const [late] = findLatePayers([c], [invoice({ date: "2026-10-01", grandTotal: 1000 })], TODAY, 15);
    expect(late.lateAmount).toBe(1500);
    expect(late.oldestDate).toBe("2026-04-01");
    expect(late.bills.map((b) => b.unpaid)).toEqual([500, 1000]);
  });

  it("leaves out customers who owe nothing, paid in advance or owe only paise", () => {
    const rows = [invoice({ date: "2026-01-01", grandTotal: 0.4 })];
    expect(findLatePayers([customer({ balance: 0 })], [], TODAY, 15)).toEqual([]);
    expect(findLatePayers([customer({ balance: -300 })], [], TODAY, 15)).toEqual([]);
    expect(findLatePayers([customer({ balance: 0.4 })], rows, TODAY, 15)).toEqual([]);
  });

  it("puts the longest wait first", () => {
    const a = customer({ id: 1, name: "A", balance: 100 });
    const b = customer({ id: 2, name: "B", balance: 100 });
    const rows = [
      invoice({ customerId: 1, date: "2026-10-20", grandTotal: 100 }),
      invoice({ customerId: 2, date: "2026-09-20", grandTotal: 100 }),
    ];
    expect(findLatePayers([a, b], rows, TODAY, 15).map((p) => p.name)).toEqual(["B", "A"]);
  });
});

describe("whatsappLink", () => {
  it("adds the India code to ten-digit numbers and fills in the message", () => {
    expect(whatsappLink("98765 43210", "Hi there")).toBe("https://wa.me/919876543210?text=Hi%20there");
    expect(whatsappLink("+91-98765-43210", "x")).toBe("https://wa.me/919876543210?text=x");
    expect(whatsappLink("09876543210", "x")).toBe("https://wa.me/919876543210?text=x");
  });

  it("gives nothing for a missing or short number", () => {
    expect(whatsappLink(null, "x")).toBeNull();
    expect(whatsappLink("0422 123", "x")).toBeNull();
  });
});

describe("reminderMessage", () => {
  it("names the shop when it is known", () => {
    expect(reminderMessage("Ravi", "₹500.00", 15, "ASM Autoparts")).toContain("pending with ASM Autoparts for more than 15 days");
    expect(reminderMessage("Ravi", "₹500.00", 15, "")).toContain("is pending for more than 15 days");
  });
});
