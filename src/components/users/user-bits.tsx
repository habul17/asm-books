import { ChevronLeftIcon } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

/** "08-11-2026, 10:42 am" in India time. */
export function formatDateTime(d: Date | null): string {
  if (!d) return "never";
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).replace(/\//g, "-");
}

export function OwnerOnly({ what }: { what: string }) {
  return (
    <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      Only the owner can {what}. Ask the owner if you need a change.
    </p>
  );
}

export function BackTitle({ href, label, title }: { href: string; label: string; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <Link href={href} className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label={label}>
        <ChevronLeftIcon />
      </Link>
      <h1 className="text-xl font-semibold">{title}</h1>
    </div>
  );
}
