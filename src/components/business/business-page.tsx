import Link from "next/link";
import type { ReactNode } from "react";

import { OwnerGate } from "@/components/layout/owner-gate";
import { Skeleton } from "@/components/ui/skeleton";
import { InfoTip } from "@/components/ui/info-tip";

/** Frame for one Business details screen: back link, title, owner-only body in a card. */
export function BusinessPage({
  title,
  note,
  after,
  children,
}: {
  title: string;
  note?: string;
  /** Shown under the card, also to the owner only. */
  after?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="flex flex-col gap-1">
        <Link href="/business" className="w-fit text-sm text-muted-foreground hover:underline">
          ← Business details
        </Link>
        <h1 className="text-xl font-semibold">
          {title}{" "}
          {note && <InfoTip label={`About ${title}`}>{note}</InfoTip>}
        </h1>
      </div>
      <OwnerGate what="change business details" fallback={<Skeleton className="h-64 rounded-2xl" />}>
        <div className="rounded-2xl border bg-card p-4 sm:p-6">{children}</div>
        {after}
      </OwnerGate>
    </div>
  );
}
