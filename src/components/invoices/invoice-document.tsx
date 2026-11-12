import type { ShownExtra } from "@/lib/custom-fields";
import { formatQty } from "@/lib/format";
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

/** One "Label : value" row in the box beside the buyer. */
export interface DocumentDetail {
  label: string;
  value: string;
}

/** Amounts as printed: two decimals, no currency sign and no digit grouping. */
const amount = (n: number) => n.toFixed(2);
const round2 = (n: number) => Math.round(n * 100) / 100;
/** 2026-11-06 → 06/11/2026 */
const printDate = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const textLines = (text: string | null | undefined) =>
  (text ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

const clock = new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata",
  hour: "2-digit",
  minute: "2-digit",
  hour12: true,
});

const headCell = "border-l border-black px-1 py-1 text-center align-middle leading-tight first:border-l-0";
const cell = "border-l border-black px-1 align-top first:border-l-0";
const right = `${cell} text-right tabular-nums`;

/**
 * The invoice as printed: one bordered A4 sheet in bold typewriter letters,
 * also used as the on-screen view. Credit notes and debit notes use it too,
 * with their own `title`, `numberLabel` and `details`.
 */
export function InvoiceDocument({
  invoice: inv,
  business: b,
  title,
  numberLabel = "Bill No",
  paymentTerms,
  user,
  createdAt,
  details = [],
  extra = [],
  showBank = true,
}: {
  invoice: TaxDocumentData;
  business: BusinessSettings;
  title?: string;
  /** Label in front of the document number. */
  numberLabel?: string;
  /** "Cash" or "Credit"; left out when the document has no payment terms. */
  paymentTerms?: string;
  /** Who made the document. */
  user?: string | null;
  /** When the document was made; printed as the time of day. */
  createdAt?: Date | null;
  /** More rows for the box beside the buyer, e.g. the due date. */
  details?: DocumentDetail[];
  /** Filled-in custom fields, printed after `details`. */
  extra?: ShownExtra[];
  /** False leaves out our bank details and sale terms, e.g. on a purchase order. */
  showBank?: boolean;
}) {
  const inter = inv.taxType === "inter";
  const summary = taxSummary(inv.lines);
  const hasDiscount = inv.lines.some((l) => l.discountPct > 0);
  const lineTax = (l: TaxDocumentData["lines"][number]) => round2(l.cgst + l.sgst + l.igst);
  const qtyTotal = inv.lines.reduce((s, l) => s + l.qty, 0);
  const taxTotal = round2(inv.cgstTotal + inv.sgstTotal + inv.igstTotal);
  const linesTotal = round2(inv.grandTotal - inv.roundOff);
  const stateName = inv.placeOfSupply ? GST_STATES[inv.placeOfSupply] : undefined;
  const rows: DocumentDetail[] = [
    ...(user ? [{ label: "User", value: user }] : []),
    ...details,
    ...extra.map((x) => ({ label: x.label, value: x.value })),
  ];
  const bankLines = [
    b.bankName && `BANK NAME : ${b.bankName}`,
    b.bankAccount && `A/C NO    : ${b.bankAccount}`,
    b.bankIfsc && `IFSC      : ${b.bankIfsc}`,
    b.upiId && `UPI       : ${b.upiId}`,
  ].filter((l): l is string => showBank && Boolean(l));
  const terms = showBank ? b.terms : "";
  // Column widths in percent; the description gives up room for the discount column.
  const widths = hasDiscount ? [5, 12, 16, 11, 11, 10, 6, 4.5, 9, 4.5, 11] : [5, 12, 18, 12, 12, 10, 5, 9, 5, 12];

  return (
    <article className="invoice-document relative mx-auto flex w-full max-w-[210mm] flex-col bg-white p-4 text-[12px] leading-snug font-bold text-black shadow-sm ring-1 ring-black/10 sm:min-h-[285mm] sm:p-8 print:min-h-[272mm] print:max-w-none print:p-0 print:shadow-none print:ring-0">
      {inv.status === "cancelled" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
          <span className="-rotate-30 rounded-lg border-4 border-red-600/40 px-6 py-2 text-6xl font-bold tracking-widest text-red-600/40">
            CANCELLED
          </span>
        </div>
      )}

      <p className="pr-4 text-right text-[11px] italic">(ORIGINAL)</p>

      <div className="flex flex-1 flex-col border border-black box-decoration-clone">
        <header className="px-1 pb-1 text-center">
          <div className="flex justify-between gap-4 text-left">
            <p className="text-[13px]">{b.gstin && `GSTIN: ${b.gstin}`}</p>
            <p className="text-[11px]">{b.phone && `CELL:${b.phone}`}</p>
          </div>
          <h2 className="text-[26px] leading-tight uppercase">{b.name || "Your business name"}</h2>
          <div className="text-[11px] uppercase">
            {textLines(b.address).map((l, i) => (
              <p key={i}>{l}</p>
            ))}
            {(b.city || b.pincode) && <p>{[b.city, b.pincode].filter(Boolean).join(" - ")}</p>}
            {GST_STATES[b.stateCode] && <p>{GST_STATES[b.stateCode]}</p>}
          </div>
          {b.email && <p className="text-[11px]">{b.email}</p>}
          <p className="mt-3 text-[13px] uppercase">{title ?? b.invoiceTitle}</p>
        </header>

        <section className="grid grid-cols-[minmax(0,54fr)_minmax(0,46fr)] border-t border-black">
          <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-1 px-1 pt-0.5 pb-2">
            <p>To.</p>
            <div className="break-words">
              <p className="uppercase">{inv.customerName}</p>
              {textLines(inv.billingAddress).map((l, i) => (
                <p key={i} className="uppercase">
                  {l}
                </p>
              ))}
              {inv.customerMobile && <p>Ph: {inv.customerMobile}</p>}
              {inv.customerGstin && <p>GSTIN : {inv.customerGstin}</p>}
              {stateName && <p>State Name : {stateName}</p>}
              {inv.placeOfSupply && <p>State Code : {inv.placeOfSupply}</p>}
            </div>
          </div>
          <dl className="grid grid-cols-[auto_auto_minmax(0,1fr)] content-start gap-x-1.5 border-l border-black px-2 pt-0.5 pb-2">
            {paymentTerms && <Detail label="Payment Terms" value={paymentTerms} />}
            <Detail label={numberLabel} value={inv.number} big />
            <Detail label="Date" value={printDate(inv.date)} />
            {rows.map((r, i) => (
              <Detail key={i} label={r.label} value={r.value} />
            ))}
          </dl>
        </section>

        <div className="flex flex-1 flex-col overflow-x-auto border-t border-black print:overflow-visible">
          <table className="w-full min-w-[640px] flex-1 table-fixed border-collapse print:min-w-0">
            <colgroup>
              {widths.map((w, i) => (
                <col key={i} style={{ width: `${w}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr className="border-b border-black">
                <th className={headCell}>S.No</th>
                <th className={headCell}>Part No</th>
                <th className={headCell}>Description</th>
                <th className={headCell}>
                  HSN
                  <br />
                  Code
                </th>
                <th className={headCell}>Qty</th>
                <th className={headCell}>Rate</th>
                {hasDiscount && (
                  <th className={headCell}>
                    Disc
                    <br />%
                  </th>
                )}
                <th className={headCell}>
                  Tax
                  <br />%
                </th>
                <th className={headCell}>
                  Tax
                  <br />
                  Amt ₹
                </th>
                <th className={headCell}>
                  CESS
                  <br />%
                </th>
                <th className={headCell}>
                  Total
                  <br />
                  Amount ₹
                </th>
              </tr>
            </thead>
            <tbody className="[&>tr:first-child>td]:pt-3">
              {inv.lines.map((l) => (
                <tr key={l.id} className="break-inside-avoid">
                  <td className={right}>{l.lineNo}</td>
                  <td className={`${cell} break-all`}>{l.partNo ?? ""}</td>
                  <td className={`${cell} break-words`}>{l.description}</td>
                  <td className={`${cell} break-all`}>{l.hsn ?? ""}</td>
                  <td className={right}>
                    {formatQty(l.qty)} {l.unit}
                  </td>
                  <td className={right}>{amount(l.rate)}</td>
                  {hasDiscount && <td className={right}>{l.discountPct || ""}</td>}
                  <td className={`${cell} text-center tabular-nums`}>{l.gstRate}</td>
                  <td className={right}>{amount(lineTax(l))}</td>
                  <td className={cell} />
                  <td className={right}>{amount(l.total)}</td>
                </tr>
              ))}
              {/* Takes up the rest of the sheet, so the column lines run down to the total. */}
              <tr aria-hidden className="h-full">
                {widths.map((_, i) => (
                  <td key={i} className={cell} />
                ))}
              </tr>
              <tr className="break-inside-avoid border-y border-black">
                <td className={cell} />
                <td className={`${cell} pl-3`}>Total</td>
                <td className={cell} />
                <td className={cell} />
                <td className={right}>{qtyTotal.toFixed(3)}</td>
                <td className={cell} />
                {hasDiscount && <td className={cell} />}
                <td className={cell} />
                <td className={right}>{amount(taxTotal)}</td>
                <td className={cell} />
                <td className={right}>{amount(linesTotal)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="break-inside-avoid">
          <div className="px-1 pt-1">
            <table className="border-collapse text-right text-[11px] tabular-nums">
              <thead>
                <tr className="border-b border-black">
                  <th className="pr-3 text-left whitespace-nowrap">Taxable Value</th>
                  {inter ? (
                    <>
                      <th className="w-16 px-1 text-left">IGST%</th>
                      <th className="w-20 px-1">AMT</th>
                    </>
                  ) : (
                    <>
                      <th className="w-16 px-1 text-left">CGST%</th>
                      <th className="w-20 px-1">AMT</th>
                      <th className="w-16 px-1 text-left">SGST%</th>
                      <th className="w-20 px-1">AMT</th>
                    </>
                  )}
                  <th className="w-16 px-1 text-left">CESS%</th>
                  <th className="w-16 px-1">AMT</th>
                </tr>
              </thead>
              <tbody>
                {summary.map((s) => (
                  <tr key={s.gstRate}>
                    <td className="pr-3">{amount(s.taxable)}</td>
                    {inter ? (
                      <>
                        <td className="px-1">{amount(s.gstRate)}</td>
                        <td className="px-1">{amount(s.igst)}</td>
                      </>
                    ) : (
                      <>
                        <td className="px-1">{amount(s.gstRate / 2)}</td>
                        <td className="px-1">{amount(s.cgst)}</td>
                        <td className="px-1">{amount(s.gstRate / 2)}</td>
                        <td className="px-1">{amount(s.sgst)}</td>
                      </>
                    )}
                    <td className="px-1">0.00</td>
                    <td className="px-1">0.00</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="flex justify-end">
              <span>Rounded Off :</span>
              <span className="w-28 text-right tabular-nums">{amount(inv.roundOff)}</span>
            </p>
          </div>

          <div className="flex items-end justify-between gap-4 border-t border-black px-1">
            <p>E. &amp; O.E.</p>
            <p className="flex text-[16px]">
              <span>Net Amount :</span>
              <span className="min-w-28 text-right tabular-nums">{amount(inv.grandTotal)}</span>
            </p>
          </div>

          <p className="border-t border-black px-1 py-0.5">{amountInWords(inv.grandTotal)}</p>

          {(bankLines.length > 0 || terms || inv.notes) && (
            <div className="border-t border-black px-1 py-1 font-normal">
              {bankLines.length > 0 && (
                <>
                  <p>COMPANY&apos;S BANK DETAILS</p>
                  {bankLines.map((l) => (
                    <p key={l} className="whitespace-pre-wrap">
                      {l}
                    </p>
                  ))}
                </>
              )}
              {terms && <p className="whitespace-pre-line">{terms}</p>}
              {inv.notes && <p className="whitespace-pre-line">Note: {inv.notes}</p>}
            </div>
          )}

          <footer className="flex justify-between gap-4 border-t border-black px-1 pt-0.5 pb-1">
            <p>{createdAt && `Time : ${clock.format(createdAt).toUpperCase()}`}</p>
            <div className="flex flex-col items-end gap-12 pr-6 text-right">
              <p>
                For <span className="uppercase">{b.name || "your business"}</span>
              </p>
              <p>Authorised Signatory</p>
            </div>
          </footer>
        </div>
      </div>
    </article>
  );
}

function Detail({ label, value, big = false }: DocumentDetail & { big?: boolean }) {
  const size = big ? "text-[16px] leading-tight" : "";
  return (
    <>
      <dt className={size}>{label}</dt>
      <dd className={size}>:</dd>
      <dd className={`break-words ${size}`}>{value}</dd>
    </>
  );
}
