import type { ShownExtra } from "@/lib/custom-fields";
import { formatDate, formatMoney, formatQty } from "@/lib/format";
import { GST_STATES } from "@/lib/gst";
import { amountInWords, taxSummary } from "@/lib/invoices/math";
import type { BusinessSettings } from "@/lib/settings/business";
import type { InvoiceDetail } from "@/server/invoices";

type Line = InvoiceDetail["lines"][number];

/** What a printed tax document needs; both invoices and credit notes have it. */
export interface TaxDocumentData
  extends Pick<
    InvoiceDetail,
    | "number"
    | "date"
    | "status"
    | "customerName"
    | "billingAddress"
    | "customerMobile"
    | "customerGstin"
    | "placeOfSupply"
    | "taxType"
    | "taxableTotal"
    | "cgstTotal"
    | "sgstTotal"
    | "igstTotal"
    | "roundOff"
    | "grandTotal"
    | "notes"
  > {
  lines: Pick<
    Line,
    | "id"
    | "lineNo"
    | "partNo"
    | "description"
    | "hsn"
    | "unit"
    | "qty"
    | "rate"
    | "discountPct"
    | "gstRate"
    | "taxable"
    | "cgst"
    | "sgst"
    | "igst"
    | "total"
  >[];
}

const stateLabel = (code: string | null) => (code && GST_STATES[code] ? `${GST_STATES[code]} (${code})` : null);

/**
 * The invoice as printed: A4, black on white, also used as the on-screen view.
 * Credit notes use it too, with their own `title` and `details` under the number.
 */
