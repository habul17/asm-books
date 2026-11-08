import { passwordProblem, PASSWORD_MAX } from "./password";

export const USERNAME_RE = /^[a-zA-Z0-9._-]{3,50}$/;
export const NAME_MAX = 100;
export const ROLES = ["owner", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = { owner: "Owner", staff: "Staff" };

type Result<T> = { value: T; error?: undefined } | { value?: undefined; error: string };

const text = (v: unknown) => (typeof v === "string" ? v : "");

function readName(v: unknown): Result<string> {
  const name = text(v).trim().replace(/\s+/g, " ");
  if (!name) return { error: "Enter the person's name." };
  if (name.length > NAME_MAX) return { error: `Keep the name under ${NAME_MAX} characters.` };
  return { value: name };
}

function readRole(v: unknown): Result<Role> {
  const role = text(v);
  return (ROLES as readonly string[]).includes(role) ? { value: role as Role } : { error: "Choose owner or staff." };
}

/** A new password typed twice. */
function readNewPassword(password: unknown, confirm: unknown, username: string): Result<string> {
  const p = text(password);
  const problem = passwordProblem(p, username);
  if (problem) return { error: `Password: ${problem}` };
  if (text(confirm) !== p) return { error: "The two passwords do not match." };
  return { value: p };
}

export interface NewUserInput {
  username: string;
  name: string;
  role: Role;
  password: string;
}

export function parseNewUser(input: Record<string, unknown>): Result<NewUserInput> {
  const username = text(input.username).trim();
  if (!USERNAME_RE.test(username)) {
    return { error: "Username: 3 to 50 letters, digits, dots, dashes or underscores (no spaces)." };
  }
  const name = readName(input.name);
  if (name.error !== undefined) return name;
  const role = readRole(input.role);
  if (role.error !== undefined) return role;
  const password = readNewPassword(input.password, input.confirm, username);
  if (password.error !== undefined) return password;
  return { value: { username, name: name.value, role: role.value, password: password.value } };
}

export interface UserUpdateInput {
  name: string;
  role: Role;
  active: boolean;
}

export function parseUserUpdate(input: Record<string, unknown>): Result<UserUpdateInput> {
  const name = readName(input.name);
  if (name.error !== undefined) return name;
  const role = readRole(input.role);
  if (role.error !== undefined) return role;
  return { value: { name: name.value, role: role.value, active: input.active === "on" || input.active === true } };
}

/** A password set by the owner for someone else. */
export function parsePasswordReset(input: Record<string, unknown>, username: string): Result<string> {
  return readNewPassword(input.password, input.confirm, username);
}

/** A user changing their own password: the current one, then the new one twice. */
export function parsePasswordChange(
  input: Record<string, unknown>,
  username: string,
): Result<{ current: string; password: string }> {
  const current = text(input.current);
  if (!current) return { error: "Enter your current password." };
  if (current.length > PASSWORD_MAX) return { error: "Your current password is wrong." };
  const password = readNewPassword(input.password, input.confirm, username);
  if (password.error !== undefined) return password;
  if (password.value === current) return { error: "The new password must be different from the current one." };
  return { value: { current, password: password.value } };
}
