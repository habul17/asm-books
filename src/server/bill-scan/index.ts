import "server-only";

import { and, eq, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { bills, products, vendors } from "@/db/schema";
import { reviewScan, scannedBillSchema, type ScanReview } from "@/lib/bills/scan";
import { todayInIndia } from "@/server/invoice-writes";
import { purchasePriceAt } from "@/server/product-search";
import { loadBusiness } from "@/server/settings";
import { pickVendorById, type PickedVendor } from "@/server/vendors";

import { geminiReader } from "./gemini";
import { BillScanError, type BillFile, type BillReader } from "./reader";

export { BillScanError, type BillFile } from "./reader";

/** The reader set up for this deployment, or null when scanning is not set up. */
function configuredReader(): BillReader | null {
  const key = process.env.GEMINI_API_KEY;
  return key ? geminiReader(key, process.env.BILL_SCAN_MODEL || undefined) : null;
}

export const billScanReady = () => configuredReader() != null;

/** The saved vendor a bill came from: matched on GSTIN first, then on the exact name. */
async function findVendor(gstin: string | null, name: string | null): Promise<PickedVendor | null> {
  const db = getDb();
  const byGstin = gstin?.replace(/\s/g, "").toUpperCase();
  if (byGstin) {
    const rows = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(and(eq(vendors.active, true), eq(sql`upper(${vendors.gstin})`, byGstin)))
      .limit(2);
    if (rows.length === 1) return pickVendorById(rows[0].id);
  }
  if (name) {
    const rows = await db
      .select({ id: vendors.id })
      .from(vendors)
      .where(and(eq(vendors.active, true), eq(sql`lower(${vendors.name})`, name.toLowerCase())))
      .limit(2);
    if (rows.length === 1) return pickVendorById(rows[0].id);
  }
  return null;
}

export interface BillScanResult extends ScanReview {
  vendor: PickedVendor | null;
}

/**
 * Reads a bill and prepares a draft for the bill editor. Nothing is saved:
 * the user reviews the draft, fixes what is flagged and saves it as usual.
 * The caller must have checked the user.
 */
export async function scanBill(file: BillFile, reader: BillReader | null = configuredReader()): Promise<BillScanResult> {
  if (!reader) throw new BillScanError("Bill scanning is not set up yet. Enter the bill by hand.");
  const parsed = scannedBillSchema.safeParse(await reader.read(file));
  if (!parsed.success) throw new BillScanError("The bill could not be read. Try a clearer photo.");
  const scan = parsed.data;

  const db = getDb();
  const [business, parts, vendor] = await Promise.all([
    loadBusiness(db),
    db
      .select({
        id: products.id,
        partNo: products.partNo,
        description: products.description,
        unit: products.unit,
        gstRate: products.gstRate,
        lastPrice: purchasePriceAt(0),
      })
      .from(products)
      .where(eq(products.active, true)),
    findVendor(scan.supplierGstin, scan.supplierName),
  ]);

  const review = reviewScan(scan, {
    parts,
    defaultGstRate: business.defaultGstRate,
    today: todayInIndia(),
    vendorFound: vendor != null,
  });

  if (vendor && review.billNo) {
    const [entered] = await db
      .select({ id: bills.id })
      .from(bills)
      .where(
        and(
          eq(bills.vendorId, vendor.id),
          eq(sql`lower(${bills.billNo})`, review.billNo.toLowerCase()),
          eq(bills.status, "final"),
        ),
      )
      .limit(1);
    if (entered) review.warnings.unshift(`Bill ${review.billNo} from ${vendor.name} is already entered. Do not save it again.`);
  }
  return { ...review, vendor };
}
