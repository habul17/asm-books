import { formatDate, formatMoney } from "@/lib/format";
import { amountInWords } from "@/lib/invoices/math";
import { PAYMENT_MODE_LABELS } from "@/lib/payments/validation";
import type { BusinessSettings } from "@/lib/settings/business";
import type { ExpenseDetail } from "@/server/expenses";

/** The expense voucher as printed: black on white, also used as the on-screen view. */
export function ExpenseVoucher({ expense: p, business: b }: { expense: ExpenseDetail; business: BusinessSettings }) {
  return (
    <article className="relative mx-auto w-full max-w-[210mm] bg-white p-6 text-[13px] leading-snug text-black shadow-sm ring-1 ring-black/10 sm:p-10 print:max-w-none print:p-0 print:shadow-none print:ring-0">
      {p.status === "cancelled" && (
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
          {b.gstin && <p className="font-medium">GSTIN: {b.gstin}</p>}
          {(b.phone || b.email) && <p>{[b.phone, b.email].filter(Boolean).join(" · ")}</p>}
        </div>
        <div className="text-right">
          <p className="text-lg font-semibold tracking-wide uppercase">Expense Voucher</p>
          <p className="font-mono text-sm">{p.number}</p>
          <p>Date: {formatDate(p.date)}</p>
        </div>
      </header>

      <section className="flex flex-col gap-1 border-b border-black/20 py-4">
        <p className="text-xs font-semibold text-black/60 uppercase">Expense</p>
        <p className="font-semibold">{p.category}</p>
        {p.paidTo && <p>Paid to: {p.paidTo}</p>}
        {p.vendorGstin && <p>Supplier GSTIN: {p.vendorGstin}</p>}
      </section>

      <section className="grid gap-4 py-4 sm:grid-cols-[1fr_auto]">
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
          <dt className="text-black/60">Paid by</dt>
          <dd>{PAYMENT_MODE_LABELS[p.mode]}</dd>
          {p.reference && (
            <>
              <dt className="text-black/60">Reference</dt>
              <dd className="break-all">{p.reference}</dd>
            </>
          )}
          {p.notes && (
            <>
              <dt className="text-black/60">Notes</dt>
              <dd className="whitespace-pre-line">{p.notes}</dd>
            </>
          )}
        </dl>
        <div className="rounded-lg border border-black/20 px-5 py-3 text-right">
          <p className="text-xs text-black/60 uppercase">Amount paid</p>
          <p className="text-2xl font-bold tabular-nums">{formatMoney(p.amount)}</p>
          {p.gstRate > 0 && (
            <dl className="mt-2 grid grid-cols-[1fr_auto] gap-x-3 text-xs text-black/70">
              <dt>Before GST</dt>
              <dd className="tabular-nums">{formatMoney(Math.round((p.amount - p.cgst - p.sgst - p.igst) * 100) / 100)}</dd>
              {p.igst > 0 ? (
                <>
                  <dt>IGST {p.gstRate}%</dt>
                  <dd className="tabular-nums">{formatMoney(p.igst)}</dd>
                </>
              ) : (
                <>
                  <dt>CGST {p.gstRate / 2}%</dt>
                  <dd className="tabular-nums">{formatMoney(p.cgst)}</dd>
                  <dt>SGST {p.gstRate / 2}%</dt>
                  <dd className="tabular-nums">{formatMoney(p.sgst)}</dd>
                </>
              )}
            </dl>
          )}
        </div>
      </section>

      <p className="border-t border-black/20 pt-3 italic">{amountInWords(p.amount, { paise: true })}</p>

      <footer className="mt-12 flex justify-end">
        <p className="border-t border-black/40 pt-1 text-xs">For {b.name || "the business"} · Authorised signatory</p>
      </footer>
    </article>
  );
}
