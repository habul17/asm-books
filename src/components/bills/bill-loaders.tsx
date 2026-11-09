import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Skeleton } from "@/components/ui/skeleton";
import { getBill, getBillEditorOptions } from "@/server/bills";
import { todayInIndia } from "@/server/invoice-writes";
import { pickVendorById } from "@/server/vendors";

import { BillEditor } from "./bill-editor";

export async function NewBillForm({ vendorId }: { vendorId: number | null }) {
  await connection(); // Today's date must be read per request, not at build time.
  const [options, vendor] = await Promise.all([getBillEditorOptions(), vendorId ? pickVendorById(vendorId) : null]);
  const today = todayInIndia();
  const due = vendor?.paymentTermsDays != null ? addDays(today, vendor.paymentTermsDays) : "";
  return (
    <BillEditor
      initial={{ id: null, vendor, billNo: "", date: today, dueDate: due, updatePrices: true, roundTotal: true, notes: "", lines: [] }}
      sellerState={options.sellerState}
      cancelHref={vendor ? `/vendors/${vendor.id}` : "/bills"}
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
        updatePrices: bill.updatePrices,
        // A total with paise means the bill was saved without rounding.
        roundTotal: Number.isInteger(Math.round(bill.grandTotal * 100) / 100),
        notes: bill.notes ?? "",
        lines: bill.lines.map((l) => ({
          key: `e${l.id}`,
          productId: l.productId,
          partNo: l.partNo,
          description: l.description,
          unit: l.unit,
          qty: String(l.qty),
          rate: String(l.rate),
          discountPct: l.discountPct ? String(l.discountPct) : "",
          gstRate: l.gstRate,
        })),
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
