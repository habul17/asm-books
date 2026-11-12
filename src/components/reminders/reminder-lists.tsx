import { CircleArrowDownIcon, MessageCircleIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { customersHref } from "@/lib/customers/href";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { reminderMessage, whatsappLink, type LatePayer } from "@/lib/reminders/late-payments";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Customers with a late bill: who, how much, how long, and quick ways to follow up. */
export function LatePayerList({ payers, days, businessName }: { payers: LatePayer[]; days: number; businessName: string }) {
  return (
    <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border bg-card">
      {payers.map((p) => {
        const whatsapp = whatsappLink(p.mobile, reminderMessage(p.name, formatMoney(p.lateAmount), days, businessName));
        return (
          <li key={p.id} className="flex flex-col gap-2 px-4 py-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-3">
              <Link href={customersHref({ id: p.id })} className="truncate font-medium hover:underline">
                {p.name}
              </Link>
              <span className="text-right font-semibold tabular-nums">{formatMoney(p.lateAmount)}</span>
              <span className="truncate text-xs text-muted-foreground">
                Not paid for {plural(p.days, "day")} · oldest bill {formatDate(p.oldestDate)} · {plural(p.bills.length, "bill")}
              </span>
              <span className="text-right text-xs text-muted-foreground">
                {p.balance > p.lateAmount ? `owes ${formatMoney(p.balance)} in all` : ""}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {p.mobile && (
                <a href={`tel:${p.mobile}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                  <PhoneIcon /> Call
                </a>
              )}
              {whatsapp && (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={buttonVariants({ variant: "outline", size: "sm" })}
                >
                  <MessageCircleIcon /> WhatsApp
                </a>
              )}
              <Link href={`/payments/new?customer=${p.id}`} className={buttonVariants({ variant: "outline", size: "sm" })}>
                <CircleArrowDownIcon /> Receive payment
              </Link>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export interface LowStockRow {
  id: number;
  partNo: string | null;
  description: string;
  unit: string;
  stockQty: number;
  minStock: number | null;
}

/** Parts to reorder, each linking to its Items page. */
export function LowStockRows({ items }: { items: LowStockRow[] }) {
  return (
    <ul className="flex flex-col divide-y overflow-hidden rounded-2xl border bg-card">
      {items.map((p) => (
        <li key={p.id}>
          <Link
            href={`/catalogue?id=${p.id}`}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3 hover:bg-muted/60"
          >
            <span className="truncate font-medium">{p.description}</span>
            <span className={`text-right font-medium tabular-nums ${p.stockQty < 0 ? "text-destructive" : ""}`}>
              {formatQty(p.stockQty)} <span className="text-xs font-normal text-muted-foreground">{p.unit}</span>
            </span>
            <span className="truncate font-mono text-xs text-muted-foreground">{p.partNo}</span>
            <span className="flex justify-end">
              {p.stockQty < 0 ? (
                <Badge variant="destructive">below 0</Badge>
              ) : p.stockQty === 0 ? (
                <Badge variant="destructive">out of stock</Badge>
              ) : (
                <Badge variant="secondary">min {formatQty(p.minStock)}</Badge>
              )}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
