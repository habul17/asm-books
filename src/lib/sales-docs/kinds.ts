// Quotes, sales orders and delivery challans share one shape. They never move
// stock or money; an invoice made from one does that.

export const SALES_DOC_KINDS = ["quote", "order", "challan"] as const;
export type SalesDocKind = (typeof SALES_DOC_KINDS)[number];

export const SALES_DOC_STATUSES = ["open", "closed", "cancelled"] as const;
export type SalesDocStatus = (typeof SALES_DOC_STATUSES)[number];

export interface SalesDocKindInfo {
  /** Part of the URL: /sales/<slug>. */
  slug: string;
  /** "quote", as in "Save quote". */
  noun: string;
  /** Page heading, e.g. "Quotes". */
  plural: string;
  /** Printed at the top of the document. */
  title: string;
  /** Printed in front of the number. */
  numberLabel: string;
  /** What the second date means; null when the kind has none. */
  secondDateLabel: string | null;
  /** Which business setting holds the number prefix. */
  prefixKey: "quotePrefix" | "orderPrefix" | "challanPrefix";
}

export const SALES_DOC_KIND: Record<SalesDocKind, SalesDocKindInfo> = {
  quote: {
    slug: "quotes",
    noun: "quote",
    plural: "Quotes",
    title: "Quotation",
    numberLabel: "Quote No",
    secondDateLabel: "Valid until",
    prefixKey: "quotePrefix",
  },
  order: {
    slug: "orders",
    noun: "sales order",
    plural: "Sales Orders",
    title: "Sales Order",
    numberLabel: "Order No",
    secondDateLabel: "Deliver by",
    prefixKey: "orderPrefix",
  },
  challan: {
    slug: "challans",
    noun: "delivery challan",
    plural: "Delivery Challans",
    title: "Delivery Challan",
    numberLabel: "Challan No",
    secondDateLabel: null,
    prefixKey: "challanPrefix",
  },
};

/** The kind for a URL slug, or null when the slug is not one of ours. */
export function kindFromSlug(slug: string): SalesDocKind | null {
  return SALES_DOC_KINDS.find((k) => SALES_DOC_KIND[k].slug === slug) ?? null;
}

export const salesDocsHref = (kind: SalesDocKind) => `/sales/${SALES_DOC_KIND[kind].slug}`;
export const salesDocHref = (kind: SalesDocKind, id: number) => `${salesDocsHref(kind)}/${id}`;

/** Why goods travel on a challan and not on an invoice. */
export const CHALLAN_REASONS = ["Supply on approval", "Job work", "Delivery before invoice", "Others"] as const;

/**
 * What a document can be turned into. A quote becomes an order or an invoice,
 * an order becomes a challan or an invoice, a challan becomes an invoice.
 */
export const NEXT_STEPS: Record<SalesDocKind, (SalesDocKind | "invoice")[]> = {
  quote: ["order", "invoice"],
  order: ["challan", "invoice"],
  challan: ["invoice"],
};

/** True when making `to` from `from` finishes `from`. A challan leaves its order open until it is invoiced. */
export const closesSource = (from: SalesDocKind, to: SalesDocKind | "invoice") => to === "invoice" || from === "quote";
