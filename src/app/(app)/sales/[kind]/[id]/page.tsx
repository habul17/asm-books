import { ArrowLeftIcon, ArrowRightIcon, PencilIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { PrintButton } from "@/components/invoices/invoice-actions";
import { InvoiceDocument } from "@/components/invoices/invoice-document";
import { SalesDocStatusBadge } from "@/components/sales-docs/sales-doc-list";
import { SalesDocStatusButtons } from "@/components/sales-docs/sales-doc-status-buttons";
import { TransportForm } from "@/components/transport/transport-form";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate } from "@/lib/format";
import { kindFromSlug, NEXT_STEPS, SALES_DOC_KIND, salesDocHref, salesDocsHref } from "@/lib/sales-docs/kinds";
import { needsEwayBill, transportRows } from "@/lib/transport";
import { getSalesDoc } from "@/server/sales-docs";
import { getBusiness } from "@/server/settings";

type Props = PageProps<"/sales/[kind]/[id]">;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const kind = kindFromSlug((await params).kind);
  return { title: kind ? SALES_DOC_KIND[kind].title : "Not found" };
}

async function Doc({ params }: { params: Props["params"] }) {
  const { kind: slug, id: rawId } = await params;
  const kind = kindFromSlug(slug);
  const id = Number(rawId);
  if (!kind || !Number.isSafeInteger(id) || id <= 0) notFound();
  const [doc, business] = await Promise.all([getSalesDoc(kind, id), getBusiness()]);
  if (!doc) notFound();
  const info = SALES_DOC_KIND[kind];
  const open = doc.status === "open";
  const nextHref = (to: (typeof NEXT_STEPS)[typeof kind][number]) =>
    to === "invoice" ? `/invoices/new?from=${doc.id}` : `${salesDocsHref(to)}/new?from=${doc.id}`;

  return (
    <>
      <Link
        href={salesDocsHref(kind)}
        className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeftIcon className="size-4" /> All {info.plural.toLowerCase()}
      </Link>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        <h1 className="mr-auto flex flex-wrap items-center gap-2 text-xl font-semibold">
          <span className="font-mono">{doc.number}</span>
          <SalesDocStatusBadge status={doc.status} />
        </h1>
        <PrintButton />
        {open && (
          <Link href={`${salesDocHref(kind, doc.id)}/edit`} className={buttonVariants({ variant: "outline", size: "sm" })}>
            <PencilIcon /> Edit
          </Link>
        )}
        {open &&
          NEXT_STEPS[kind].map((to) => (
            <Link
              key={to}
              href={nextHref(to)}
              className={buttonVariants({ variant: to === "invoice" ? "default" : "outline", size: "sm" })}
            >
              <ArrowRightIcon /> Make {to === "invoice" ? "invoice" : SALES_DOC_KIND[to].noun}
            </Link>
          ))}
      </div>

      <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground print:hidden">
        {doc.source && (
          <span>
            From {SALES_DOC_KIND[doc.source.kind].noun}{" "}
            <Link
              href={salesDocHref(doc.source.kind, doc.source.id)}
              className="font-mono font-medium text-foreground hover:underline"
            >
              {doc.source.number}
            </Link>
          </span>
        )}
        {doc.made.map((m) => (
          <span key={m.id}>
            {SALES_DOC_KIND[m.kind].title}{" "}
            <Link href={salesDocHref(m.kind, m.id)} className="font-mono font-medium text-foreground hover:underline">
              {m.number}
            </Link>
            {m.status === "cancelled" && " (cancelled)"}
          </span>
        ))}
        {doc.invoiceId != null && doc.invoiceNumber && (
          <span>
            Invoice{" "}
            <Link href={`/invoices/${doc.invoiceId}`} className="font-mono font-medium text-foreground hover:underline">
              {doc.invoiceNumber}
            </Link>
          </span>
        )}
        {doc.createdByName && <span>Made by {doc.createdByName}</span>}
        <span>Does not change stock or the customer&apos;s balance</span>
      </p>

      <InvoiceDocument
        invoice={{ ...doc, status: doc.status === "cancelled" ? "cancelled" : "final" }}
        business={business}
        title={info.title}
        numberLabel={info.numberLabel}
        user={doc.createdByName}
        createdAt={doc.createdAt}
        details={[
          ...(info.secondDateLabel && doc.secondDate
            ? [{ label: info.secondDateLabel, value: formatDate(doc.secondDate) }]
            : []),
          ...(doc.reason ? [{ label: "Reason", value: doc.reason }] : []),
          ...transportRows(doc.transport),
        ]}
      />

      {kind === "challan" && doc.status !== "cancelled" && (
        <TransportForm
          target="challan"
          id={doc.id}
          transport={doc.transport}
          needsEwayBill={doc.invoiceId == null && needsEwayBill(doc.grandTotal, doc.transport)}
        />
      )}

      <SalesDocStatusButtons kind={kind} id={doc.id} status={doc.status} invoiced={doc.invoiceId != null} />
    </>
  );
}

export default function SalesDocPage({ params }: Props) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 print:max-w-none">
      <Suspense fallback={<Skeleton className="h-[600px]" />}>
        <Doc params={params} />
      </Suspense>
    </div>
  );
}
