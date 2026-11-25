import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";

import { formatMoney } from "@/lib/format";
import { PARTNER_NAMES, PARTNERS, type Partner, type PartnerShare } from "@/lib/profit-share/share";
import type { ReceivedFigures } from "@/server/profit-received";

/** One label / amount line; a link with an arrow when `href` is given. */
function Line({
  label,
  note,
  value,
  strong = false,
  negative = false,
  href,
}: {
  label: string;
  note: string;
  value: string;
  strong?: boolean;
  negative?: boolean;
  href?: string;
}) {
  const body = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn(strong && "font-semibold")}>{label}</span>
        <span className="text-xs text-muted-foreground">{note}</span>
      </span>
      <span className={cn("shrink-0 text-right tabular-nums", strong ? "font-semibold" : "font-medium", negative && "text-destructive")}>
        {value}
      </span>
      {href && <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />}
    </>
  );
  const className = "flex items-center gap-3 px-4 py-3";
  return href ? (
    <Link href={href} className={cn(className, "hover:bg-muted/60")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

const SHARE_LINES = [
  { key: "share", label: "50% of profit" },
  { key: "expenses", label: "Expenses" },
  { key: "final", label: "Final profit" },
] as const;

/** Each partner's half of the profit, the expenses taken off it, and what is left, side by side. */
export function ShareTable({ share }: { share: Record<Partner, PartnerShare> }) {
  return (
    <table className="w-full border-t">
      <caption className="sr-only">Each partner&apos;s half of the profit, less their expenses</caption>
      <thead>
        <tr>
          {/* The labels take the spare width, so the amounts sit together on the right. */}
          <th scope="col" className="w-full px-3 pt-3 pb-1 sm:px-4">
            <span className="sr-only">Figure</span>
          </th>
          {PARTNERS.map((p) => (
            <th key={p} scope="col" className="px-3 pt-3 pb-1 text-right font-semibold sm:px-4">
              {PARTNER_NAMES[p]}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {SHARE_LINES.map((line) => {
          const final = line.key === "final";
          return (
            <tr key={line.key} className={cn(final && "border-t")}>
              <th
                scope="row"
                className={cn(
                  "px-3 text-left align-top sm:px-4",
                  final ? "pt-2.5 pb-3 font-semibold" : "py-1.5 font-normal text-muted-foreground",
                )}
              >
                {line.label}
              </th>
              {PARTNERS.map((p) => {
                const v = share[p][line.key];
                return (
                  <td
                    key={p}
                    className={cn(
                      "px-3 text-right whitespace-nowrap tabular-nums sm:px-4",
                      final ? "pt-2.5 pb-3 font-semibold" : "py-1.5 font-medium",
                      line.key !== "expenses" && v < 0 && "text-destructive",
                    )}
                  >
                    {line.key === "expenses" && v !== 0 ? "− " : ""}
                    {formatMoney(v)}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

/** Money received, the profit in it, and each partner's half less their expenses, in one card. */
export function ShareCard({
  figures,
  share,
  href,
  footer,
}: {
  figures: ReceivedFigures;
  share: Record<Partner, PartnerShare>;
  /** Makes the money lines open this page. */
  href?: string;
  /** Shown under the partners, e.g. a link to set expenses. */
  footer?: ReactNode;
}) {
  const f = figures;
  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="divide-y">
        <Line
          label="Money received"
          note={`${formatMoney(f.cashSales)} cash sales + ${formatMoney(f.payments)} payments`}
          value={formatMoney(f.received)}
          href={href}
        />
        <Line
          label="Profit in it"
          note={
            f.untraced > 0
              ? `Before GST. ${formatMoney(f.untraced)} was for old dues, advances or parts without a cost, not counted.`
              : "Before GST"
          }
          value={formatMoney(f.profit)}
          strong
          negative={f.profit < 0}
          href={href}
        />
      </div>
      <ShareTable share={share} />
      {footer}
    </div>
  );
}

/** A full-width link at the bottom of a card. */
export function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="flex items-center gap-3 border-t px-4 py-3 text-sm font-medium hover:bg-muted/60">
      <span className="flex-1">{children}</span>
      <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}
