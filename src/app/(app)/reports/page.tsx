import { ChevronLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { buttonVariants } from "@/components/ui/button";
import { ModuleList } from "@/components/layout/module-list";
import { REPORT_GROUPS } from "@/components/layout/modules";
import { viewerIsOwner } from "@/server/auth";

/** Staff see only the stock report; money reports are for the owner. */
const STAFF_REPORTS = new Set(["/reports/low-stock"]);

async function ReportGroups() {
  await connection();
  const owner = await viewerIsOwner();
  const groups = owner
    ? REPORT_GROUPS
    : REPORT_GROUPS.map((rows) => rows.filter((r) => r.href && STAFF_REPORTS.has(r.href))).filter((rows) => rows.length);
  return groups.map((rows) => <ModuleList key={rows[0].label} rows={rows} />);
}

export const metadata: Metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link href="/more" className={buttonVariants({ variant: "ghost", size: "icon" })} aria-label="Back to More">
          <ChevronLeftIcon />
        </Link>
        <h1 className="text-xl font-semibold">Reports</h1>
      </div>
      <Suspense fallback={null}>
        <ReportGroups />
      </Suspense>
    </div>
  );
}
