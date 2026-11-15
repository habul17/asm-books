import "server-only";

import { eq, or, sql, type SQL } from "drizzle-orm";

import { getDb } from "@/db";
import { customers, vendors } from "@/db/schema";
import { CONTACT_INSTRUCTIONS, CONTACT_JSON_SCHEMA, reviewContact, scannedContactSchema, type ContactDraft } from "@/lib/contacts/scan";

import { readDocument } from "./index";
import { BillScanError, type BillFile } from "./reader";

const CONTACT_TASK = {
  noun: "card",
  ask: "Read the business contact details from this document.",
  instructions: CONTACT_INSTRUCTIONS,
  schema: CONTACT_JSON_SCHEMA,
};

/**
 * Reads a visiting card, GST certificate or letterhead and prepares the new customer
 * or vendor form. Warns when they look already saved. Nothing is saved. The caller
 * must have checked the user.
 */
export async function scanContact(file: BillFile, kind: "customer" | "vendor"): Promise<ContactDraft> {
  const parsed = scannedContactSchema.safeParse(await readDocument(file, CONTACT_TASK));
  if (!parsed.success) throw new BillScanError("The card could not be read. Try a clearer photo.");
  const draft = reviewContact(parsed.data);

  const t = kind === "customer" ? customers : vendors;
  const same: SQL[] = [];
  if (draft.gstin) same.push(eq(sql`upper(${t.gstin})`, draft.gstin));
  if (draft.mobile && /^\d{10}$/.test(draft.mobile)) same.push(sql`right(regexp_replace(${t.mobile}, '\\D', '', 'g'), 10) = ${draft.mobile}`);
  if (draft.name) same.push(eq(sql`lower(${t.name})`, draft.name.toLowerCase()));
  if (same.length) {
    const found = await getDb().select({ name: t.name }).from(t).where(or(...same)).limit(3);
    if (found.length) {
      draft.warnings.unshift(`Already saved as ${found.map((f) => `"${f.name}"`).join(", ")}. Check before adding them again.`);
    }
  }
  return draft;
}
