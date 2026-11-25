import Link from "next/link";
import type { ReactNode } from "react";

import { InfoTip } from "@/components/ui/info-tip";
import { formatMoney } from "@/lib/format";
import { EWAY_BILL_LIMIT } from "@/lib/transport";

/**
 * The (i) beside a section's name. The computer shows it in the page heading; the phone
 * shows it in the top bar, where the page's name sits.
 */
const TIPS: Record<string, { label: string; body: ReactNode }> = {
  "/reminders": { label: "About reminders", body: "What needs your attention today." },
  "/banking": {
    label: "About banking",
    body: (
      <>
        Sales, payments, bills and expenses are counted on their own. Enter here only other money: your own money,
        loans, GST paid, equipment, other income, and cash put in or taken out of the bank.{" "}
        <Link href="/reports/cash-flow">See the Cash Flow Statement</Link>.
      </>
    ),
  },
  "/profit-share": {
    label: "About profit share",
    body: (
      <>
        The profit in the money that came in (cash sales and payments), before GST. Ashi and Dad get half each. Expenses
        you add here come off each one&apos;s half, every month or once. Only the owner sees this.
      </>
    ),
  },
  "/recurring": {
    label: "About recurring invoices",
    body: (
      <>
        Bills you make again and again, like every month. When one is due, it shows here and in Reminders. Press{" "}
        <strong>Create invoice</strong>, check it and save. Nothing is billed on its own.
      </>
    ),
  },
  "/eway-bills": {
    label: "About e-way bills",
    body: (
      <>
        Bills of {formatMoney(EWAY_BILL_LIMIT)} or more usually need an e-way bill. Make it on the government e-way bill
        website. Then open the bill here and type its number under “Transport and e-way bill”.
      </>
    ),
  },
  "/purchase-returns": { label: "About purchase returns", body: "Damaged or wrong parts you send back to a vendor." },
  "/business": {
    label: "About business details",
    body: "Your shop's details, printed on every bill. Only the owner can change them.",
  },
  "/settings": { label: "About settings", body: "These choices are saved on this phone or computer only." },
  "/users": { label: "About users", body: "The people who can sign in, and what each one is allowed to do." },
};

/** The section's (i), or nothing when the section has no tip. */
export function SectionTip({ href }: { href: string }) {
  const tip = TIPS[href];
  return tip ? <InfoTip label={tip.label}>{tip.body}</InfoTip> : null;
}
