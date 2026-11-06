import { ArrowLeftIcon, ChevronRightIcon, FolderIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney } from "@/lib/format";
import { describeRule, folderPathResolver } from "@/lib/price-lists/folders";
import { priceListsHref } from "@/lib/price-lists/href";
import { PRICE_BASES } from "@/lib/pricing";
import { getListPrices, PRICES_MAX, PRICES_PAGE, type FolderRow, type PriceListRow } from "@/server/price-lists";

import { DeleteButton, NewFolderButton, NewPriceListButton } from "./action-buttons";
import { FolderForm, PriceListForm } from "./forms";
import { ManualPriceInput } from "./manual-price-input";
import { PricesToolbar } from "./prices-toolbar";

function BackLink() {
  return (
    <Link
      href={priceListsHref()}
      scroll={false}
      className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:hidden"
    >
      <ArrowLeftIcon className="size-4" /> All price lists
    </Link>
  );
}

export function NotFoundPanel({ what }: { what: string }) {
  return (
    <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
      This {what} could not be found.{" "}
      <Link href={priceListsHref()} className="underline underline-offset-4">
        Back to price lists
      </Link>
    </p>
  );
}

export function IntroPanel() {
  return (
    <div className="hidden flex-col gap-3 rounded-xl border border-dashed p-8 text-sm text-muted-foreground md:flex">
      <p>Choose a folder or price list on the left, or make a new one.</p>
      <p>
        Each price list works out a selling price:{" "}
        <strong className="text-foreground">base price → markup or markdown % → discount % → rounding</strong>. You
        can also type a fixed price for any single product.
      </p>
    </div>
  );
}

export function FolderPanel({
  folder,
  folders,
  lists,
  rename,
}: {
  folder: FolderRow;
  folders: FolderRow[];
  lists: PriceListRow[];
  rename: boolean;
}) {
  const path = folderPathResolver(folders)(folder.parentId);
  const subfolders = folders.filter((f) => f.parentId === folder.id).length;
  const listCount = lists.filter((l) => l.folderId === folder.id).length;

  return (
    <Card>
      <CardHeader className="gap-2">
        <BackLink />
        {path && <p className="text-xs text-muted-foreground">{path}</p>}
        <CardTitle className="flex items-center gap-2 text-lg">
          <FolderIcon className="size-5 text-muted-foreground" /> {folder.name}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <FolderForm key={folder.id} folder={folder} folders={folders} rename={rename} />
        <div className="flex flex-wrap gap-2">
          <NewFolderButton parentId={folder.id} label="Subfolder here" />
          <NewPriceListButton folderId={folder.id} label="Price list here" />
        </div>
        <Separator />
        {subfolders || listCount ? (
          <p className="text-sm text-muted-foreground">
            This folder has {subfolders} folder{subfolders === 1 ? "" : "s"} and {listCount} price list
            {listCount === 1 ? "" : "s"}. Empty it before deleting.
          </p>
        ) : (
          <DeleteButton kind="folder" id={folder.id} />
        )}
      </CardContent>
    </Card>
  );
}

export async function PriceListPanel({
  list,
  folders,
  query,
  manualOnly,
  limit,
  rename,
}: {
  list: PriceListRow;
  folders: FolderRow[];
  query: string;
  manualOnly: boolean;
  limit: number;
  rename: boolean;
}) {
  const path = folderPathResolver(folders)(list.folderId);

  return (
    <Card>
      <CardHeader className="gap-2">
        <BackLink />
        <p className="text-xs text-muted-foreground">{path || "Top level"}</p>
        <CardTitle className="flex flex-wrap items-center gap-2 text-lg">
          {list.name}
          {!list.enabled && <Badge variant="outline">off</Badge>}
        </CardTitle>
        <p className="text-sm text-muted-foreground">{describeRule(list)}</p>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <details key={list.id} open={rename} className="group rounded-lg border">
          <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 text-sm font-medium select-none [&::-webkit-details-marker]:hidden">
            <ChevronRightIcon className="size-4 transition-transform group-open:rotate-90" />
            Edit name and rule
          </summary>
          <div className="flex flex-col gap-6 border-t p-4">
            <PriceListForm list={list} folders={folders} rename={rename} />
            <DeleteButton kind="list" id={list.id} />
          </div>
        </details>
        <section className="flex flex-col gap-3">
          <h3 className="font-medium">Prices in this list</h3>
          <PricesToolbar
            key={list.id}
            listId={list.id}
            query={query}
            manualOnly={manualOnly}
            manualCount={list.manualCount}
          />
          <PricesTable list={list} query={query} manualOnly={manualOnly} limit={limit} />
        </section>
      </CardContent>
    </Card>
  );
}

async function PricesTable({
  list,
  query,
  manualOnly,
  limit,
}: {
  list: PriceListRow;
  query: string;
  manualOnly: boolean;
  limit: number;
}) {
  const { total, items } = await getListPrices(list, { query, manualOnly, limit });
  const nextLimit = Math.min(limit + PRICES_PAGE, PRICES_MAX);
  const baseLabel = list.base === "manual" ? "Base" : PRICE_BASES[list.base].replace(/ price$/, "");

  return (
    <>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Part no</TableHead>
              <TableHead>Description</TableHead>
              <TableHead className="text-right">{baseLabel}</TableHead>
              <TableHead className="text-right">Rule price</TableHead>
              <TableHead className="text-right">Manual price</TableHead>
              <TableHead className="text-right">Final</TableHead>
              <TableHead className="text-right">Profit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-muted-foreground">
                  No products found
                </TableCell>
              </TableRow>
            ) : (
              items.map((p) => (
                <TableRow key={p.id} className={p.manualPrice != null ? "bg-amber-50/60 dark:bg-amber-950/20" : undefined}>
                  <TableCell className="font-mono">{p.partNo}</TableCell>
                  <TableCell className="max-w-72 truncate" title={p.description}>
                    {p.description}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(p.base)}</TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {formatMoney(p.rulePrice)}
                  </TableCell>
                  <TableCell className="text-right">
                    <ManualPriceInput
                      key={`${p.id}:${p.manualPrice}`}
                      listId={list.id}
                      productId={p.id}
                      partNo={p.partNo}
                      value={p.manualPrice}
                    />
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{formatMoney(p.price)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatMoney(p.profit)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
        <span aria-live="polite">
          Showing {items.length} of {total} product{total === 1 ? "" : "s"}
        </span>
        {items.length < total && limit < PRICES_MAX && (
          <Link
            href={priceListsHref({ list: list.id, q: query, manual: manualOnly, limit: nextLimit })}
            scroll={false}
            className="font-medium text-foreground underline underline-offset-4"
          >
            Show more
          </Link>
        )}
      </div>
    </>
  );
}

export function PanelSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border p-6">
      <Skeleton className="h-6 w-1/2" />
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-9" />
        ))}
      </div>
      <Skeleton className="h-64" />
    </div>
  );
}
