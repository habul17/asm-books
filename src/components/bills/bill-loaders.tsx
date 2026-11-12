import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Skeleton } from "@/components/ui/skeleton";
import { getBill, getBillEditorOptions } from "@/server/bills";
import { getPurchaseOrder } from "@/server/purchase-orders";
import { todayInIndia } from "@/server/invoice-writes";
import { pickVendorById } from "@/server/vendors";

import { BillEditor, type BillLineDraft } from "./bill-editor";
import { NewBillWorkspace } from "./new-bill-workspace";

interface SavedLine {
  id: number;
  productId: number | null;
  partNo: string | null;
  description: string;
  unit: string;
  qty: number;
  rate: number;
  discountPct: number;
  gstRate: number;
}

/** A saved bill or order line as the editor holds it. */
const editorLine = (l: SavedLine, prefix: string): BillLineDraft => ({
  key: `${prefix}${l.id}`,
  productId: l.productId,
  partNo: l.partNo,
  description: l.description,
  unit: l.unit,
  qty: String(l.qty),
  rate: String(l.rate),
  discountPct: l.discountPct ? String(l.discountPct) : "",
  gstRate: l.gstRate,
});

/** A new bill, empty or started from the open purchase order `fromOrderId`. */
export async function NewBillForm({ vendorId, fromOrderId = null }: { vendorId: number | null; fromOrderId?: number | null }) {
  await connection(); // Today's date must be read per request, not at build time.
  const found = fromOrderId ? await getPurchaseOrder(fromOrderId) : null;
  const order = found?.status === "open" ? found : null;
  const pickId = order?.vendorId ?? vendorId;
  const [options, vendor] = await Promise.all([getBillEditorOptions(), pickId ? pickVendorById(pickId) : null]);
  const today = todayInIndia();
  const due = vendor?.paymentTermsDays != null ? addDays(today, vendor.paymentTermsDays) : "";
  return (
    <>
      {order && (
        <p className="rounded-lg border bg-muted/40 px-3 py-2 text-sm">
          For purchase order <span className="font-mono font-medium">{order.number}</span>. Change the rows to match
          what really arrived. Saving this bill closes the order.
        </p>
      )}
      <NewBillWorkspace
        initial={{
          id: null,
          vendor,
          billNo: "",
          date: today,
          dueDate: due,
          fromOrderId: order?.id ?? null,
          updatePrices: true,
          roundTotal: true,
          notes: "",
          lines: order?.lines.map((l) => editorLine(l, "o")) ?? [],
        }}
        sellerState={options.sellerState}
        cancelHref={order ? `/purchase-orders/${order.id}` : vendor ? `/vendors/${vendor.id}` : "/bills"}
        scanReady={options.scanReady}
      />
    </>
  );
}

export async function NewPurchaseOrderForm({ vendorId }: { vendorId: number | null }) {
  await connection(); // Today's date must be read per request, not at build time.
  const [options, vendor] = await Promise.all([getBillEditorOptions(), vendorId ? pickVendorById(vendorId) : null]);
  return (
    <BillEditor
      kind="order"
      initial={{
        id: null,
        vendor,
        billNo: "",
        date: todayInIndia(),
        dueDate: "",
        fromOrderId: null,
        updatePrices: false,
        roundTotal: true,
        notes: "",
        lines: [],
      }}
      sellerState={options.sellerState}
      cancelHref={vendor ? `/vendors/${vendor.id}` : "/purchase-orders"}
    />
  );
}

export async function EditPurchaseOrderForm({ id }: { id: number }) {
  const [order, options] = await Promise.all([getPurchaseOrder(id), getBillEditorOptions()]);
  if (!order || order.status !== "open") notFound();
  const vendor = await pickVendorById(order.vendorId);
  return (
    <BillEditor
      kind="order"
      initial={{
        id: order.id,
        vendor,
        billNo: "",
        date: order.date,
        dueDate: order.expectedDate ?? "",
        fromOrderId: null,
        updatePrices: false,
        roundTotal: true,
        notes: order.notes ?? "",
        lines: order.lines.map((l) => editorLine(l, "e")),
      }}
      sellerState={options.sellerState}
      cancelHref={`/purchase-orders/${order.id}`}
    />
  );
}

export async function EditBillForm({ id }: { id: number }) {
  const [bill, options] = await Promise.all([getBill(id), getBillEditorOptions()]);
  if (!bill || bill.status === "cancelled") notFound();
  const vendor = await pickVendorById(bill.vendorId);
  return (
    <BillEditor
      initial={{
        id: bill.id,
        vendor,
        billNo: bill.billNo,
        date: bill.date,
        dueDate: bill.dueDate ?? "",
        fromOrderId: null,
        updatePrices: bill.updatePrices,
        // A total with paise means the bill was saved without rounding.
        roundTotal: Number.isInteger(Math.round(bill.grandTotal * 100) / 100),
        notes: bill.notes ?? "",
        lines: bill.lines.map((l) => editorLine(l, "e")),
      }}
      sellerState={options.sellerState}
      cancelHref={`/bills/${bill.id}`}
    />
  );
}

function addDays(date: string, days: number) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function BillEditorSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-40 rounded-xl" />
      <Skeleton className="h-10" />
    </div>
  );
}
