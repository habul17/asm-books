import { ChevronRightIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";

import { formatMoney } from "@/lib/format";
import { PARTNER_NAMES, PARTNERS, type Partner, type PartnerShare } from "@/lib/profit-share/share";
import type { ReceivedFigures } from "@/server/profit-received";

/**
 * One headline figure. On a phone it is a row (label left, amount right);
 * from tablet width up the amount sits large under the label.
 */
function Figure({
  label,
  note,
  value,
  tone,
  href,
}: {
  label: string;
  note: string;
  value: string;
  tone?: "good" | "bad";
  href?: string;
}) {
  const body = (
    <>
      <span className="col-start-1 row-start-1 text-sm text-muted-foreground">{label}</span>
      <span
        className={cn(
          "col-start-2 row-span-2 row-start-1 self-center text-right text-lg font-semibold tracking-tight tabular-nums sm:self-start sm:text-left sm:text-3xl",
          tone === "good" && "text-good",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </span>
      <span className="col-start-1 row-start-2 text-xs text-muted-foreground">{note}</span>
    </>
  );
  const className = "grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5 px-4 py-3.5 sm:flex sm:flex-col sm:gap-1 sm:px-6 sm:py-5";
  return href ? (
    <Link href={href} className={cn(className, "transition-colors hover:bg-foreground/[0.04]")}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

/** A label and its amount: stacked on a phone, side by side from tablet width up. */
function ShareLine({ label, value, final = false, negative = false }: { label: string; value: string; final?: boolean; negative?: boolean }) {
  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-baseline sm:justify-between sm:gap-3",
        final && "mt-1 border-t border-foreground/10 pt-2.5",
      )}
    >
      <dt className={cn("text-xs sm:text-sm", final ? "font-semibold" : "text-muted-foreground")}>{label}</dt>
      <dd
        className={cn(
          "tabular-nums",
          final ? "text-lg font-semibold tracking-tight sm:text-2xl" : "text-sm font-medium",
          negative && "text-destructive",
        )}
      >
        {value}
      </dd>
    </div>
  );
}

/** Each partner's half of the profit, the expenses taken off it, and what is left: one small card each. */
export function ShareTable({ share }: { share: Record<Partner, PartnerShare> }) {
  return (
    <div className="grid grid-cols-2 gap-2 px-2 pb-2 sm:gap-3 sm:px-3 sm:pb-3">
      {PARTNERS.map((p) => {
        const s = share[p];
        return (
          <div
            key={p}
            role="group"
            aria-label={`${PARTNER_NAMES[p]}'s share`}
            className="flex flex-col gap-2 rounded-2xl border border-foreground/5 bg-white/70 p-3.5 sm:gap-2.5 sm:p-5 dark:bg-white/[0.06]"
          >
            <h3 className="font-semibold">{PARTNER_NAMES[p]}</h3>
            <dl className="flex flex-col gap-1.5">
              <ShareLine label="50% of profit" value={formatMoney(s.share)} negative={s.share < 0} />
              <ShareLine label="Expenses" value={`${s.expenses !== 0 ? "− " : ""}${formatMoney(s.expenses)}`} />
              <ShareLine label="Final profit" value={formatMoney(s.final)} final negative={s.final < 0} />
            </dl>
          </div>
        );
      })}
    </div>
  );
}

/** Money received, the profit in it, and each partner's half less their expenses, in one glass card. */
export function ShareCard({
  figures,
  share,
  href,
  footer,
}: {
  figures: ReceivedFigures;
  share: Record<Partner, PartnerShare>;
  /** Makes the money figures open this page. */
  href?: string;
  /** Shown under the partners, e.g. a link to set expenses. */
  footer?: ReactNode;
}) {
  const f = figures;
  return (
    <div className="glass overflow-hidden rounded-3xl">
      <div className="grid divide-foreground/[0.07] max-sm:divide-y sm:grid-cols-2 sm:divide-x">
        <Figure
          label="Money received"
          note={`${formatMoney(f.cashSales)} cash sales + ${formatMoney(f.payments)} payments`}
          value={formatMoney(f.received)}
          href={href}
        />
        <Figure
          label="Profit in it"
          note={
            f.untraced > 0
              ? `Before GST. ${formatMoney(f.untraced)} was for old dues, advances or parts without a cost, not counted.`
              : "Before GST"
          }
          value={formatMoney(f.profit)}
          tone={f.profit > 0 ? "good" : f.profit < 0 ? "bad" : undefined}
          href={href}
        />
      </div>
      <ShareTable share={share} />
      {footer}
    </div>
  );
}

/** A full-width blue link at the bottom of a card. */
export function CardLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center gap-3 border-t border-foreground/[0.07] px-4 py-3 text-sm font-medium text-tint transition-colors hover:bg-foreground/[0.04] sm:px-6"
    >
      <span className="flex-1">{children}</span>
      <ChevronRightIcon className="size-4 shrink-0" aria-hidden />
    </Link>
  );
}
