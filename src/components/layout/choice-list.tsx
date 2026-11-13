"use client";

import { CheckIcon, type LucideIcon } from "lucide-react";

export interface Choice<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

/**
 * Pick one of a few options, drawn like the More screen's rows:
 * a rounded card of rows, the chosen one with a tick.
 */
export function ChoiceList<T extends string>({
  title,
  note,
  choices,
  value,
  onChange,
}: {
  title: string;
  note?: string;
  choices: Choice<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-sm font-semibold text-muted-foreground">{title}</h2>
      <ul role="radiogroup" aria-label={title} className="divide-y overflow-hidden rounded-2xl border bg-card">
        {choices.map((c) => {
          const chosen = c.value === value;
          return (
            <li key={c.value}>
              <button
                type="button"
                role="radio"
                aria-checked={chosen}
                onClick={() => onChange(c.value)}
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left font-medium hover:bg-muted/60"
              >
                {c.icon && <c.icon className="size-5 shrink-0 text-muted-foreground" aria-hidden />}
                <span className="flex-1 truncate">{c.label}</span>
                {chosen && <CheckIcon className="size-4 shrink-0" aria-hidden />}
              </button>
            </li>
          );
        })}
      </ul>
      {note && <p className="px-1 text-sm text-muted-foreground">{note}</p>}
    </section>
  );
}
