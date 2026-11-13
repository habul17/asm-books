import type { Metadata } from "next";
import { Suspense } from "react";

import { EmptyReport, ReportHeader, ReportPage, ReportSkeleton } from "@/components/reports/report-parts";
import { LowStockRows } from "@/components/reminders/reminder-lists";
import { LOW_STOCK_LIMIT, lowStock } from "@/server/reports";

export const metadata: Metadata = { title: "Low Stock" };

async function Body() {
  const { items, more } = await lowStock();
  if (items.length === 0) return <EmptyReport>Nothing to reorder right now.</EmptyReport>;
  return (
    <>
      <p className="text-sm text-muted-foreground">
        {more ? `First ${LOW_STOCK_LIMIT} parts` : `${items.length} part${items.length === 1 ? "" : "s"}`} to reorder
      </p>
      <LowStockRows items={items} />
    </>
  );
}

export default function LowStockPage() {
  return (
    <ReportPage staffAllowed>
      <ReportHeader title="Low Stock">
        Parts out of stock (that you have stocked or sold before) or at their minimum level. Set a part&rsquo;s minimum on its Items page, or one level for all parts under Reminders → Reminder settings.
      </ReportHeader>
      <Suspense fallback={<ReportSkeleton />}>
        <Body />
      </Suspense>
    </ReportPage>
  );
}
