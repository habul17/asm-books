// Works out which customers have left a bill unpaid for too long.
//
// Payments are not tied to single invoices, so money received is taken to pay
// the oldest bills first. What a customer still owes is therefore made up of
// their newest credit invoices, and anything beyond those is opening balance.

export const DEFAULT_REMINDER_DAYS = 15;
export const MAX_REMINDER_DAYS = 365;

/** Balances smaller than this are ignored, so paise left by rounding never raise a reminder. */
const MIN_AMOUNT = 1;

export interface OwingCustomer {
  id: number;
  name: string;
  mobile: string | null;
  city: string | null;
  /** The day the customer was added; an opening balance is counted from this day. */
  since: string;
  /** What the customer owes right now. */
  balance: number;
}

export interface OpenInvoice {
  id: number;
  number: string;
  customerId: number;
  date: string;
  dueDate: string | null;
  grandTotal: number;
  /** Total of the same customer's newer credit invoices. */
  newer: number;
}

export interface LateBill {
  /** null for the opening balance. */
  id: number | null;
  number: string;
  date: string;
  /** The part of this bill that is still not paid. */
  unpaid: number;
}

export interface LatePayer {
  id: number;
  name: string;
  mobile: string | null;
  city: string | null;
  balance: number;
  /** The part of the balance that is late. */
  lateAmount: number;
  /** Date of the oldest late bill. */
  oldestDate: string;
  /** Days since the oldest late bill. */
  days: number;
  bills: LateBill[];
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const utc = (iso: string) => Date.parse(`${iso}T00:00:00Z`);

/** Whole days from one ISO date to another; negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

/**
 * A bill with a due date is late the day after it; any other bill is late once
 * `days` days have passed since its date.
 */
function isLate(date: string, dueDate: string | null, today: string, days: number): boolean {
  return dueDate ? dueDate < today : daysBetween(date, today) >= days;
}

export interface UnpaidBill extends LateBill {
  dueDate: string | null;
}

/**
 * Splits what each owing customer owes into the bills it is made of, newest
 * first, with any opening balance last. Customers owing under a rupee are left out.
 */
export function unpaidBills(
  customers: OwingCustomer[],
  invoices: OpenInvoice[],
): { customer: OwingCustomer; bills: UnpaidBill[] }[] {
  const byCustomer = new Map<number, OpenInvoice[]>();
  for (const inv of invoices) {
    const list = byCustomer.get(inv.customerId);
    if (list) list.push(inv);
    else byCustomer.set(inv.customerId, [inv]);
  }

  const out: { customer: OwingCustomer; bills: UnpaidBill[] }[] = [];
  for (const c of customers) {
    if (!(c.balance >= MIN_AMOUNT)) continue;
    const bills: UnpaidBill[] = [];
    let covered = 0;
    const own = (byCustomer.get(c.id) ?? []).sort((a, b) => a.newer - b.newer || b.id - a.id);
    for (const inv of own) {
      const unpaid = round2(Math.min(inv.grandTotal, c.balance - inv.newer));
      if (unpaid <= 0) continue;
      covered = round2(covered + unpaid);
      bills.push({ id: inv.id, number: inv.number, date: inv.date, dueDate: inv.dueDate, unpaid });
    }
    const opening = round2(c.balance - covered);
    if (opening >= 0.01) bills.push({ id: null, number: "Opening balance", date: c.since, dueDate: null, unpaid: opening });
    out.push({ customer: c, bills });
  }
  return out;
}

/** Customers with a late bill, the longest wait first. */
export function findLatePayers(
  customers: OwingCustomer[],
  invoices: OpenInvoice[],
  today: string,
  days: number,
): LatePayer[] {
  const out: LatePayer[] = [];
  for (const { customer: c, bills: all } of unpaidBills(customers, invoices)) {
    const bills: LateBill[] = all
      .filter((b) => isLate(b.date, b.dueDate, today, days))
      .map(({ id, number, date, unpaid }) => ({ id, number, date, unpaid }));

    const lateAmount = round2(bills.reduce((sum, b) => sum + b.unpaid, 0));
    if (lateAmount < MIN_AMOUNT) continue;
    bills.sort((a, b) => a.date.localeCompare(b.date));
    const oldestDate = bills[0].date;
    out.push({
      id: c.id,
      name: c.name,
      mobile: c.mobile,
      city: c.city,
      balance: round2(c.balance),
      lateAmount,
      oldestDate,
      days: daysBetween(oldestDate, today),
      bills,
    });
  }
  return out.sort((a, b) => b.days - a.days || b.lateAmount - a.lateAmount || a.name.localeCompare(b.name));
}

/** The message offered when reminding a customer on WhatsApp. */
export function reminderMessage(customerName: string, amount: string, days: number, business: string): string {
  const from = business ? ` with ${business}` : "";
  return `Dear ${customerName}, a payment of ${amount} is pending${from} for more than ${days} days. Kindly arrange the payment at the earliest. Thank you.`;
}

/**
 * A WhatsApp chat link with the message filled in, or null when the number
 * cannot be a mobile number. Indian ten-digit numbers get the 91 country code.
 */
export function whatsappLink(mobile: string | null, message: string): string | null {
  let digits = (mobile ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (digits.length === 10) digits = `91${digits}`;
  if (digits.length < 11 || digits.length > 15) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
