import { notFound } from "next/navigation";

import { Skeleton } from "@/components/ui/skeleton";
import { formatQty } from "@/lib/format";
import { getEditorOptions, getInvoice, pickCustomerById } from "@/server/invoices";
import { todayInIndia } from "@/server/invoice-writes";

import { InvoiceEditor, type EditorInitial } from "./invoice-editor";

export async function NewInvoiceEditor({ customerId }: { customerId: number | null }) {
  const [options, customer] = await Promise.all([
    getEditorOptions(),
    customerId ? pickCustomerById(customerId) : Promise.resolve(null),
  ]);
  const initial: EditorInitial = {
    id: null,
    date: todayInIndia(),
    mode: "customer",
    customer,
    walkInName: "",
    walkInMobile: "",
    paymentType: "credit",
    priceListId: customer?.priceListId ?? options.defaultPriceListId,
    notes: "",
    lines: [],
    originalCredit: 0,
  };
  return <InvoiceEditor initial={initial} options={options} />;
}

export async function EditInvoiceEditor({ id }: { id: number }) {
  const [options, inv] = await Promise.all([getEditorOptions(), getInvoice(id)]);
  if (!inv || inv.status === "cancelled") notFound();
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
    priceListId: inv.priceListId,
    notes: inv.notes ?? "",
    lines: inv.lines.map((l) => ({
      key: `e${l.id}`,
      productId: l.productId,
      partNo: l.partNo,
      description: l.description,
      unit: l.unit,
      qty: formatQty(l.qty),
      rate: String(l.rate),
      discountPct: l.discountPct ? String(l.discountPct) : "",
      gstRate: l.gstRate,
      available: l.productId != null && l.stockQty != null ? l.stockQty + (soldHere.get(l.productId) ?? 0) : null,
      // Keep the prices already billed unless the user changes them.
      rateEdited: true,
    })),
    originalCredit: inv.paymentType === "credit" ? inv.grandTotal : 0,
  };
  return <InvoiceEditor initial={initial} options={options} />;
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
