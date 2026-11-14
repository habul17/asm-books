"use client";

import { saveTransport } from "@/app/(app)/sales/actions";
import { Field, SaveRow, useSaveForm } from "@/components/forms/save-form";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { EWAY_BILL_LIMIT, TRANSPORT_MODES, TRANSPORT_MODE_LABEL, type Transport } from "@/lib/transport";

/**
 * Transporter and e-way bill details of an invoice or a delivery challan.
 * The e-way bill is made on the government portal; its number is typed here.
 */
export function TransportForm({
  target,
  id,
  transport: t,
  needsEwayBill,
}: {
  target: "invoice" | "challan";
  id: number;
  transport: Transport;
  /** Large enough to normally need an e-way bill, and none is entered yet. */
  needsEwayBill: boolean;
}) {
  const { state, pending, onSubmit, onChange, dirty } = useSaveForm(saveTransport.bind(null, target, id));
  const filled = Object.keys(t).length > 0;
  return (
    <details className="rounded-lg border px-4 py-3 text-sm print:hidden" open={needsEwayBill || undefined}>
      <summary className="cursor-pointer font-medium">
        Transport and e-way bill
        {t.ewayBillNo ? (
          <span className="ml-2 font-normal text-muted-foreground">EWB {t.ewayBillNo}</span>
        ) : needsEwayBill ? (
          <span className="ml-2 font-normal text-amber-700 dark:text-amber-400">
            ₹{EWAY_BILL_LIMIT.toLocaleString("en-IN")} or more: an e-way bill is normally needed
          </span>
        ) : filled ? (
          <span className="ml-2 font-normal text-muted-foreground">filled in</span>
        ) : null}
      </summary>
      <form onSubmit={onSubmit} onChange={onChange} className="mt-3 flex flex-col gap-4">
        <p className="text-muted-foreground">
          Make the e-way bill on the government e-way bill website, then type its number here. It prints on the{" "}
          {target === "invoice" ? "invoice" : "challan"}.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <Field label="Transporter" htmlFor="tr-name" className="md:col-span-2">
            <Input id="tr-name" name="transporter" defaultValue={t.transporter ?? ""} maxLength={120} />
          </Field>
          <Field label="Transporter ID / GSTIN" htmlFor="tr-id" className="md:col-span-2">
            <Input
              id="tr-id"
              name="transporterId"
              defaultValue={t.transporterId ?? ""}
              maxLength={20}
              autoCapitalize="characters"
              className="uppercase"
            />
          </Field>
          <Field label="Vehicle number" htmlFor="tr-vehicle">
            <Input
              id="tr-vehicle"
              name="vehicleNo"
              defaultValue={t.vehicleNo ?? ""}
              maxLength={15}
              placeholder="TN37AB1234"
              autoCapitalize="characters"
              className="uppercase"
            />
          </Field>
          <Field label="Sent by" htmlFor="tr-mode">
            <NativeSelect id="tr-mode" name="mode" className="w-full" defaultValue={t.mode ?? ""}>
              <NativeSelectOption value="">Not set</NativeSelectOption>
              {TRANSPORT_MODES.map((m) => (
                <NativeSelectOption key={m} value={m}>
                  {TRANSPORT_MODE_LABEL[m]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field label="Distance (km)" htmlFor="tr-km">
            <Input id="tr-km" name="distanceKm" inputMode="numeric" defaultValue={t.distanceKm ?? ""} maxLength={4} />
          </Field>
          <Field label="E-way bill number" htmlFor="tr-ewb" hint="The 12-digit number from the e-way bill website.">
            <Input id="tr-ewb" name="ewayBillNo" inputMode="numeric" defaultValue={t.ewayBillNo ?? ""} maxLength={14} />
          </Field>
          <Field label="E-way bill date" htmlFor="tr-ewb-date">
            <Input id="tr-ewb-date" name="ewayBillDate" type="date" defaultValue={t.ewayBillDate ?? ""} />
          </Field>
          <Field label="Valid until" htmlFor="tr-ewb-until">
            <Input id="tr-ewb-until" name="ewayValidUntil" type="date" defaultValue={t.ewayValidUntil ?? ""} />
          </Field>
        </div>
        <SaveRow state={state} pending={pending} dirty={dirty} label="Save transport details" />
      </form>
    </details>
  );
}
