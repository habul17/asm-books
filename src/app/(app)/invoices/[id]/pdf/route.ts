import { connection, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/auth/session-token";
import { getCurrentUser } from "@/server/auth";
import { printPageToPdf } from "@/server/invoice-pdf";
import { getInvoice } from "@/server/invoices";

// Starting the headless browser takes a few seconds on a cold start.
export const maxDuration = 60;

/** This app's own addresses. The session cookie is only ever handed to one of these. */
function ownOrigin(request: NextRequest): string | null {
  const host = request.headers.get("host") ?? "";
  if (process.env.NODE_ENV !== "production") {
    return /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) ? `http://${host}` : null;
  }
  const allowed = [
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_BRANCH_URL,
    process.env.VERCEL_URL,
  ].filter(Boolean);
  return allowed.includes(host) ? `https://${host}` : null;
}

/** The invoice as a real A4 PDF (selectable text), for sharing on WhatsApp. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await connection();
  if (!(await getCurrentUser())) return new Response("Please sign in.", { status: 401 });
  const id = Number((await params).id);
  const inv = await getInvoice(id);
  if (!inv) return new Response("Not found.", { status: 404 });

  const origin = ownOrigin(request);
  const session = request.cookies.get(SESSION_COOKIE);
  if (!origin || !session) return new Response("Could not make the PDF.", { status: 400 });

  let pdf: Uint8Array;
  try {
    pdf = await printPageToPdf(origin, `/invoices/${inv.id}`, session);
  } catch (error) {
    console.error("Invoice PDF failed", inv.id, error instanceof Error ? error.message : "unknown error");
    return new Response("Could not make the PDF. Please try again.", { status: 500 });
  }

  const fileName = `${inv.number.replace(/[^A-Za-z0-9_-]+/g, "-")}.pdf`;
  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(pdf.length),
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Cache-Control": "no-store, private",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
