import { describe, expect, it } from "vitest";

import { describeRule, flattenFolders, folderPathResolver } from "./folders";

const folders = [
  { id: 1, name: "Dealers", parentId: null },
  { id: 2, name: "North", parentId: 1 },
  { id: 3, name: "Area 10", parentId: 1 },
  { id: 4, name: "Area 9", parentId: 1 },
  { id: 5, name: "Retail", parentId: null },
];

describe("folderPathResolver", () => {
  it("joins parent names from the top", () => {
    const path = folderPathResolver(folders);
    expect(path(2)).toBe("Dealers › North");
    expect(path(null)).toBe("");
  });
});

describe("flattenFolders", () => {
  it("lists folders in tree order with natural name sorting", () => {
    expect(flattenFolders(folders).map((f) => `${f.depth}:${f.name}`)).toEqual([
      "0:Dealers",
      "1:Area 9",
      "1:Area 10",
      "1:North",
      "0:Retail",
    ]);
  });
});

describe("describeRule", () => {
  it("summarises the rule in one line", () => {
    const rule = { base: "purchase", adjustType: "markup", adjustPct: 20, discountPct: 5, roundTo: 1 };
    expect(describeRule(rule)).toBe("Purchase +20%, 5% disc., round ₹1");
    expect(describeRule({ ...rule, base: "manual" })).toBe("Manual prices only");
  });
});
