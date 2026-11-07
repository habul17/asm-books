import { describe, expect, it } from "vitest";

import { isSessionToken, newSessionToken, safeNextPath, sessionIdFromToken } from "./session-token";

describe("session tokens", () => {
  it("are random, well formed and hashed for storage", () => {
    const a = newSessionToken();
    const b = newSessionToken();
    expect(a).not.toBe(b);
    expect(isSessionToken(a)).toBe(true);
    expect(sessionIdFromToken(a)).toMatch(/^[0-9a-f]{64}$/);
    expect(sessionIdFromToken(a)).not.toContain(a);
  });

  it("rejects malformed cookie values", () => {
    for (const bad of [undefined, "", "abc", "x".repeat(44), "a b".padEnd(43, "c"), "'; DROP TABLE".padEnd(43, "x")]) {
      expect(isSessionToken(bad)).toBe(false);
    }
  });
});

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/customers?id=4")).toBe("/customers?id=4");
    expect(safeNextPath("/price-lists")).toBe("/price-lists");
  });

  it("falls back to / for anything else", () => {
    for (const bad of [
      undefined,
      "",
      "https://evil.example",
      "//evil.example",
      "/\\evil.example",
      "/ok\\..",
      "/x\n",
      "/login",
      "/login?next=/x",
      "/" + "a".repeat(600),
    ]) {
      expect(safeNextPath(bad)).toBe("/");
    }
  });
});
