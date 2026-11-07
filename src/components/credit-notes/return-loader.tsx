import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";

import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { getReturnable } from "@/server/credit-notes";
import { todayInIndia } from "@/server/invoice-writes";

import { ReturnForm } from "./return-form";

export async function NewReturnForm({ invoiceId }: { invoiceId: number }) {
  await connection(); // Today's date must be read per request, not at build time.
  const invoice = await getReturnable(invoiceId);
  if (!invoice) notFound();
  return (
    <>
      <p className="text-sm text-muted-foreground">
        From invoice{" "}
        <Link href={`/invoices/${invoice.id}`} className="font-mono font-medium text-foreground hover:underline">
          {invoice.number}
        </Link>{" "}
        · {invoice.customerName} · {formatDate(invoice.date)}
      </p>
      {invoice.status === "cancelled" ? (
        <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          This invoice is cancelled, so nothing on it can be returned.
        </p>
      ) : (
        <ReturnForm invoice={invoice} today={todayInIndia()} />
      )}
    </>
  );
}

export function ReturnFormSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-5 w-64" />
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-16" />
      <Skeleton className="h-24" />
    </div>
  );
}
