import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { formatDate } from "@/lib/format";
import { daysBetween, oldestUnpaidDate } from "@/lib/reminders/late-payments";
import { requireUser } from "@/server/auth";

import { todayInIndia } from "./invoice-writes";
import { loadUnpaid } from "./receivables";
import { readTemplates, type MessageTemplate } from "@/lib/whatsapp/templates";

export const TEMPLATES_KEY = "whatsappTemplates";

/** The shop's own saved WhatsApp messages. Callers check who is signed in. */
export async function loadWhatsappTemplates(): Promise<MessageTemplate[]> {
  const [row] = await getDb().select({ value: settings.value }).from(settings).where(eq(settings.key, TEMPLATES_KEY));
  return readTemplates(row?.value);
}

/** The saved WhatsApp messages, for a signed-in user. */
export async function getWhatsappTemplates(): Promise<MessageTemplate[]> {
  await requireUser();
  return loadWhatsappTemplates();
}

/** How long a customer's balance has waited: days since their oldest unpaid bill. Null when nothing is owed. */
export async function customerPending(customerId: number): Promise<{ days: number; since: string } | null> {
  await requireUser();
  const { owing, open } = await loadUnpaid(customerId);
  const oldest = oldestUnpaidDate(owing, open);
  return oldest ? { days: daysBetween(oldest, todayInIndia()), since: formatDate(oldest) } : null;
}
