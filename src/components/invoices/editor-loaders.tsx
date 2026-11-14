import { notFound } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { formatQty } from "@/lib/format";
import { SALES_DOC_KINDS, type SalesDocKind } from "@/lib/sales-docs/kinds";
import { getEditorOptions, getInvoice, pickCustomerById, type EditorOptions } from "@/server/invoices";
import { todayInIndia } from "@/server/invoice-writes";
import { getActiveRecurring } from "@/server/recurring";
import { getSalesDoc, type SalesDocDetail } from "@/server/sales-docs";

import { InvoiceEditor, type EditorInitial } from "./invoice-editor";
import { staffEditLimit } from "@/lib/edit-window";

type DocLine = SalesDocDetail["lines"][number];

/** A saved line as the editor shows it. The price already agreed is kept unless the user changes it. */
const editorLine = (l: Omit<DocLine, "docId">, available: number | null): EditorInitial["lines"][number] => ({
  key: `e${l.id}`,
  productId: l.productId,
  partNo: l.partNo,
  description: l.description,
  unit: l.unit,
  qty: formatQty(l.qty),
  rate: String(l.rate),
  discountPct: l.discountPct ? String(l.discountPct) : "",
  gstRate: l.gstRate,
  available,
  rateEdited: true,
});

/** Keeps a state that was picked by hand; otherwise the editor keeps following the customer. */
const pickedSupply = (placeOfSupply: string | null, customerState: string | null | undefined, options: EditorOptions) =>
  placeOfSupply && placeOfSupply !== (customerState || options.sellerState) ? placeOfSupply : null;

/** The customer, lines and price list of a quote, order or challan, to start another document from it. */
async function fromSalesDoc(doc: SalesDocDetail, options: EditorOptions) {
  const customer = doc.customerId ? await pickCustomerById(doc.customerId) : null;
  return {
    mode: doc.customerId ? ("customer" as const) : ("walk-in" as const),
    customer,
    walkInName: doc.customerId ? "" : doc.customerName,
    walkInMobile: doc.customerId ? "" : (doc.customerMobile ?? ""),
    priceListId: doc.priceListId,
    placeOfSupply: pickedSupply(doc.placeOfSupply, customer?.stateCode, options),
    notes: doc.notes ?? "",
    lines: doc.lines.map((l) => editorLine(l, null)),
  };
}

/** Finds the open quote, order or challan with this id, whatever its kind. */
async function findOpenDoc(id: number | null, kinds: readonly SalesDocKind[] = SALES_DOC_KINDS) {
  if (id == null) return null;
  const found = await Promise.all(kinds.map((k) => getSalesDoc(k, id)));
  const doc = found.find((d) => d != null) ?? null;
  return doc && doc.status === "open" ? doc : null;
}

/** A new invoice filled in from the one a recurring invoice repeats: same customer, items and rates, today's date. */
async function fromRecurring(repeatId: number, options: EditorOptions): Promise<EditorInitial | null> {
  const recurring = await getActiveRecurring(repeatId);
  const inv = recurring ? await getInvoice(recurring.invoiceId) : null;
  if (!recurring || !inv || inv.customerId == null) return null;
  const customer = await pickCustomerById(inv.customerId);
  if (!customer) return null;
  return {
    id: null,
    date: todayInIndia(),
    mode: "customer",
    customer,
    walkInName: "",
    walkInMobile: "",
    paymentType: inv.paymentType,
    cashMode: inv.cashMode ?? "cash",
    priceListId: inv.priceListId,
    placeOfSupply: pickedSupply(inv.placeOfSupply, customer.stateCode, options),
    notes: inv.notes ?? "",
    extra: Object.fromEntries(Object.entries(inv.extra).map(([fieldId, value]) => [fieldId, String(value)])),
    lines: inv.lines.map((l) => editorLine(l, l.productId != null ? l.stockQty : null)),
    originalCredit: 0,
    repeatId: recurring.id,
  };
}

