// One-time fix: the first price-list import saved the spreadsheet prices as
// they were, but those prices include GST. This takes the GST out of every
// purchase price that came from a spreadsheet, so all purchase prices are
// before GST (as bills record them).
//
// Safe by default:
//   - Preview unless --apply is given.
//   - Before changing anything, the old prices are written to a CSV in the
//     backups folder (readable only by you).
//   - Fixed rows are marked in their source, so running it again changes nothing.
//
// Usage:
//   pnpm tsx --env-file=.env.local scripts/remove-gst-from-imported-prices.ts            # preview
//   pnpm tsx --env-file=.env.local scripts/remove-gst-from-imported-prices.ts --apply    # write

import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

import { Pool } from "@neondatabase/serverless";
import { and, eq, inArray, like, notLike } from "drizzle-orm";
import { drizzle } from "drizzle-orm/neon-serverless";

import * as schema from "../src/db/schema";
import { readBusiness } from "../src/lib/settings/business";
import { withoutGst } from "../src/lib/pricing";

const { products, purchasePrices, settings } = schema;
const MARK = " · GST removed";

async function main() {
  const { values } = parseArgs({ options: { apply: { type: "boolean", default: false } } });
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set.");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle({ client: pool, schema });
  try {
    const [row] = await db.select({ value: settings.value }).from(settings).where(eq(settings.key, "business"));
    const defaultRate = readBusiness(row?.value).defaultGstRate;

    const rows = await db
      .select({
        id: purchasePrices.id,
        partNo: products.partNo,
        price: purchasePrices.price,
        source: purchasePrices.source,
        gstRate: products.gstRate,
      })
      .from(purchasePrices)
      .innerJoin(products, eq(products.id, purchasePrices.productId))
      .where(and(like(purchasePrices.source, "excel:%"), notLike(purchasePrices.source, `%${MARK}`)));

    const changes = rows.map((r) => {
      const rate = r.gstRate ?? defaultRate;
      return { ...r, rate, newPrice: withoutGst(r.price, rate) };
    });

    console.log(values.apply ? "Applying…" : "Preview only (nothing saved). Add --apply to save.");
    console.log(`  Prices to fix: ${changes.length}`);
    for (const c of changes.slice(0, 5)) {
      console.log(`  ${c.partNo}: ${c.price} → ${c.newPrice} (${c.rate}% GST taken out)`);
    }
    if (!values.apply || changes.length === 0) return;

    const dir = process.env.BACKUP_DIR || join(homedir(), "Documents", "ASM Books backups");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `prices-before-gst-fix-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.csv`);
    writeFileSync(
      file,
      ["purchase_price_id,part_no,old_price,new_price,gst_rate", ...changes.map((c) => `${c.id},"${c.partNo.replace(/"/g, '""')}",${c.price},${c.newPrice},${c.rate}`)].join("\n"),
      { mode: 0o600 },
    );
    chmodSync(file, 0o600);
    console.log(`  Old prices saved to ${file}`);

    await db.transaction(async (tx) => {
      for (const c of changes) {
        await tx
          .update(purchasePrices)
          .set({ price: c.newPrice, source: `${c.source}${MARK}` })
          .where(and(eq(purchasePrices.id, c.id), inArray(purchasePrices.source, [c.source!])));
      }
    });
    console.log(`✓ Fixed ${changes.length} prices.`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  const message = String(err?.message ?? err).replace(/postgres(ql)?:\/\/\S+/gi, "[redacted]");
  console.error(`✖ Failed, nothing was changed: ${message}`);
  process.exit(1);
});
