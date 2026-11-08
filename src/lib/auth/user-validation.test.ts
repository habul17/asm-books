import { describe, expect, it } from "vitest";

import { parseNewUser, parsePasswordChange, parsePasswordReset, parseUserUpdate } from "./user-validation";

const good = { username: "ravi.k", name: "  Ravi   Kumar ", role: "staff", password: "shop counter 42", confirm: "shop counter 42" };

describe("parseNewUser", () => {
  it("accepts a valid user and tidies the name", () => {
    expect(parseNewUser(good)).toEqual({
      value: { username: "ravi.k", name: "Ravi Kumar", role: "staff", password: "shop counter 42" },
    });
  });

  it("rejects bad usernames", () => {
    for (const username of ["ab", "has space", "x".repeat(51), "émile", ""]) {
      expect(parseNewUser({ ...good, username }).error).toMatch(/Username/);
    }
  });

  it("needs a name and a known role", () => {
    expect(parseNewUser({ ...good, name: "  " }).error).toMatch(/name/);
    expect(parseNewUser({ ...good, role: "admin" }).error).toMatch(/owner or staff/);
  });

  it("checks the password and its confirmation", () => {
    expect(parseNewUser({ ...good, password: "short", confirm: "short" }).error).toMatch(/at least/);
    expect(parseNewUser({ ...good, password: "my ravi.k pass", confirm: "my ravi.k pass" }).error).toMatch(/username/);
    expect(parseNewUser({ ...good, confirm: "something else" }).error).toMatch(/do not match/);
  });
});

describe("parseUserUpdate", () => {
  it("reads the checkbox", () => {
    expect(parseUserUpdate({ name: "Ravi", role: "owner", active: "on" })).toEqual({
      value: { name: "Ravi", role: "owner", active: true },
    });
    expect(parseUserUpdate({ name: "Ravi", role: "staff" }).value?.active).toBe(false);
  });
});

describe("password changes", () => {
  it("resets with a confirmed password", () => {
    expect(parsePasswordReset({ password: "new secret 99", confirm: "new secret 99" }, "ravi")).toEqual({ value: "new secret 99" });
    expect(parsePasswordReset({ password: "new secret 99", confirm: "x" }, "ravi").error).toMatch(/match/);
  });

  it("needs the current password and a different new one", () => {
    expect(parsePasswordChange({ password: "new secret 99", confirm: "new secret 99" }, "ravi").error).toMatch(/current/);
    expect(
      parsePasswordChange({ current: "new secret 99", password: "new secret 99", confirm: "new secret 99" }, "ravi").error,
    ).toMatch(/different/);
    expect(
      parsePasswordChange({ current: "old secret 11", password: "new secret 99", confirm: "new secret 99" }, "ravi"),
    ).toEqual({ value: { current: "old secret 11", password: "new secret 99" } });
  });
});