export async function NewInvoiceEditor({
  customerId,
  fromDocId,
  repeatId,
}: {
  customerId: number | null;
  fromDocId?: number | null;
  /** A recurring invoice that is due: the new invoice starts as a copy of the one it repeats. */
  repeatId?: number | null;
}) {
  const [options, picked, source] = await Promise.all([
    getEditorOptions(),
    customerId ? pickCustomerById(customerId) : Promise.resolve(null),
    findOpenDoc(fromDocId ?? null),
  ]);
  if (repeatId != null) {
    const repeated = await fromRecurring(repeatId, options);
    if (repeated) return <InvoiceEditor initial={repeated} options={options} />;
  }
  if (source) {
    const initial: EditorInitial = {
      id: null,
      date: todayInIndia(),
      paymentType: "credit",
      extra: {},
      originalCredit: 0,
      fromDocId: source.id,
      ...(await fromSalesDoc(source, options)),
    };
    return <InvoiceEditor initial={initial} options={options} />;
  }
  const customer = picked;
  const initial: EditorInitial = {
    id: null,
    date: todayInIndia(),
    mode: "customer",
    customer,
    walkInName: "",
    walkInMobile: "",
    paymentType: "credit",
    priceListId: customer?.priceListId ?? options.defaultPriceListId,
    placeOfSupply: null,
    notes: "",
    extra: {},
    lines: [],
    originalCredit: 0,
  };
  return <InvoiceEditor initial={initial} options={options} />;
}

export async function EditInvoiceEditor({ id }: { id: number }) {
  const [options, inv] = await Promise.all([getEditorOptions(), getInvoice(id)]);
  if (!inv || inv.status === "cancelled") notFound();
  if (!inv.canChange) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">{staffEditLimit("bills")}</p>
    );
  }
  const customer = inv.customerId ? await pickCustomerById(inv.customerId) : null;
  const soldHere = new Map<number, number>();
  for (const l of inv.lines) if (l.productId != null) soldHere.set(l.productId, (soldHere.get(l.productId) ?? 0) + l.qty);

  const initial: EditorInitial = {
    id: inv.id,
    date: inv.date,
    mode: inv.customerId ? "customer" : "walk-in",
    customer,
    walkInName: inv.customerId ? "" : inv.customerName === "Cash Sale" ? "" : inv.customerName,
    walkInMobile: inv.customerId ? "" : (inv.customerMobile ?? ""),
    paymentType: inv.paymentType,
    cashMode: inv.cashMode ?? "cash",
    priceListId: inv.priceListId,
    placeOfSupply: pickedSupply(inv.placeOfSupply, customer?.stateCode, options),
    notes: inv.notes ?? "",
    extra: Object.fromEntries(Object.entries(inv.extra).map(([fieldId, value]) => [fieldId, String(value)])),
    lines: inv.lines.map((l) =>
      editorLine(l, l.productId != null && l.stockQty != null ? l.stockQty + (soldHere.get(l.productId) ?? 0) : null),
    ),
    originalCredit: inv.paymentType === "credit" ? inv.grandTotal : 0,
  };
  return <InvoiceEditor initial={initial} options={options} />;
}

/** A new quote, order or challan; `fromId` starts it from the quote or order it follows. */
export async function NewSalesDocEditor({
  kind,
  customerId,
  fromId,
}: {
  kind: SalesDocKind;
  customerId: number | null;
  fromId: number | null;
}) {
  const sourceKinds: SalesDocKind[] = kind === "order" ? ["quote"] : kind === "challan" ? ["order"] : [];
  const [options, picked, source] = await Promise.all([
    getEditorOptions(),
    customerId ? pickCustomerById(customerId) : Promise.resolve(null),
    findOpenDoc(fromId, sourceKinds),
  ]);
  const base = { id: null, date: todayInIndia(), paymentType: "credit" as const, extra: {}, originalCredit: 0 };
  const initial: EditorInitial = source
    ? { ...base, sourceId: source.id, ...(await fromSalesDoc(source, options)) }
    : {
        ...base,
        mode: "customer",
        customer: picked,
        walkInName: "",
        walkInMobile: "",
        priceListId: picked?.priceListId ?? options.defaultPriceListId,
        placeOfSupply: null,
        notes: "",
        lines: [],
      };
  return <InvoiceEditor kind={kind} initial={initial} options={{ ...options, fields: [] }} />;
}

export async function EditSalesDocEditor({ kind, id }: { kind: SalesDocKind; id: number }) {
  const [options, doc] = await Promise.all([getEditorOptions(), getSalesDoc(kind, id)]);
  if (!doc || doc.status !== "open") notFound();
  const initial: EditorInitial = {
    id: doc.id,
    date: doc.date,
    paymentType: "credit",
    extra: {},
    originalCredit: 0,
    secondDate: doc.secondDate ?? "",
    reason: doc.reason ?? "",
    ...(await fromSalesDoc(doc, options)),
  };
  return <InvoiceEditor kind={kind} initial={initial} options={{ ...options, fields: [] }} />;
}

export function EditorSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-36" />
      <Skeleton className="h-48" />
      <Skeleton className="h-32" />
    </div>
  );
}