export function InvoiceDocument({
  invoice: inv,
  business: b,
  title,
  details,
  partyLabel = "Bill to",
  extra = [],
}: {
  invoice: TaxDocumentData;
  business: BusinessSettings;
  title?: string;
  details?: React.ReactNode;
  /** Heading over the other party, e.g. "Bill to" or "Returned to". */
  partyLabel?: string;
  /** Filled-in custom fields, printed with the place of supply. */
  extra?: ShownExtra[];
}) {
  const inter = inv.taxType === "inter";
  const summary = taxSummary(inv.lines);
  const hasDiscount = inv.lines.some((l) => l.discountPct > 0);

  return (
    <article className="invoice-document relative mx-auto w-full max-w-[210mm] bg-white p-6 text-[13px] leading-snug text-black shadow-sm ring-1 ring-black/10 sm:p-10 print:max-w-none print:p-0 print:shadow-none print:ring-0">
      {inv.status === "cancelled" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="-rotate-30 rounded-lg border-4 border-red-600/40 px-6 py-2 text-6xl font-bold tracking-widest text-red-600/40">
            CANCELLED
          </span>
        </div>
      )}

      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-black/20 pb-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold">{b.name || "Your business name"}</h2>
          {b.address && <p className="whitespace-pre-line">{b.address}</p>}
          {(b.city || b.pincode) && <p>{[b.city, b.pincode].filter(Boolean).join(" - ")}</p>}
          {stateLabel(b.stateCode) && <p>State: {stateLabel(b.stateCode)}</p>}
          {b.gstin && <p className="font-medium">GSTIN: {b.gstin}</p>}
          {(b.phone || b.email) && <p>{[b.phone, b.email].filter(Boolean).join(" · ")}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tracking-wide uppercase">{title ?? b.invoiceTitle}</p>
          <p className="font-mono text-sm">{inv.number}</p>
          <p>Date: {formatDate(inv.date)}</p>
          {details}
        </div>
      </header>

      <section className="grid gap-4 border-b border-black/20 py-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold text-black/60 uppercase">{partyLabel}</p>
          <p className="font-semibold">{inv.customerName}</p>
          {inv.billingAddress && <p className="whitespace-pre-line">{inv.billingAddress}</p>}
          {inv.customerMobile && <p>Mobile: {inv.customerMobile}</p>}
          {inv.customerGstin && <p className="font-medium">GSTIN: {inv.customerGstin}</p>}
        </div>
        <div className="sm:text-right">
          {stateLabel(inv.placeOfSupply) && <p>Place of supply: {stateLabel(inv.placeOfSupply)}</p>}
          <p>{inter ? "IGST (inter-state)" : "CGST + SGST (intra-state)"}</p>
          {extra.map((x) => (
            <p key={x.id} className="break-words">
              {x.label}: <span className="font-medium">{x.value}</span>
            </p>
          ))}
        </div>
      </section>

      <div className="overflow-x-auto print:overflow-visible">
        <table className="w-full min-w-[600px] border-collapse print:min-w-0">
          <thead>
            <tr className="border-b border-black/30 text-left text-xs">
              <th className="py-2 pr-2 font-semibold">#</th>
              <th className="py-2 pr-2 font-semibold">Part no</th>
              <th className="py-2 pr-2 font-semibold">Item</th>
              <th className="py-2 pr-2 font-semibold">HSN</th>
              <th className="py-2 pr-2 text-right font-semibold">Qty</th>
              <th className="py-2 pr-2 text-right font-semibold">Rate</th>
              {hasDiscount && <th className="py-2 pr-2 text-right font-semibold">Disc %</th>}
              <th className="py-2 pr-2 text-right font-semibold">Taxable</th>
              <th className="py-2 pr-2 text-right font-semibold">GST %</th>
              <th className="py-2 text-right font-semibold">Amount</th>
            </tr>
          </thead>
          <tbody>
            {inv.lines.map((l) => (
              <tr key={l.id} className="border-b border-black/10 align-top">
                <td className="py-1.5 pr-2">{l.lineNo}</td>
                <td className="py-1.5 pr-2 font-mono text-xs">{l.partNo ?? ""}</td>
                <td className="py-1.5 pr-2">{l.description}</td>
                <td className="py-1.5 pr-2 text-xs">{l.hsn ?? ""}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">
                  {formatQty(l.qty)} <span className="text-xs text-black/60">{l.unit}</span>
                </td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{formatMoney(l.rate)}</td>
                {hasDiscount && <td className="py-1.5 pr-2 text-right tabular-nums">{l.discountPct || ""}</td>}
                <td className="py-1.5 pr-2 text-right tabular-nums">{formatMoney(l.taxable)}</td>
                <td className="py-1.5 pr-2 text-right tabular-nums">{l.gstRate}</td>
                <td className="py-1.5 text-right tabular-nums">{formatMoney(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="mt-4 grid gap-6 sm:grid-cols-[minmax(0,1fr)_16rem] print:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="flex flex-col gap-3">
          <table className="w-full max-w-md border-collapse text-xs">
            <thead>
              <tr className="border-b border-black/30 text-left">
                <th className="py-1 pr-2 font-semibold">GST %</th>
                <th className="py-1 pr-2 text-right font-semibold">Taxable</th>
                {inter ? (
                  <th className="py-1 text-right font-semibold">IGST</th>
                ) : (
                  <>
                    <th className="py-1 pr-2 text-right font-semibold">CGST</th>
                    <th className="py-1 text-right font-semibold">SGST</th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {summary.map((s) => (
                <tr key={s.gstRate} className="border-b border-black/10">
                  <td className="py-1 pr-2">{s.gstRate}%</td>
                  <td className="py-1 pr-2 text-right tabular-nums">{formatMoney(s.taxable)}</td>
                  {inter ? (
                    <td className="py-1 text-right tabular-nums">{formatMoney(s.igst)}</td>
                  ) : (
                    <>
                      <td className="py-1 pr-2 text-right tabular-nums">{formatMoney(s.cgst)}</td>
                      <td className="py-1 text-right tabular-nums">{formatMoney(s.sgst)}</td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="font-medium">{amountInWords(inv.grandTotal)}</p>
          {inv.notes && <p className="whitespace-pre-line">Note: {inv.notes}</p>}
        </div>
        <dl className="flex flex-col gap-1">
          <Row label="Taxable value" value={inv.taxableTotal} />
          {inter ? (
            <Row label="IGST" value={inv.igstTotal} />
          ) : (
            <>
              <Row label="CGST" value={inv.cgstTotal} />
              <Row label="SGST" value={inv.sgstTotal} />
            </>
          )}
          {inv.roundOff !== 0 && <Row label="Round off" value={inv.roundOff} />}
          <div className="mt-1 flex justify-between border-t border-black/40 pt-2 text-base font-bold">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatMoney(inv.grandTotal)}</dd>
          </div>
        </dl>
      </section>

      <footer className="mt-8 grid gap-6 border-t border-black/20 pt-4 sm:grid-cols-2 print:grid-cols-2">
        <div className="flex flex-col gap-2 text-xs">
          {(b.bankName || b.bankAccount || b.upiId) && (
            <div>
              <p className="font-semibold">Payment details</p>
              {b.bankName && <p>Bank: {b.bankName}</p>}
              {b.bankAccount && <p>A/c no: {b.bankAccount}</p>}
              {b.bankIfsc && <p>IFSC: {b.bankIfsc}</p>}
              {b.upiId && <p>UPI: {b.upiId}</p>}
            </div>
          )}
          {b.terms && (
            <div>
              <p className="font-semibold">Terms</p>
              <p className="whitespace-pre-line">{b.terms}</p>
            </div>
          )}
        </div>
        <div className="flex flex-col items-end justify-between gap-10 text-right">
          <p>For {b.name || "your business"}</p>
          <p className="text-xs">Authorised signatory</p>
        </div>
      </footer>
    </article>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <dt>{label}</dt>
      <dd className="tabular-nums">{formatMoney(value)}</dd>
    </div>
  );
}
