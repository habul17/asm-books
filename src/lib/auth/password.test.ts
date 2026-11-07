import { describe, expect, it } from "vitest";

import { hashPassword, passwordProblem, verifyPassword } from "./password";

const FAST = { N: 2 ** 10, r: 8, p: 1 };

describe("hashPassword / verifyPassword", () => {
  it("accepts the right password and rejects a wrong one", async () => {
    const stored = await hashPassword("correct horse battery", FAST);
    expect(stored).toMatch(/^scrypt\$1024\$8\$1\$[\w-]+\$[\w-]+$/);
    expect(await verifyPassword("correct horse battery", stored)).toBe(true);
    expect(await verifyPassword("correct horse batterY", stored)).toBe(false);
  });

  it("salts every hash", async () => {
    expect(await hashPassword("same password", FAST)).not.toBe(await hashPassword("same password", FAST));
  });

  it("uses the default (strong) parameters", async () => {
    const stored = await hashPassword("default params check");
    expect(stored.startsWith("scrypt$131072$8$1$")).toBe(true);
    expect(await verifyPassword("default params check", stored)).toBe(true);
  });

  it("returns false for malformed hashes instead of throwing", async () => {
    for (const bad of ["", "plain", "scrypt$x$8$1$a$b", "bcrypt$1024$8$1$aa$bb", "scrypt$1024$8$1$$"]) {
      expect(await verifyPassword("anything", bad)).toBe(false);
    }
  });
});

describe("passwordProblem", () => {
  it("checks length, repetition and username", () => {
    expect(passwordProblem("short")).toMatch(/at least/);
    expect(passwordProblem("x".repeat(201))).toMatch(/at most/);
    expect(passwordProblem("aaaaaaaaaaaa")).toMatch(/repeat/);
    expect(passwordProblem("Owner-2026-shop", "owner")).toMatch(/username/);
    expect(passwordProblem("tyre rack forty two")).toBeNull();
  });
});
