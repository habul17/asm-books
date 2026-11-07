import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from "node:crypto";

/**
 * Password hashing with scrypt (built into Node, no native add-ons).
 * Parameters follow the OWASP recommendation: N=2^17, r=8, p=1.
 * Stored format: scrypt$<N>$<r>$<p>$<salt base64url>$<hash base64url>
 */

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 200;

const DEFAULTS = { N: 2 ** 17, r: 8, p: 1 };
const KEY_LENGTH = 64;
const SALT_LENGTH = 16;

function derive(password: string, salt: Buffer, params: { N: number; r: number; p: number }) {
  const options: ScryptOptions = { ...params, maxmem: 256 * params.N * params.r };
  return new Promise<Buffer>((resolve, reject) =>
    scrypt(password.normalize("NFKC"), salt, KEY_LENGTH, options, (err, key) => (err ? reject(err) : resolve(key))),
  );
}

export async function hashPassword(password: string, params = DEFAULTS): Promise<string> {
  const salt = randomBytes(SALT_LENGTH);
  const key = await derive(password, salt, params);
  return ["scrypt", params.N, params.r, params.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/** Constant-time check. Returns false (never throws) for a malformed stored hash. */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [N, r, p] = parts.slice(1, 4).map(Number);
  if (![N, r, p].every((n) => Number.isSafeInteger(n) && n > 0) || N > 2 ** 20) return false;
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  if (salt.length === 0 || expected.length !== KEY_LENGTH) return false;
  const actual = await derive(password, salt, { N, r, p });
  return timingSafeEqual(actual, expected);
}

/** A real hash of a random password, used so unknown usernames take as long as wrong passwords. */
let dummy: Promise<string> | undefined;
export function dummyHash() {
  dummy ??= hashPassword(randomBytes(16).toString("hex"));
  return dummy;
}

/** Plain-English problem with a new password, or null when it is acceptable. */
export function passwordProblem(password: string, username = ""): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`;
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`;
  if (/^(.)\1*$/.test(password)) return "Do not repeat one character.";
  if (username && password.toLowerCase().includes(username.toLowerCase())) return "Do not include the username.";
  return null;
}
