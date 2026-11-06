import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Shared column helpers
// ---------------------------------------------------------------------------

/** Money in rupees, 2 decimal places. */
const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: "number" });

/** Percentage such as markup, discount or GST rate. */
const percent = (name: string) => numeric(name, { precision: 6, scale: 2, mode: "number" });

/** Quantity; allows fractions for items sold by length or weight. */
const quantity = (name: string) => numeric(name, { precision: 14, scale: 3, mode: "number" });

const id = () => integer("id").primaryKey().generatedAlwaysAsIdentity();

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const brands = pgTable("brands", {
  id: id(),
  name: text("name").notNull().unique(),
  ...timestamps,
});

/** Two-level tree: a main group (parent_id null) and its categories. */
export const categories = pgTable(
  "categories",
  {
    id: id(),
    name: text("name").notNull(),
    parentId: integer("parent_id"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.parentId], foreignColumns: [t.id] }).onDelete("restrict"),
    unique("categories_name_parent_unique").on(t.name, t.parentId).nullsNotDistinct(),
  ],
);

export const products = pgTable(
  "products",
  {
    id: id(),
    partNo: text("part_no").notNull().unique(),
    description: text("description").notNull(),
    hsn: text("hsn"),
    brandId: integer("brand_id").references(() => brands.id, { onDelete: "restrict" }),
    categoryId: integer("category_id").references(() => categories.id, { onDelete: "restrict" }),
    unit: text("unit").notNull().default("Nos"),
    /** Null means "use the default GST rate from settings". */
    gstRate: percent("gst_rate"),
    listPrice: money("list_price"),
    photo: text("photo"),
    /** Cached running total of stock_movements; updated in the same transaction. */
    stockQty: quantity("stock_qty").notNull().default(0),
    minStock: quantity("min_stock"),
    active: boolean("active").notNull().default(true),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [
    index("products_category_idx").on(t.categoryId),
    check("products_gst_rate_check", sql`${t.gstRate} IS NULL OR ${t.gstRate} BETWEEN 0 AND 100`),
    check("products_list_price_check", sql`${t.listPrice} IS NULL OR ${t.listPrice} >= 0`),
  ],
);

/** Every purchase price ever recorded. The newest row is the current price. */
export const purchasePrices = pgTable(
  "purchase_prices",
  {
    id: id(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    price: money("price").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    supplier: text("supplier"),
    billRef: text("bill_ref"),
    /** Where the price came from, e.g. "excel:New Price List.xlsx" or "purchase:42". */
    source: text("source"),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("purchase_prices_product_date_idx").on(t.productId, t.date.desc(), t.id.desc()),
    check("purchase_prices_price_check", sql`${t.price} >= 0`),
  ],
);

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

/** Key/value store for business details, invoice layout and one-off flags. */
export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedAt: timestamps.updatedAt,
});

// ---------------------------------------------------------------------------
// Price lists
// ---------------------------------------------------------------------------

export const priceBase = pgEnum("price_base", ["purchase", "previous_purchase", "list", "manual"]);
export const adjustType = pgEnum("adjust_type", ["markup", "markdown"]);

/** Folders for organising price lists; can be nested. */
export const priceListFolders = pgTable(
  "price_list_folders",
  {
    id: id(),
    name: text("name").notNull(),
    parentId: integer("parent_id"),
    sort: integer("sort").notNull().default(0),
    ...timestamps,
  },
  (t) => [foreignKey({ columns: [t.parentId], foreignColumns: [t.id] }).onDelete("restrict")],
);

/** A pricing rule: base price → markup/markdown % → discount % → rounding. */
export const priceLists = pgTable(
  "price_lists",
  {
    id: id(),
    name: text("name").notNull(),
    folderId: integer("folder_id").references(() => priceListFolders.id, { onDelete: "restrict" }),
    base: priceBase("base").notNull().default("purchase"),
    adjustType: adjustType("adjust_type").notNull().default("markup"),
    adjustPct: percent("adjust_pct").notNull().default(0),
    discountPct: percent("discount_pct").notNull().default(0),
    /** Round the final price to the nearest multiple of this; 0 = no rounding. */
    roundTo: money("round_to").notNull().default(0),
    enabled: boolean("enabled").notNull().default(true),
    notes: text("notes"),
    sort: integer("sort").notNull().default(0),
    /** Soft delete: lists are never removed because invoices refer to them. */
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    check("price_lists_adjust_pct_check", sql`${t.adjustPct} >= 0`),
    check(
      "price_lists_markdown_check",
      sql`${t.adjustType} <> 'markdown' OR ${t.adjustPct} <= 100`,
    ),
    check("price_lists_discount_pct_check", sql`${t.discountPct} BETWEEN 0 AND 100`),
    check("price_lists_round_to_check", sql`${t.roundTo} >= 0`),
  ],
);

/** A fixed price for one product in one price list; overrides the rule. */
export const priceListItems = pgTable(
  "price_list_items",
  {
    priceListId: integer("price_list_id")
      .notNull()
      .references(() => priceLists.id, { onDelete: "cascade" }),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    manualPrice: money("manual_price").notNull(),
    updatedAt: timestamps.updatedAt,
  },
  (t) => [
    primaryKey({ columns: [t.priceListId, t.productId] }),
    check("price_list_items_manual_price_check", sql`${t.manualPrice} >= 0`),
  ],
);
