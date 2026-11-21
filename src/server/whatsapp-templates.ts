import "server-only";

import { eq } from "drizzle-orm";

import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { requireUser } from "@/server/auth";
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
