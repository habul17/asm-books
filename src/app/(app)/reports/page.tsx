import { ChevronLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { ModuleList } from "@/components/layout/module-list";
import { REPORT_GROUPS } from "@/components/layout/modules";

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
      {REPORT_GROUPS.map((rows) => (
        <ModuleList key={rows[0].label} rows={rows} />
      ))}
    </div>
  );
}
