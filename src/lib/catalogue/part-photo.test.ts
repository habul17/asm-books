import { describe, expect, it } from "vitest";

import { partFamily } from "./part-photo";

describe("partFamily", () => {
  it("is the leading number of a part", () => {
    expect(partFamily("3943A")).toBe("3943");
    expect(partFamily("3943")).toBe("3943");
    expect(partFamily(" 101A ")).toBe("101");
    expect(partFamily("9802WH")).toBe("9802");
  });

  it("is null for numbers that are too short or start with letters", () => {
    expect(partFamily("12A")).toBeNull();
    expect(partFamily("ZZTEST-1")).toBeNull();
    expect(partFamily("")).toBeNull();
  });
});
