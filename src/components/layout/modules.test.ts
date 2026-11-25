import { describe, expect, it } from "vitest";

import { sectionFor } from "./modules";

describe("sectionFor", () => {
  it("names the main screen of a section", () => {
    expect(sectionFor("/")).toEqual({ label: "Home", href: "/" });
    expect(sectionFor("/invoices")).toEqual({ label: "Invoices", href: "/invoices" });
    expect(sectionFor("/more")).toEqual({ label: "More", href: "/more" });
  });

  it("names the section for screens inside it", () => {
    expect(sectionFor("/invoices/12/edit")?.label).toBe("Invoices");
    expect(sectionFor("/banking/statement")?.label).toBe("Banking");
    expect(sectionFor("/sales/quotes/new")?.label).toBe("Quotes");
    expect(sectionFor("/reports/balance-sheet")?.label).toBe("Reports");
    expect(sectionFor("/profit-share/new")?.label).toBe("Profit Share");
  });

  it("does not mix up sections whose addresses start alike", () => {
    expect(sectionFor("/payments-made/new")?.label).toBe("Payments Made");
    expect(sectionFor("/payments/new")?.label).toBe("Payments Received");
  });

  it("names nothing for an unknown screen", () => {
    expect(sectionFor("/nowhere")).toBeNull();
    expect(sectionFor(null)).toBeNull();
  });
});
