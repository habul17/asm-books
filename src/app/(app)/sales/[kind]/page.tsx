import { PlusIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ListToolbar } from "@/components/forms/list-toolbar";
import { SalesDocList, SalesDocListSkeleton } from "@/components/sales-docs/sales-doc-list";
import { buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { kindFromSlug, SALES_DOC_KIND, SALES_DOC_STATUSES, salesDocsHref, type SalesDocStatus } from "@/lib/sales-docs/kinds";

type Props = PageProps<"/sales/[kind]">;
const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const kind = kindFromSlug((await params).kind);
  return { title: kind ? SALES_DOC_KIND[kind].plural : "Not found" };
}

async function Content({ params, searchParams }: Props) {
  const kind = kindFromSlug((await params).kind);
  if (!kind) notFound();
  const query = await searchParams;
  const status = first(query.status);
  const { noun, plural } = SALES_DOC_KIND[kind];
  const path = salesDocsHref(kind);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold">{plural}</h1>
        <Link href={`${path}/new`} className={buttonVariants({ size: "sm" })}>
          <PlusIcon /> New {noun}
        </Link>
      </div>
      <ListToolbar
        path={path}
        label={`Search ${plural.toLowerCase()}`}
        placeholder="Search number, customer or mobile…"
        statusLabels={{ all: "All", open: "Open only", closed: "Closed only", cancelled: "Cancelled only" }}
      />
      <Suspense fallback={<SalesDocListSkeleton />}>
        <SalesDocList
          kind={kind}
          filters={{
            query: first(query.q).slice(0, 200),
            status: (SALES_DOC_STATUSES as readonly string[]).includes(status) ? (status as SalesDocStatus) : "all",
          }}
        />
      </Suspense>
    </>
  );
}

export default function SalesDocsPage(props: Props) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4">
      <Suspense fallback={<Skeleton className="h-64" />}>
        <Content {...props} />
      </Suspense>
    </div>
  );
}
