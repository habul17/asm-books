"use client";

import { useState, useTransition } from "react";

import { changeRecurring } from "@/app/(app)/recurring/actions";
import { Button } from "@/components/ui/button";

/** Skip, stop or start again; an error shows beside the buttons. */
export function RecurringActions({ id, active, due }: { id: number; active: boolean; due: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (change: "skip" | "stop" | "start") =>
    start(async () => {
      setError(null);
      const result = await changeRecurring(id, change);
      if (result.error) setError(result.error);
    });

  return (
    <>
      {active && due && (
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => run("skip")}>
          Skip this one
        </Button>
      )}
      {active ? (
        <Button type="button" variant="ghost" size="sm" disabled={pending} onClick={() => run("stop")}>
          Stop
        </Button>
      ) : (
        <Button type="button" variant="outline" size="sm" disabled={pending} onClick={() => run("start")}>
          Start again
        </Button>
      )}
      {error && (
        <span role="alert" className="basis-full text-sm text-destructive">
          {error}
        </span>
      )}
    </>
  );
}
