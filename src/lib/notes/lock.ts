/**
 * Encryption for locked notes, done only in the browser with Web Crypto.
 * The password becomes an AES-256-GCM key through PBKDF2-SHA-256; the server
 * only ever stores the salt and ciphertext.
 */
import { LOCK_CHECK_PHRASE, LOCK_ITERATIONS } from "./notes";

const enc = new TextEncoder();
const dec = new TextDecoder();

export function toBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

export function fromBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

export async function deriveKey(password: string, saltB64: string, iterations: number): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: fromBase64(saltB64), iterations },
    base,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

/** IV followed by ciphertext. */
export async function encryptBytes(key: CryptoKey, data: BufferSource): Promise<Uint8Array<ArrayBuffer>> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data));
  const out = new Uint8Array(12 + ct.length);
  out.set(iv);
  out.set(ct, 12);
  return out;
}

export async function decryptBytes(key: CryptoKey, data: Uint8Array<ArrayBuffer>): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt({ name: "AES-GCM", iv: data.subarray(0, 12) }, key, data.subarray(12));
}

export const encryptText = async (key: CryptoKey, text: string) => toBase64(await encryptBytes(key, enc.encode(text)));
export const decryptText = async (key: CryptoKey, b64: string) => dec.decode(await decryptBytes(key, fromBase64(b64)));

/** A new lock: a random salt and the encrypted check phrase, plus the key to use now. */
export async function makeLock(password: string) {
  const salt = toBase64(crypto.getRandomValues(new Uint8Array(16)));
  const key = await deriveKey(password, salt, LOCK_ITERATIONS);
  const check = await encryptText(key, LOCK_CHECK_PHRASE);
  return { key, salt, iterations: LOCK_ITERATIONS, check };
}

/** The key if the password is right, otherwise null. */
export async function openLock(password: string, lock: { salt: string; iterations: number; check: string }) {
  try {
    const key = await deriveKey(password, lock.salt, lock.iterations);
    return (await decryptText(key, lock.check)) === LOCK_CHECK_PHRASE ? key : null;
  } catch {
    return null;
  }
}
