import { z } from "zod";

/** Who the message is for: a customer (we sell to them) or a vendor (we buy from them). */
export type ContactKind = "customer" | "vendor";

export interface MessageTemplate {
  id: string;
  title: string;
  body: string;
}

/** What a template's {words} are filled with. */
export interface TemplateFill {
  name: string;
  /** "₹1,200.00", or null when nothing is due. */
  balance: string | null;
  shop: string;
  /** How long the balance has waited: days since the oldest unpaid bill, and that bill's date. */
  pending?: { days: number; since: string } | null;
}

export const MAX_TEMPLATES = 30;
export const MAX_TITLE = 40;
export const MAX_BODY = 1000;

/** The words a template can use, shown as a hint when writing one. */
export const PLACEHOLDERS = ["{name}", "{shop}", "{balance}"] as const;

/** Ready-made messages. "Balance payment" is only offered when the customer owes something. */
const CUSTOMER_TEMPLATES: (MessageTemplate & { needsBalance?: boolean })[] = [
  {
    id: "balance",
    title: "Balance payment",
    needsBalance: true,
    body: "Dear {name}, this is a gentle reminder from {shop}. A balance of {balance} has been pending on your account{pending}. Kindly arrange the payment at your earliest convenience. Thank you.",
  },
  {
    id: "order-today",
    title: "Any order today?",
    body: "Good day {name}, greetings from {shop}. Do you have any orders for spare parts today? Please share the part numbers and quantities, and we will keep them ready for you. Thank you.",
  },
  {
    id: "order-ready",
    title: "Order ready",
    body: "Dear {name}, your order is ready at {shop}. Please let us know when you will collect it, or if you would like us to send it. Thank you.",
  },
  {
    id: "payment-thanks",
    title: "Thanks for the payment",
    body: "Dear {name}, thank you for your payment. It has been received and updated in your account with {shop}. We appreciate your continued business.",
  },
];

const VENDOR_TEMPLATES: MessageTemplate[] = [
  {
    id: "availability",
    title: "Ask stock and rates",
    body: "Dear {name}, greetings from {shop}. Kindly share the availability and current rates for the following parts:\n\n",
  },
  {
    id: "send-order",
    title: "Place an order",
    body: "Dear {name}, greetings from {shop}. Please send the following parts at the earliest and share the bill once dispatched:\n\n",
  },
];

/** The ready-made messages that make sense for this contact right now. */
export function builtInTemplates(kind: ContactKind, hasBalance: boolean): MessageTemplate[] {
  if (kind === "vendor") return VENDOR_TEMPLATES;
  return CUSTOMER_TEMPLATES.filter((t) => !t.needsBalance || hasBalance).map(({ id, title, body }) => ({ id, title, body }));
}

/** Fills {name}, {shop} and {balance}. A missing value leaves a tidy blank, never "{balance}". */
export function fillTemplate(body: string, fill: TemplateFill): string {
  const p = fill.pending;
  const pending = p && p.days >= 1 ? ` for ${p.days} ${p.days === 1 ? "day" : "days"}, since ${p.since}` : "";
  return body
    .replace(/\{pending\}/gi, pending)
    .replace(/\{name\}/gi, fill.name.trim() || "Sir/Madam")
    .replace(/\{shop\}/gi, fill.shop.trim() || "our shop")
    .replace(/\{balance\}/gi, fill.balance ?? "the pending amount");
}

const templateSchema = z.object({
  id: z.string().min(1).max(40),
  title: z.string().trim().min(1).max(MAX_TITLE),
  body: z.string().trim().min(1).max(MAX_BODY),
});

/** Saved templates from the settings table; anything malformed is dropped. */
export function readTemplates(value: unknown): MessageTemplate[] {
  if (!Array.isArray(value)) return [];
  const out: MessageTemplate[] = [];
  for (const v of value) {
    const t = templateSchema.safeParse(v);
    if (t.success) out.push(t.data);
  }
  return out.slice(0, MAX_TEMPLATES);
}

/** Checks a new template typed by the user. */
export function parseNewTemplate(title: unknown, body: unknown): { value: Omit<MessageTemplate, "id"> } | { error: string } {
  const t = typeof title === "string" ? title.trim() : "";
  const b = typeof body === "string" ? body.trim() : "";
  if (!t) return { error: "Give the template a name." };
  if (t.length > MAX_TITLE) return { error: `Keep the name under ${MAX_TITLE} letters.` };
  if (!b) return { error: "Type the message." };
  if (b.length > MAX_BODY) return { error: `Keep the message under ${MAX_BODY} letters.` };
  return { value: { title: t, body: b } };
}
