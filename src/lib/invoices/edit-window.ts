// Who may change a saved invoice: the owner always; staff only on the day it was made.

const shopDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

/** True when both moments fall on the same calendar day in India. */
export function sameShopDay(a: Date, b: Date): boolean {
  return shopDay.format(a) === shopDay.format(b);
}

/** Staff may change an invoice only on the day it was made; the owner may change any. */
export function canChangeInvoice(isOwner: boolean, createdAt: Date, now: Date = new Date()): boolean {
  return isOwner || sameShopDay(createdAt, now);
}

export const STAFF_EDIT_LIMIT = "Staff can change only today's bills. Ask the owner to change this one.";
