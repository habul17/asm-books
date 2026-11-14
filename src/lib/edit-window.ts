// Who may change a saved invoice or payment: the owner always; staff only on the day it was made.

const shopDay = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });

/** True when both moments fall on the same calendar day in India. */
export function sameShopDay(a: Date, b: Date): boolean {
  return shopDay.format(a) === shopDay.format(b);
}

/** Staff may change a record only on the day it was made; the owner may change any. */
export function canChangeToday(isOwner: boolean, createdAt: Date, now: Date = new Date()): boolean {
  return isOwner || sameShopDay(createdAt, now);
}

/** What staff are told when the record is older than today, e.g. staffEditLimit("bills"). */
export const staffEditLimit = (things: string) => `Staff can change only today's ${things}. Ask the owner to change this one.`;
