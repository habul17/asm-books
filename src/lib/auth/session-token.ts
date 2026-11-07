import { createHash, randomBytes } from "node:crypto";

/** Name of the session cookie. `__Host-` makes the browser insist on HTTPS, path "/" and no domain. */
export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-asm_session" : "asm_session";

export const SESSION_DAYS = 30;

/** A new random cookie token (256 bits). */
export function newSessionToken() {
  return randomBytes(32).toString("base64url");
}

/** What is stored in the database: a hash, so a leaked table cannot be used as cookies. */
export function sessionIdFromToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Only well-formed tokens are looked up. */
export function isSessionToken(value: string | undefined): value is string {
  return typeof value === "string" && /^[\w-]{43}$/.test(value);
}

/**
 * Where to go after signing in. Only same-site paths are allowed, so a link
 * like /login?next=https://evil.example cannot send the user elsewhere.
 */
export function safeNextPath(next: unknown): string {
  if (typeof next !== "string" || next.length > 500) return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  if (/[\u0000-\u001f\\]/.test(next) || next.startsWith("/login")) return "/";
  return next;
}
