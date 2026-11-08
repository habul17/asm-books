// Turns a postgres:// URL into libpq environment variables, so the password is
// never put on a command line (where other programs could see it) or printed.

const PARAMS: Record<string, string> = {
  sslmode: "PGSSLMODE",
  channel_binding: "PGCHANNELBINDING",
  options: "PGOPTIONS",
  host: "PGHOST",
  port: "PGPORT",
};

export function pgEnv(url: string): Record<string, string> {
  const u = new URL(url);
  if (u.protocol !== "postgres:" && u.protocol !== "postgresql:") throw new Error("Not a postgres:// URL.");
  const env: Record<string, string | undefined> = {
    PGHOST: decodeURIComponent(u.hostname) || undefined,
    PGPORT: u.port || undefined,
    PGUSER: decodeURIComponent(u.username) || undefined,
    PGPASSWORD: decodeURIComponent(u.password) || undefined,
    PGDATABASE: decodeURIComponent(u.pathname.slice(1)) || undefined,
  };
  for (const [key, value] of u.searchParams) {
    const name = PARAMS[key];
    if (name) env[name] = value;
  }
  return Object.fromEntries(Object.entries(env).filter((e): e is [string, string] => e[1] !== undefined));
}

/** Hides connection strings and passwords in tool output before it is shown. */
export function redact(text: string, env: Record<string, string | undefined>): string {
  let out = text.replace(/postgres(ql)?:\/\/\S*/g, "[redacted]");
  if (env.PGPASSWORD) out = out.split(env.PGPASSWORD).join("[redacted]");
  return out;
}
