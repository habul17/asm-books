#!/usr/bin/env node
// Pre-commit guard: blocks secrets and business data from being committed.
// Runs on every `git commit` via Husky. Bypassing it (--no-verify) is not allowed.

import { execFileSync } from "node:child_process";

const git = (...args) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });

const staged = git("diff", "--cached", "--name-only", "--diff-filter=ACMR", "-z")
  .split("\0")
  .filter(Boolean);

const BLOCKED_FILES = [
  [/(^|\/)\.env(?!\.example$)(\..*)?$/i, "environment file"],
  [/\.(xlsx|xls|xlsm|ods|csv)$/i, "spreadsheet (may contain prices or customers)"],
  [/\.pdf$/i, "PDF document"],
  [/\.(db|sqlite|sqlite3|dump|bak|backup)$/i, "database file or backup"],
  [/\.(pem|key|p12|pfx|jks)$/i, "private key or certificate"],
  [/(^|\/)(id_rsa|id_ed25519)/i, "SSH key"],
  [/(^|\/)\.npmrc$/i, "npm config (may contain tokens)"],
  [/(^|\/)(credentials|service-account)[^/]*\.json$/i, "credentials file"],
];

const SECRET_PATTERNS = [
  [/postgres(ql)?:\/\/[^:\s"'`]+:[^@\s"'`]+@(?!HOST\b)[^\s"'`]+/i, "database URL with password"],
  [/\bnpg_[A-Za-z0-9]{8,}/, "Neon password"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "private key"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, "GitHub token"],
  [/\bgithub_pat_[A-Za-z0-9_]{30,}/, "GitHub token"],
  [/\bAKIA[0-9A-Z]{16}\b/, "AWS access key"],
  [/\bsk-[A-Za-z0-9_-]{20,}/, "API secret key"],
  [/\bxox[abpr]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/\b(api[_-]?key|secret|password|passwd|auth[_-]?token)\s*[:=]\s*["'][^"'\s]{12,}["']/i, "hard-coded credential"],
];

const problems = [];

for (const file of staged) {
  if (file === "scripts/check-staged.mjs") continue;
  const blocked = BLOCKED_FILES.find(([re]) => re.test(file));
  if (blocked) {
    problems.push(`${file}: ${blocked[1]}`);
    continue;
  }
  let content;
  try {
    content = git("show", `:${file}`);
  } catch {
    continue;
  }
  if (content.includes("\0")) continue; // binary
  content.split("\n").forEach((line, i) => {
    for (const [re, label] of SECRET_PATTERNS) {
      if (re.test(line)) problems.push(`${file}:${i + 1}: possible ${label}`);
    }
  });
}

if (problems.length) {
  console.error("\n✖ Commit blocked: sensitive content detected.\n");
  for (const p of problems) console.error(`  - ${p}`);
  console.error("\nRemove these from the commit (git restore --staged <file>) and keep secrets in .env.local.\n");
  process.exit(1);
}
