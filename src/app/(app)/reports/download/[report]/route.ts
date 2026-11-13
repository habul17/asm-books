import { connection } from "next/server";

import { toCsv } from "@/lib/reports/csv";
import { getCurrentUser, OwnerOnlyError } from "@/server/auth";
import { exportReport } from "@/server/report-exports";

/** Downloads one report as a CSV file, for the same period or date the screen shows. */
export async function GET(request: Request, { params }: { params: Promise<{ report: string }> }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return new Response("Please sign in.", { status: 401 });

  const { report } = await params;
  const query = Object.fromEntries(new URL(request.url).searchParams);
  let result;
  try {
    result = await exportReport(report, query);
  } catch (err) {
    if (err instanceof OwnerOnlyError) return new Response("Only the owner can download this report.", { status: 403 });
    console.error("[reports] download failed:", err instanceof Error ? err.message : err);
    return new Response("Could not make the file. Please try again.", { status: 500 });
  }
  if (!result) return new Response("No such report.", { status: 404 });

  return new Response(toCsv(result.rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${result.file}"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
