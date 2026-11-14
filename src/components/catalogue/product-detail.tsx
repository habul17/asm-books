import { ArrowDownIcon, ArrowLeftIcon, ArrowUpIcon, PencilIcon } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { round2 } from "@/lib/pricing";
import { getProduct } from "@/server/catalogue";

import { MinStockForm } from "./min-stock-form";
import { catalogueHref } from "./product-results";
import { QuickMarkup } from "./quick-markup";

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function PriceChange({ change }: { change: number | null }) {
  if (change == null || Math.abs(change) < 0.005) return null;
  const up = change > 0;
  const Icon = up ? ArrowUpIcon : ArrowDownIcon;
  return (
    <span className={up ? "text-destructive" : "text-emerald-600 dark:text-emerald-400"}>
      <Icon className="inline size-3.5" aria-hidden />
      <span className="sr-only">{up ? "Up" : "Down"}</span> {formatMoney(Math.abs(change))} vs previous
    </span>
  );
}

export async function ProductDetailPanel({ id, query }: { id: number; query: string }) {
  const p = await getProduct(id);
  if (!p) {
    return (
      <p className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
        This product could not be found.{" "}
        <Link href={catalogueHref(query)} className="underline underline-offset-4">
          Back to results
        </Link>
      </p>
    );
  }

  return (
    <Card className="md:sticky md:top-6">
      <CardHeader className="gap-2">
        <Link
          href={catalogueHref(query)}
          scroll={false}
          className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground md:hidden"
        >
          <ArrowLeftIcon className="size-4" /> Back to results
        </Link>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-lg">
            <span className="font-mono">{p.partNo}</span> · {p.description}
          </CardTitle>
          {p.canEdit && (
            <Link href={`/catalogue/${p.id}/edit`} className={buttonVariants({ variant: "outline", size: "sm", className: "shrink-0" })}>
              <PencilIcon /> Edit
            </Link>
          )}
        </div>
        {!p.active && (
          <p className="w-fit rounded-md bg-destructive/10 px-2 py-1 text-sm text-destructive">
            Switched off — hidden from bills and staff searches.
          </p>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <Fact label="Brand">{p.brand ?? "—"}</Fact>
          <Fact label="Category">{[p.categoryGroup, p.category].filter(Boolean).join(" › ") || "—"}</Fact>
          <Fact label="HSN code">{p.hsn ?? "—"}</Fact>
          <Fact label="GST">{p.gstRate != null ? `${p.gstRate}%` : "Default"}</Fact>
          <Fact label="Stock">
            {formatQty(p.stockQty)} {p.unit}
          </Fact>
          <Fact label="Purchase price">
            <strong className="tabular-nums" title={p.purchasePrice != null ? `₹${p.purchasePrice}` : undefined}>
              {formatMoney(p.purchasePrice)}
            </strong>{" "}
            <PriceChange change={p.priceChange} />
          </Fact>
          <Fact label="Previous purchase">{formatMoney(p.previousPurchasePrice)}</Fact>
        </dl>

        <MinStockForm productId={p.id} minStock={p.minStock} unit={p.unit} />

        <section className="flex flex-col gap-3">
          <h3 className="font-medium">Selling prices</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Price list</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead className="text-right">Profit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.sellingPrices.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No price lists switched on
                  </TableCell>
                </TableRow>
              ) : (
                p.sellingPrices.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <span className="flex flex-wrap items-center gap-1.5">
                        {s.name}
                        {s.manual && <Badge variant="secondary">manual</Badge>}
                      </span>
                      {s.folder && <span className="block text-xs text-muted-foreground">{s.folder}</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatMoney(s.price)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatMoney(
                        s.price == null || p.purchasePrice == null ? null : round2(s.price - p.purchasePrice),
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <QuickMarkup purchasePrice={p.purchasePrice} />
        </section>

        <section className="flex flex-col gap-3">
          <h3 className="font-medium">Purchase price history</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead className="text-right">Price</TableHead>
                <TableHead>Supplier / Bill</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {p.history.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-muted-foreground">
                    No purchases yet
                  </TableCell>
                </TableRow>
              ) : (
                p.history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell>{formatDate(h.date)}</TableCell>
                    <TableCell className="text-right tabular-nums" title={`₹${h.price}`}>
                      {formatMoney(h.price)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {[h.supplier, h.billRef].filter(Boolean).join(" · ") ||
                        (h.source === "manual" ? "Typed in" : h.source?.replace(/^excel:/, "Imported from ")) ||
                        "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>
      </CardContent>
    </Card>
  );
}

export function ProductDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 rounded-xl border p-6">
      <Skeleton className="h-6 w-2/3" />
      <div className="grid grid-cols-3 gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-10" />
        ))}
      </div>
      <Skeleton className="h-40" />
    </div>
  );
}
