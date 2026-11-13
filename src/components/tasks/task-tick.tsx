"use client";

import { CheckIcon } from "lucide-react";
import { useTransition } from "react";
import { cn } from "cn";

import { toggleTask } from "@/app/(app)/tasks/actions";

/** The round tick box beside a task: press to mark it done, press again to open it. */
export function TaskTick({ id, done, title }: { id: number; done: boolean; title: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Open again: ${title}` : `Mark done: ${title}`}
      disabled={pending}
      onClick={() => start(async () => void (await toggleTask(id, !done)))}
      className={cn(
        "flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
        done ? "border-emerald-600 bg-emerald-600 text-white" : "border-muted-foreground/50 hover:border-emerald-600",
        pending && "opacity-50",
      )}
    >
      {done && <CheckIcon className="size-4" aria-hidden />}
    </button>
  );
}
