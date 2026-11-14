"use client";

import { Popover } from "@base-ui/react/popover";
import { InfoIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";

/**
 * A small (i) that shows a short explanation, so screens stay clean.
 * Opens on hover or keyboard focus on a computer and on tap on a phone;
 * tapping outside or pressing Esc closes it. Hidden when printing.
 */
export function InfoTip({
  children,
  label = "What is this?",
  className,
}: {
  children: ReactNode;
  /** Read out by screen readers for the (i) button. */
  label?: string;
  className?: string;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger
        openOnHover
        delay={120}
        aria-label={label}
        className={cn(
          "relative -my-1 inline-flex size-6 shrink-0 items-center justify-center rounded-full align-middle text-muted-foreground transition-colors outline-none",
          "after:absolute after:-inset-2 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 data-[popup-open]:text-foreground print:hidden",
          className,
        )}
      >
        <InfoIcon className="size-4" aria-hidden />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="start" sideOffset={6} collisionPadding={16} className="z-50">
          <Popover.Popup className="max-w-[min(20rem,calc(100vw-2rem))] rounded-xl border bg-popover px-3.5 py-2.5 text-sm leading-relaxed font-normal text-popover-foreground shadow-lg outline-none transition-opacity data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 [&_a]:underline [&_a]:underline-offset-4">
            {children}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
