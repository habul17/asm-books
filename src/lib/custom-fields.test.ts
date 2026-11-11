import { describe, expect, it } from "vitest";

import { editFieldSchema, newFieldSchema, parseExtra, shownExtra, type CustomFieldDef } from "./custom-fields";

const fields: CustomFieldDef[] = [
  { id: 1, label: "Vehicle number", type: "text", active: true },
  { id: 2, label: "Odometer", type: "number", active: true },
  { id: 3, label: "Order date", type: "date", active: true },
  { id: 4, label: "Old field", type: "text", active: false },
];

const reader = (typed: Record<string, unknown>) => (fieldId: number) => typed[String(fieldId)];

describe("parseExtra", () => {
  it("reads each type and leaves out empty values", () => {
    const { value } = parseExtra(fields, reader({ "1": " TN 37 AB 1234 ", "2": "1,25,000", "3": "" }));
    expect(value).toEqual({ "1": "TN 37 AB 1234", "2": 125000 });
  });

  it("keeps what a switched-off field had and ignores what was typed for it", () => {
    const { value } = parseExtra(fields, reader({ "4": "typed" }), { "4": "kept" });
    expect(value).toEqual({ "4": "kept" });
  });

  it("drops values for fields that do not exist", () => {
    const { value } = parseExtra(fields, reader({ "9": "stray" }), { "9": "stray" });
    expect(value).toEqual({});
  });

  it("clears a value when the box is emptied", () => {
    const { value } = parseExtra(fields, reader({ "1": "  " }), { "1": "TN 37 AB 1234" });
    expect(value).toEqual({});
  });

  it("names the field that is wrong", () => {
    expect(parseExtra(fields, reader({ "2": "far" })).error).toBe("Odometer must be a number");
    expect(parseExtra(fields, reader({ "3": "15-01-2024" })).error).toBe("Order date must be a date");
    expect(parseExtra(fields, reader({ "1": 5 })).value).toEqual({});
  });

  it("cuts very long text", () => {
    const { value } = parseExtra(fields, reader({ "1": "x".repeat(1500) }));
    expect(String(value?.["1"])).toHaveLength(1000);
  });
});

describe("shownExtra", () => {
  it("lists filled-in fields that are switched on, in field order", () => {
    const shown = shownExtra(fields, { "3": "2024-01-15", "1": "TN 37 AB 1234", "4": "hidden", "9": "stray" });
    expect(shown).toEqual([
      { id: 1, label: "Vehicle number", value: "TN 37 AB 1234" },
      { id: 3, label: "Order date", value: "15-01-2024" },
    ]);
  });

  it("shows numbers as typed, including zero", () => {
    expect(shownExtra(fields, { "2": 0 })).toEqual([{ id: 2, label: "Odometer", value: "0" }]);
  });
});

describe("field schemas", () => {
  it("needs a name and a known type", () => {
    expect(newFieldSchema.safeParse({ label: " Vehicle number ", type: "text" }).data).toEqual({
      label: "Vehicle number",
      type: "text",
    });
    expect(newFieldSchema.safeParse({ label: "  ", type: "text" }).success).toBe(false);
    expect(newFieldSchema.safeParse({ label: "Colour", type: "list" }).success).toBe(false);
  });

  it("reads the Shown checkbox", () => {
    expect(editFieldSchema.safeParse({ label: "Colour", active: "on" }).data?.active).toBe(true);
    expect(editFieldSchema.safeParse({ label: "Colour" }).data?.active).toBe(false);
  });
});
