"use client";

import { CheckIcon, RotateCwIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";

import { checkStatementAction, scanStatementAction } from "@/app/(app)/banking/actions";
import { ScanBox, ScanWarnings } from "@/components/forms/scan-box";
import { Button, buttonVariants } from "@/components/ui/button";
import { formatDate, formatMoney } from "@/lib/format";
import type { LineCheck, StatementRead } from "@/server/bank-statement";

/** The statement read last, kept in this browser tab only, so coming back from a form re-checks it. */
const KEY = "asm-bank-statement";

function load(): StatementRead | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as StatementRead) : null;
  } catch {
    return null;
  }
}
function keep(s: StatementRead | null) {
  try {
    if (s) sessionStorage.setItem(KEY, JSON.stringify(s));
    else sessionStorage.removeItem(KEY);
  } catch {
    // Private windows can block storage; the check still works until the page is left.
  }
}

type Result = { checks: Map<number, LineCheck>; inApp: number; missingIn: number; missingOut: number };

export function StatementCheck({ scanReady }: { scanReady: boolean }) {
  const [statement, setStatement] = useState<StatementRead | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [onlyMissing, setOnlyMissing] = useState(true);
  const [checking, startChecking] = useTransition();

  const check = useCallback((s: StatementRead) => {
    startChecking(async () => {
      setStatement(s);
      setError(null);
      const r = await checkStatementAction(s.lines).catch(() => ({ error: "Could not check the statement. Check your internet." }));
      if ("error" in r) return setError(r.error);
      setResult({ ...r, checks: new Map(r.checks.map((c) => [c.n, c])) });
    });
  }, []);

  // Coming back from a form: check the kept statement again, so newly saved lines show as done.
  useEffect(() => {
    const kept = load();
    if (kept) check(kept);
  }, [check]);

  const read = (s: StatementRead) => {
    keep(s);
    setResult(null);
    check(s);
  };
  const clear = () => {
    keep(null);
    setStatement(null);
    setResult(null);
  };

  const shown = statement?.lines.filter((l) => !onlyMissing || !result || !result.checks.get(l.n)?.found) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <ScanBox
        ready={scanReady}
        noun="bank statement"
        help="Download the statement PDF from your bank (one month at a time works best) and upload it. Each line is checked against the app."
        waitHelp="A month of entries can take 1 to 3 minutes. Please keep this screen open."
        action={scanStatementAction}
        onScan={read}
      />

      {statement && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm">
              <span className="font-medium">
                {statement.bankName ?? "Bank statement"}
                {statement.accountEnding ? ` ··${statement.accountEnding}` : ""}
              </span>{" "}
              · {statement.lines.length} lines
              {result && (
                <>
                  {" "}
                  · <span className="font-medium">{result.inApp} already in the app</span>
                  {result.missingIn + result.missingOut > 0 && (
                    <>
                      {" "}
                      · missing <span className="font-medium tabular-nums">{formatMoney(result.missingIn)}</span> in and{" "}
                      <span className="font-medium tabular-nums">{formatMoney(result.missingOut)}</span> out
                    </>
                  )}
                </>
              )}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="sm" disabled={checking} onClick={() => check(statement)}>
                <RotateCwIcon className={checking ? "animate-spin" : undefined} /> {checking ? "Checking…" : "Check again"}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={clear}>
                <XIcon /> Clear
              </Button>
            </div>
          </div>

          <ScanWarnings warnings={statement.warnings} />
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}

          <div className="flex rounded-lg bg-muted p-0.5 text-sm self-start" role="radiogroup" aria-label="Lines to show">
            {[true, false].map((v) => (
              <button
                key={String(v)}
                type="button"
                role="radio"
                aria-checked={onlyMissing === v}
                onClick={() => setOnlyMissing(v)}
                className={`rounded-md px-2.5 py-1 ${onlyMissing === v ? "bg-background font-medium shadow-sm" : "text-muted-foreground"}`}
              >
                {v ? "Missing only" : "All lines"}
              </button>
            ))}
          </div>

          <section aria-label="Statement lines" className="divide-y rounded-xl border">
            {result && shown.length === 0 && (
              <p className="p-6 text-center text-sm text-muted-foreground">Every line on the statement is in the app.</p>
            )}
            {shown.map((l) => {
              const c = result?.checks.get(l.n);
              return (
                <div key={l.n} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="text-muted-foreground">{formatDate(l.date)}</span>{" "}
                      <span className={`font-medium tabular-nums ${l.flow === "in" ? "" : "text-destructive"}`}>
                        {l.flow === "in" ? "+" : "−"}
                        {formatMoney(l.amount)}
                      </span>
                    </p>
                    <p className="break-words text-xs text-muted-foreground">{l.narration}</p>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-1.5 sm:max-w-[55%] sm:justify-end">
                    {!c ? (
                      <span className="text-xs text-muted-foreground">{checking ? "Checking…" : ""}</span>
                    ) : c.found ? (
                      <Link href={c.found.href} className="flex items-center gap-1 text-sm underline-offset-4 hover:underline">
                        <CheckIcon className="size-4" /> {c.found.label}
                      </Link>
                    ) : (
                      c.add.map((a, i) => (
                        <Link key={a.href} href={a.href} className={buttonVariants({ variant: i === 0 ? "outline" : "ghost", size: "xs" })}>
                          {a.label}
                        </Link>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </section>
          <p className="text-xs text-muted-foreground">
            The statement is kept only in this browser tab until you press Clear or close the tab. Nothing is saved until you
            save a form.
          </p>
        </>
      )}
    </div>
  );
}
