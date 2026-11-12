// Transport and e-way bill details kept on an invoice or delivery challan.
// The e-way bill itself is made on the government portal; the app only keeps
// its number and dates so they print on the document.

import { z } from "zod";

import { formatDate } from "@/lib/format";

export const TRANSPORT_MODES = ["road", "rail", "air", "ship"] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];
export const TRANSPORT_MODE_LABEL: Record<TransportMode, string> = { road: "Road", rail: "Rail", air: "Air", ship: "Ship" };

/** A consignment worth this much or more normally needs an e-way bill. */
export const EWAY_BILL_LIMIT = 50_000;

export interface Transport {
  transporter?: string;
  /** The transporter's GSTIN or transporter ID. */
  transporterId?: string;
  vehicleNo?: string;
  mode?: TransportMode;
  distanceKm?: number;
  /** 12 digits, given by the e-way bill portal. */
  ewayBillNo?: string;
  ewayBillDate?: string;
  ewayValidUntil?: string;
}

const trimmed = (v: unknown) => (typeof v === "string" ? v.trim() : "");
const compact = (v: unknown) => (typeof v === "string" ? v.replace(/[\s-]+/g, "").toUpperCase() : "");
const optionalDate = (label: string) =>
  z.preprocess(trimmed, z.union([z.literal(""), z.iso.date(`${label} is not a valid date`)]));

const transportSchema = z.object({
  transporter: z.preprocess(trimmed, z.string().max(120, "Transporter name can be at most 120 characters")),
  transporterId: z.preprocess(
    compact,
    z.string().regex(/^([0-9A-Z]{15})?$/, "Transporter ID should be 15 letters and numbers"),
  ),
  vehicleNo: z.preprocess(
    compact,
    z.string().regex(/^([A-Z0-9]{4,12})?$/, "Vehicle number should look like TN37AB1234"),
  ),
  mode: z.preprocess(trimmed, z.union([z.literal(""), z.enum(TRANSPORT_MODES, "Choose how the goods travel")])),
  distanceKm: z.preprocess(
    (v) => (trimmed(v) === "" ? null : Number(trimmed(v))),
    z
      .number({ error: "Distance should be a number of kilometres" })
      .int("Distance should be whole kilometres")
      .min(1, "Distance should be at least 1 km")
      .max(4000, "Distance can be at most 4000 km")
      .nullable(),
  ),
  ewayBillNo: z.preprocess(compact, z.string().regex(/^(\d{12})?$/, "E-way bill number should be 12 digits")),
  ewayBillDate: optionalDate("E-way bill date"),
  ewayValidUntil: optionalDate("Valid until"),
});

/** Checks the transport form. Empty boxes are left out of the saved value. */
export function parseTransport(form: FormData): { value: Transport; error?: never } | { error: string; value?: never } {
  const parsed = transportSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the transport details." };
  const d = parsed.data;
  if (!d.ewayBillNo && (d.ewayBillDate || d.ewayValidUntil)) {
    return { error: "Enter the e-way bill number, or clear its dates." };
  }
  if (d.ewayBillDate && d.ewayValidUntil && d.ewayValidUntil < d.ewayBillDate) {
    return { error: "Valid until cannot be before the e-way bill date." };
  }
  const value: Transport = {};
  if (d.transporter) value.transporter = d.transporter;
  if (d.transporterId) value.transporterId = d.transporterId;
  if (d.vehicleNo) value.vehicleNo = d.vehicleNo;
  if (d.mode) value.mode = d.mode;
  if (d.distanceKm != null) value.distanceKm = d.distanceKm;
  if (d.ewayBillNo) value.ewayBillNo = d.ewayBillNo;
  if (d.ewayBillDate) value.ewayBillDate = d.ewayBillDate;
  if (d.ewayValidUntil) value.ewayValidUntil = d.ewayValidUntil;
  return { value };
}

/** The filled-in transport details as "label, value" rows for the printed document. */
export function transportRows(t: Transport): { label: string; value: string }[] {
  const rows: { label: string; value: string }[] = [];
  if (t.transporter) rows.push({ label: "Transporter", value: t.transporter });
  if (t.vehicleNo) rows.push({ label: "Vehicle No", value: t.vehicleNo });
  if (t.ewayBillNo) rows.push({ label: "E-Way Bill No", value: t.ewayBillNo });
  if (t.ewayValidUntil) rows.push({ label: "EWB Valid Till", value: formatDate(t.ewayValidUntil) });
  return rows;
}

/** True when a document of this value has no e-way bill number yet but normally needs one. */
export const needsEwayBill = (grandTotal: number, t: Transport) => grandTotal >= EWAY_BILL_LIMIT && !t.ewayBillNo;
