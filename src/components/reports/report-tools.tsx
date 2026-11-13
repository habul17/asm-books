"use client";

import { DownloadIcon, PrinterIcon } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";

import { Button, buttonVariants } from "@/components/ui/button";

/**
 * "Excel" downloads the report on screen as a CSV file, for the same period
 * or date; "Print / PDF" opens the browser's print box, which can save a PDF.
 */
export function ReportTools() {
  const report = (usePathname() ?? "").split("/").filter(Boolean).pop() ?? "";
  const query = useSearchParams()?.toString() ?? "";
  const href = `/reports/download/${encodeURIComponent(report)}${query ? `?${query}` : ""}`;
  return (
    <div className="flex items-center gap-2 print:hidden">
      {/* A plain link: the file must come from the server, not from the page cache. */}
      <a href={href} download className={buttonVariants({ variant: "outline", size: "sm" })}>
        <DownloadIcon /> Excel
      </a>
      <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
        <PrinterIcon /> Print / PDF
      </Button>
    </div>
  );
}
