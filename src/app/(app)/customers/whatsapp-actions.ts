"use server";

import { randomUUID } from "node:crypto";

import { eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { settings } from "@/db/schema";
import { MAX_TEMPLATES, parseNewTemplate, readTemplates, type MessageTemplate } from "@/lib/whatsapp/templates";
import { requireUser } from "@/server/auth";
import { loadWhatsappTemplates, TEMPLATES_KEY } from "@/server/whatsapp-templates";

type Result = { templates: MessageTemplate[]; error?: string };

/** Saves a new WhatsApp message template for everyone in the shop. */
export async function addWhatsappTemplate(title: string, body: string): Promise<Result> {
  await requireUser();
  const parsed = parseNewTemplate(title, body);
  if ("error" in parsed) return { templates: await loadWhatsappTemplates(), error: parsed.error };
  const item = JSON.stringify([{ id: randomUUID(), ...parsed.value }]);
  try {
    // One statement, so two people saving at once never lose each other's template.
    const [row] = await getDb()
      .insert(settings)
      .values({ key: TEMPLATES_KEY, value: sql`${item}::jsonb` })
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: sql`case when jsonb_typeof(${settings.value}) = 'array' and jsonb_array_length(${settings.value}) < ${MAX_TEMPLATES}
            then ${settings.value} || ${item}::jsonb
            when jsonb_typeof(${settings.value}) = 'array' then ${settings.value}
            else ${item}::jsonb end`,
          updatedAt: new Date(),
        },
      })
      .returning({ value: settings.value });
    const templates = readTemplates(row?.value);
    if (!templates.some((t) => t.title === parsed.value.title && t.body === parsed.value.body)) {
      return { templates, error: `You can keep up to ${MAX_TEMPLATES} templates. Delete one first.` };
    }
    return { templates };
  } catch (err) {
    console.error("[whatsapp] save template failed:", err instanceof Error ? err.message : err);
    return { templates: await loadWhatsappTemplates(), error: "Could not save. Please try again." };
  }
}

/** Deletes one saved template. */
export async function deleteWhatsappTemplate(id: string): Promise<Result> {
  await requireUser();
  try {
    const [row] = await getDb()
      .update(settings)
      .set({
        value: sql`coalesce((select jsonb_agg(e) from jsonb_array_elements(case when jsonb_typeof(${settings.value}) = 'array' then ${settings.value} else '[]'::jsonb end) e where e->>'id' is distinct from ${String(id)}), '[]'::jsonb)`,
        updatedAt: new Date(),
      })
      .where(eq(settings.key, TEMPLATES_KEY))
      .returning({ value: settings.value });
    return { templates: readTemplates(row?.value) };
  } catch (err) {
    console.error("[whatsapp] delete template failed:", err instanceof Error ? err.message : err);
    return { templates: await loadWhatsappTemplates(), error: "Could not delete. Please try again." };
  }
}
