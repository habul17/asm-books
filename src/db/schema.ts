import { sql } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  check,
  customType,
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
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type { Transport } from "../lib/transport";

// ---------------------------------------------------------------------------
// Shared column helpers
// ---------------------------------------------------------------------------

/** Money in rupees, 2 decimal places. */
const money = (name: string) => numeric(name, { precision: 12, scale: 2, mode: "number" });

/** Percentage such as markup, discount or GST rate. */
const percent = (name: string) => numeric(name, { precision: 6, scale: 2, mode: "number" });

/**
 * Purchase cost, stored exactly as received. Supplier sheets often carry
 * 7+ decimals (e.g. 21.7442199); rounding them would lose information.
 */
const cost = (name: string) => numeric(name, { precision: 20, scale: 10, mode: "number" });

/** Raw file bytes. Read and written through encode/decode in SQL, never selected by default. */
const bytea = customType<{ data: Buffer }>({ dataType: () => "bytea" });

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
    price: cost("price").notNull(),
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

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------

/** Groups such as "Garages" or "Retail". A group can have a default price list. */
export const customerGroups = pgTable(
  "customer_groups",
  {
    id: id(),
    name: text("name").notNull(),
    priceListId: integer("price_list_id").references(() => priceLists.id, { onDelete: "restrict" }),
    ...timestamps,
  },
  (t) => [uniqueIndex("customer_groups_name_unique").on(sql`lower(${t.name})`)],
);

export const customers = pgTable(
  "customers",
  {
    id: id(),
    name: text("name").notNull(),
    contactPerson: text("contact_person"),
    /** Digits only, optionally with a leading +. */
    mobile: text("mobile"),
    email: text("email"),
    address: text("address"),
    city: text("city"),
    /** Two-digit GST state code, e.g. "33" for Tamil Nadu. */
    stateCode: text("state_code"),
    pincode: text("pincode"),
    gstin: text("gstin"),
    groupId: integer("group_id").references(() => customerGroups.id, { onDelete: "restrict" }),
    /** Overrides the group's price list when set. */
    priceListId: integer("price_list_id").references(() => priceLists.id, { onDelete: "restrict" }),
    /** Positive: the customer owes us. Negative: we owe the customer. */
    openingBalance: money("opening_balance").notNull().default(0),
    creditLimit: money("credit_limit"),
    paymentTermsDays: integer("payment_terms_days"),
    notes: text("notes"),
    /** Custom field values keyed by custom_fields.id. */
    extra: jsonb("extra").$type<Record<string, string | number>>().notNull().default({}),
    /** Customers are never deleted (history must stay); they are switched off instead. */
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("customers_name_idx").on(sql`lower(${t.name})`),
    index("customers_group_idx").on(t.groupId),
    check("customers_state_code_check", sql`${t.stateCode} IS NULL OR ${t.stateCode} ~ '^[0-9]{2}$'`),
    check("customers_credit_limit_check", sql`${t.creditLimit} IS NULL OR ${t.creditLimit} >= 0`),
    check("customers_payment_terms_check", sql`${t.paymentTermsDays} IS NULL OR ${t.paymentTermsDays} >= 0`),
  ],
);

export const customFieldType = pgEnum("custom_field_type", ["text", "number", "date"]);

/** Extra fields the business adds to its records. `entity` says which kind of record. */
export const customFields = pgTable(
  "custom_fields",
  {
    id: id(),
    entity: text("entity").notNull(),
    label: text("label").notNull(),
    type: customFieldType("type").notNull().default("text"),
    sort: integer("sort").notNull().default(0),
    /** Switched-off fields are hidden but their saved values are kept. */
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [check("custom_fields_entity_check", sql`${t.entity} IN ('customer', 'invoice')`)],
);

// ---------------------------------------------------------------------------
// Users and sessions
// ---------------------------------------------------------------------------

export const userRole = pgEnum("user_role", ["owner", "staff"]);

export const users = pgTable(
  "users",
  {
    id: id(),
    /** Sign-in name; unique regardless of case. */
    username: text("username").notNull(),
    name: text("name").notNull(),
    /** scrypt hash with its parameters and salt; never the password itself. */
    passwordHash: text("password_hash").notNull(),
    role: userRole("role").notNull().default("staff"),
    /** Switched-off users cannot sign in; their history stays. */
    active: boolean("active").notNull().default(true),
    /** Wrong passwords in a row; reset on success or when the lock is applied. */
    failedLogins: integer("failed_logins").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    ...timestamps,
  },
  (t) => [
    uniqueIndex("users_username_unique").on(sql`lower(${t.username})`),
    check("users_failed_logins_check", sql`${t.failedLogins} >= 0`),
  ],
);

export const sessions = pgTable(
  "sessions",
  {
    /** SHA-256 of the cookie token, so a database leak cannot be replayed as a cookie. */
    id: text("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

// ---------------------------------------------------------------------------
// Sales invoices and stock
// ---------------------------------------------------------------------------

export const taxType = pgEnum("tax_type", ["intra", "inter"]);
export const paymentType = pgEnum("payment_type", ["credit", "cash"]);
export const invoiceStatus = pgEnum("invoice_status", ["final", "cancelled"]);
/** How money changed hands. Cash is the drawer; every other mode lands in the bank. */
export const paymentMode = pgEnum("payment_mode", ["cash", "upi", "bank", "cheque", "card"]);

/**
 * Sales invoices. Customer details are copied in, so an old invoice never
 * changes when the customer is edited later. Invoices are never deleted;
 * they are cancelled instead, which keeps the numbering without gaps.
 */
export const invoices = pgTable(
  "invoices",
  {
    id: id(),
    /** e.g. INV/26-27/0001 */
    number: text("number").notNull().unique(),
    /** Indian financial year, e.g. "26-27". Numbering restarts each April. */
    fy: text("fy").notNull(),
    seq: integer("seq").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "restrict" }),
    customerName: text("customer_name").notNull(),
    customerGstin: text("customer_gstin"),
    customerMobile: text("customer_mobile"),
    billingAddress: text("billing_address"),
    /** State code of the buyer; with the seller's state it decides the tax type. */
    placeOfSupply: text("place_of_supply"),
    taxType: taxType("tax_type").notNull(),
    priceListId: integer("price_list_id").references(() => priceLists.id, { onDelete: "restrict" }),
    paymentType: paymentType("payment_type").notNull().default("credit"),
    /**
     * How a cash invoice was paid. Null on credit invoices, and on cash
     * invoices saved before this was recorded; those count as cash.
     */
    cashMode: paymentMode("cash_mode"),
    taxableTotal: money("taxable_total").notNull(),
    cgstTotal: money("cgst_total").notNull(),
    sgstTotal: money("sgst_total").notNull(),
    igstTotal: money("igst_total").notNull(),
    roundOff: money("round_off").notNull(),
    grandTotal: money("grand_total").notNull(),
    notes: text("notes"),
    /** Custom field values keyed by custom_fields.id. */
    extra: jsonb("extra").$type<Record<string, string | number>>().notNull().default({}),
    /** Transporter, vehicle and e-way bill details. */
    transport: jsonb("transport").$type<Transport>().notNull().default({}),
    status: invoiceStatus("status").notNull().default("final"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    unique("invoices_fy_seq_unique").on(t.fy, t.seq),
    index("invoices_date_idx").on(t.date.desc(), t.id.desc()),
    index("invoices_customer_idx").on(t.customerId),
    check("invoices_grand_total_check", sql`${t.grandTotal} >= 0`),
    check("invoices_walk_in_cash_check", sql`${t.customerId} IS NOT NULL OR ${t.paymentType} = 'cash'`),
    check("invoices_cash_mode_check", sql`${t.cashMode} IS NULL OR ${t.paymentType} = 'cash'`),
  ],
);

export const invoiceLines = pgTable(
  "invoice_lines",
  {
    id: id(),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    productId: integer("product_id").references(() => products.id, { onDelete: "restrict" }),
    partNo: text("part_no"),
    description: text("description").notNull(),
    hsn: text("hsn"),
    unit: text("unit").notNull().default("Nos"),
    qty: quantity("qty").notNull(),
    rate: money("rate").notNull(),
    discountPct: percent("discount_pct").notNull().default(0),
    gstRate: percent("gst_rate").notNull(),
    taxable: money("taxable").notNull(),
    cgst: money("cgst").notNull(),
    sgst: money("sgst").notNull(),
    igst: money("igst").notNull(),
    total: money("total").notNull(),
    /** Purchase price at the time of sale, for profit reports. */
    cost: cost("cost"),
  },
  (t) => [
    unique("invoice_lines_invoice_line_unique").on(t.invoiceId, t.lineNo),
    index("invoice_lines_product_idx").on(t.productId),
    check("invoice_lines_qty_check", sql`${t.qty} > 0`),
    check("invoice_lines_rate_check", sql`${t.rate} >= 0`),
    check("invoice_lines_discount_check", sql`${t.discountPct} BETWEEN 0 AND 100`),
    check("invoice_lines_gst_check", sql`${t.gstRate} BETWEEN 0 AND 100`),
  ],
);

export const stockMovementKind = pgEnum("stock_movement_kind", [
  "opening",
  "adjust",
  "sale",
  "sale_edit",
  "sale_cancel",
  "purchase",
  "sale_return",
  "sale_return_cancel",
  "purchase_edit",
  "purchase_cancel",
  "adjust_cancel",
  "adjust_edit",
  "purchase_return",
  "purchase_return_cancel",
]);

/** Every stock change, so stock can always be explained. products.stock_qty is their running total. */
export const stockMovements = pgTable(
  "stock_movements",
  {
    id: id(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    /** Positive: stock in. Negative: stock out. */
    qty: quantity("qty").notNull(),
    kind: stockMovementKind("kind").notNull(),
    invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "restrict" }),
    creditNoteId: integer("credit_note_id").references((): AnyPgColumn => creditNotes.id, { onDelete: "restrict" }),
    billId: integer("bill_id").references((): AnyPgColumn => bills.id, { onDelete: "restrict" }),
    adjustmentId: integer("adjustment_id").references((): AnyPgColumn => stockAdjustments.id, { onDelete: "restrict" }),
    purchaseReturnId: integer("purchase_return_id").references((): AnyPgColumn => purchaseReturns.id, {
      onDelete: "restrict",
    }),
    date: date("date", { mode: "string" }).notNull(),
    note: text("note"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamps.createdAt,
  },
  (t) => [
    index("stock_movements_product_idx").on(t.productId, t.date),
    index("stock_movements_invoice_idx").on(t.invoiceId),
    index("stock_movements_credit_note_idx").on(t.creditNoteId),
    index("stock_movements_bill_idx").on(t.billId),
    index("stock_movements_adjustment_idx").on(t.adjustmentId),
    index("stock_movements_purchase_return_idx").on(t.purchaseReturnId),
    check("stock_movements_qty_check", sql`${t.qty} <> 0`),
  ],
);

// ---------------------------------------------------------------------------
// Payments received
// ---------------------------------------------------------------------------

/**
 * Money received from a customer. It lowers what they owe as a whole
 * (a running account), not one particular invoice. Never deleted; a wrong
 * entry is cancelled, which keeps the receipt numbering without gaps.
 */
export const payments = pgTable(
  "payments",
  {
    id: id(),
    /** e.g. RCPT/26-27/0001 */
    number: text("number").notNull().unique(),
    fy: text("fy").notNull(),
    seq: integer("seq").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    amount: money("amount").notNull(),
    mode: paymentMode("mode").notNull(),
    /** UPI reference, cheque number and so on. */
    reference: text("reference"),
    notes: text("notes"),
    status: invoiceStatus("status").notNull().default("final"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    unique("payments_fy_seq_unique").on(t.fy, t.seq),
    index("payments_date_idx").on(t.date.desc(), t.id.desc()),
    index("payments_customer_idx").on(t.customerId),
    check("payments_amount_check", sql`${t.amount} > 0`),
  ],
);

// ---------------------------------------------------------------------------
// Credit notes (sales returns)
// ---------------------------------------------------------------------------

/**
 * Goods a customer returns from one invoice. Rates and tax are copied from
 * that invoice, so the credit note always mirrors what was billed. Never
 * deleted or edited; a wrong one is cancelled and made again.
 */
export const creditNotes = pgTable(
  "credit_notes",
  {
    id: id(),
    /** e.g. CN/26-27/0001 */
    number: text("number").notNull().unique(),
    fy: text("fy").notNull(),
    seq: integer("seq").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "restrict" }),
    customerName: text("customer_name").notNull(),
    customerGstin: text("customer_gstin"),
    customerMobile: text("customer_mobile"),
    billingAddress: text("billing_address"),
    placeOfSupply: text("place_of_supply"),
    taxType: taxType("tax_type").notNull(),
    /** credit: taken off what the customer owes. cash: the money was handed back. */
    refundType: paymentType("refund_type").notNull(),
    /** Whether the returned goods went back on the shelf (not for damaged parts). */
    restocked: boolean("restocked").notNull().default(true),
    reason: text("reason").notNull(),
    taxableTotal: money("taxable_total").notNull(),
    cgstTotal: money("cgst_total").notNull(),
    sgstTotal: money("sgst_total").notNull(),
    igstTotal: money("igst_total").notNull(),
    roundOff: money("round_off").notNull(),
    grandTotal: money("grand_total").notNull(),
    notes: text("notes"),
    status: invoiceStatus("status").notNull().default("final"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    unique("credit_notes_fy_seq_unique").on(t.fy, t.seq),
    index("credit_notes_date_idx").on(t.date.desc(), t.id.desc()),
    index("credit_notes_invoice_idx").on(t.invoiceId),
    index("credit_notes_customer_idx").on(t.customerId),
    check("credit_notes_grand_total_check", sql`${t.grandTotal} >= 0`),
    check("credit_notes_walk_in_cash_check", sql`${t.customerId} IS NOT NULL OR ${t.refundType} = 'cash'`),
  ],
);

export const creditNoteLines = pgTable(
  "credit_note_lines",
  {
    id: id(),
    creditNoteId: integer("credit_note_id")
      .notNull()
      .references(() => creditNotes.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    /** The invoice line returned. Set to null only if that line is later removed by editing the invoice. */
    invoiceLineId: integer("invoice_line_id").references(() => invoiceLines.id, { onDelete: "set null" }),
    productId: integer("product_id").references(() => products.id, { onDelete: "restrict" }),
    partNo: text("part_no"),
    description: text("description").notNull(),
    hsn: text("hsn"),
    unit: text("unit").notNull().default("Nos"),
    qty: quantity("qty").notNull(),
    rate: money("rate").notNull(),
    discountPct: percent("discount_pct").notNull().default(0),
    gstRate: percent("gst_rate").notNull(),
    taxable: money("taxable").notNull(),
    cgst: money("cgst").notNull(),
    sgst: money("sgst").notNull(),
    igst: money("igst").notNull(),
    total: money("total").notNull(),
    cost: cost("cost"),
  },
  (t) => [
    unique("credit_note_lines_note_line_unique").on(t.creditNoteId, t.lineNo),
    index("credit_note_lines_invoice_line_idx").on(t.invoiceLineId),
    check("credit_note_lines_qty_check", sql`${t.qty} > 0`),
  ],
);

// ---------------------------------------------------------------------------
// Vendors and purchase bills
// ---------------------------------------------------------------------------

/** Suppliers we buy parts from. Never deleted (history must stay); switched off instead. */
export const vendors = pgTable(
  "vendors",
  {
    id: id(),
    name: text("name").notNull(),
    contactPerson: text("contact_person"),
    mobile: text("mobile"),
    email: text("email"),
    address: text("address"),
    city: text("city"),
    stateCode: text("state_code"),
    pincode: text("pincode"),
    gstin: text("gstin"),
    /** Positive: we owe the vendor. Negative: the vendor owes us (advance paid). */
    openingBalance: money("opening_balance").notNull().default(0),
    paymentTermsDays: integer("payment_terms_days"),
    notes: text("notes"),
    active: boolean("active").notNull().default(true),
    ...timestamps,
  },
  (t) => [
    index("vendors_name_idx").on(sql`lower(${t.name})`),
    check("vendors_state_code_check", sql`${t.stateCode} IS NULL OR ${t.stateCode} ~ '^[0-9]{2}$'`),
    check("vendors_payment_terms_check", sql`${t.paymentTermsDays} IS NULL OR ${t.paymentTermsDays} >= 0`),
  ],
);

export const purchaseOrderStatus = pgEnum("purchase_order_status", ["open", "closed", "cancelled"]);

/**
 * An order we send to a vendor for parts we want. It never moves stock or
 * money; the bill entered when the parts arrive does.
 */
export const purchaseOrders = pgTable(
  "purchase_orders",
  {
    id: id(),
    /** e.g. PO/26-27/0001 */
    number: text("number").notNull().unique(),
    fy: text("fy").notNull(),
    seq: integer("seq").notNull(),
    vendorId: integer("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    date: date("date", { mode: "string" }).notNull(),
    /** When we want the parts to arrive. */
    expectedDate: date("expected_date", { mode: "string" }),
    taxType: taxType("tax_type").notNull(),
    taxableTotal: money("taxable_total").notNull(),
    cgstTotal: money("cgst_total").notNull(),
    sgstTotal: money("sgst_total").notNull(),
    igstTotal: money("igst_total").notNull(),
    roundOff: money("round_off").notNull(),
    grandTotal: money("grand_total").notNull(),
    notes: text("notes"),
    status: purchaseOrderStatus("status").notNull().default("open"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    unique("purchase_orders_fy_seq_unique").on(t.fy, t.seq),
    index("purchase_orders_date_idx").on(t.date.desc(), t.id.desc()),
    index("purchase_orders_vendor_idx").on(t.vendorId),
    check("purchase_orders_grand_total_check", sql`${t.grandTotal} >= 0`),
  ],
);

export const purchaseOrderLines = pgTable(
  "purchase_order_lines",
  {
    id: id(),
    orderId: integer("order_id")
      .notNull()
      .references(() => purchaseOrders.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    productId: integer("product_id").references(() => products.id, { onDelete: "restrict" }),
    partNo: text("part_no"),
    description: text("description").notNull(),
    hsn: text("hsn"),
    unit: text("unit").notNull().default("Nos"),
    qty: quantity("qty").notNull(),
    /** The purchase rate we expect to pay, before discount. */
    rate: cost("rate").notNull(),
    discountPct: percent("discount_pct").notNull().default(0),
    gstRate: percent("gst_rate").notNull(),
    taxable: money("taxable").notNull(),
    cgst: money("cgst").notNull(),
    sgst: money("sgst").notNull(),
    igst: money("igst").notNull(),
    total: money("total").notNull(),
  },
  (t) => [
    unique("purchase_order_lines_order_line_unique").on(t.orderId, t.lineNo),
    index("purchase_order_lines_product_idx").on(t.productId),
    check("purchase_order_lines_qty_check", sql`${t.qty} > 0`),
    check("purchase_order_lines_rate_check", sql`${t.rate} >= 0`),
    check("purchase_order_lines_discount_check", sql`${t.discountPct} BETWEEN 0 AND 100`),
    check("purchase_order_lines_gst_check", sql`${t.gstRate} BETWEEN 0 AND 100`),
  ],
);

/**
 * A purchase bill as received from a vendor. It adds the parts to stock and,
 * when asked, records their new purchase prices (which price lists follow).
 * Never deleted; a wrong bill is cancelled, which takes the stock back out.
 */
export const bills = pgTable(
  "bills",
  {
    id: id(),
    vendorId: integer("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    /** The vendor's own bill number, as printed on their bill. */
    billNo: text("bill_no").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    taxType: taxType("tax_type").notNull(),
    taxableTotal: money("taxable_total").notNull(),
    cgstTotal: money("cgst_total").notNull(),
    sgstTotal: money("sgst_total").notNull(),
    igstTotal: money("igst_total").notNull(),
    roundOff: money("round_off").notNull(),
    grandTotal: money("grand_total").notNull(),
    /** Whether this bill's rates became the parts' current purchase prices. */
    updatePrices: boolean("update_prices").notNull().default(true),
    /** The purchase order these parts were ordered on. */
    purchaseOrderId: integer("purchase_order_id").references(() => purchaseOrders.id, { onDelete: "set null" }),
    notes: text("notes"),
    status: invoiceStatus("status").notNull().default("final"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    // The same vendor bill cannot be entered twice (cancelled ones do not count).
    uniqueIndex("bills_vendor_bill_no_unique")
      .on(t.vendorId, sql`lower(${t.billNo})`)
      .where(sql`${t.status} = 'final'`),
    index("bills_date_idx").on(t.date.desc(), t.id.desc()),
    index("bills_vendor_idx").on(t.vendorId),
    index("bills_purchase_order_idx").on(t.purchaseOrderId),
    check("bills_grand_total_check", sql`${t.grandTotal} >= 0`),
  ],
);

export const billLines = pgTable(
  "bill_lines",
  {
    id: id(),
    billId: integer("bill_id")
      .notNull()
      .references(() => bills.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    productId: integer("product_id").references(() => products.id, { onDelete: "restrict" }),
    partNo: text("part_no"),
    description: text("description").notNull(),
    hsn: text("hsn"),
    unit: text("unit").notNull().default("Nos"),
    qty: quantity("qty").notNull(),
    /** Purchase rate before discount, kept exactly as on the vendor's bill. */
    rate: cost("rate").notNull(),
    discountPct: percent("discount_pct").notNull().default(0),
    gstRate: percent("gst_rate").notNull(),
    taxable: money("taxable").notNull(),
    cgst: money("cgst").notNull(),
    sgst: money("sgst").notNull(),
    igst: money("igst").notNull(),
    total: money("total").notNull(),
  },
  (t) => [
    unique("bill_lines_bill_line_unique").on(t.billId, t.lineNo),
    index("bill_lines_product_idx").on(t.productId),
    check("bill_lines_qty_check", sql`${t.qty} > 0`),
    check("bill_lines_rate_check", sql`${t.rate} >= 0`),
    check("bill_lines_discount_check", sql`${t.discountPct} BETWEEN 0 AND 100`),
    check("bill_lines_gst_check", sql`${t.gstRate} BETWEEN 0 AND 100`),
  ],
);

/**
 * Goods sent back to a vendor (debit note). It lowers what we owe them and
 * takes the parts out of stock. Not edited: a wrong one is cancelled.
 */
export const purchaseReturns = pgTable(
  "purchase_returns",
  {
    id: id(),
    /** e.g. DN/26-27/0001 */
    number: text("number").notNull().unique(),
    fy: text("fy").notNull(),
    seq: integer("seq").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    vendorId: integer("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    vendorName: text("vendor_name").notNull(),
    vendorGstin: text("vendor_gstin"),
    /** The vendor's bill the goods came on, if known. */
    billRef: text("bill_ref"),
    taxType: taxType("tax_type").notNull(),
    reason: text("reason").notNull(),
    taxableTotal: money("taxable_total").notNull(),
    cgstTotal: money("cgst_total").notNull(),
    sgstTotal: money("sgst_total").notNull(),
    igstTotal: money("igst_total").notNull(),
    roundOff: money("round_off").notNull(),
    grandTotal: money("grand_total").notNull(),
    notes: text("notes"),
    status: invoiceStatus("status").notNull().default("final"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    unique("purchase_returns_fy_seq_unique").on(t.fy, t.seq),
    index("purchase_returns_date_idx").on(t.date.desc(), t.id.desc()),
    index("purchase_returns_vendor_idx").on(t.vendorId),
    check("purchase_returns_grand_total_check", sql`${t.grandTotal} >= 0`),
  ],
);

export const purchaseReturnLines = pgTable(
  "purchase_return_lines",
  {
    id: id(),
    purchaseReturnId: integer("purchase_return_id")
      .notNull()
      .references(() => purchaseReturns.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    partNo: text("part_no"),
    description: text("description").notNull(),
    hsn: text("hsn"),
    unit: text("unit").notNull().default("Nos"),
    qty: quantity("qty").notNull(),
    /** Rate before GST, as on the vendor's bill. */
    rate: cost("rate").notNull(),
    discountPct: percent("discount_pct").notNull().default(0),
    gstRate: percent("gst_rate").notNull(),
    taxable: money("taxable").notNull(),
    cgst: money("cgst").notNull(),
    sgst: money("sgst").notNull(),
    igst: money("igst").notNull(),
    total: money("total").notNull(),
  },
  (t) => [
    unique("purchase_return_lines_line_unique").on(t.purchaseReturnId, t.lineNo),
    index("purchase_return_lines_product_idx").on(t.productId),
    check("purchase_return_lines_qty_check", sql`${t.qty} > 0`),
    check("purchase_return_lines_rate_check", sql`${t.rate} >= 0`),
    check("purchase_return_lines_discount_check", sql`${t.discountPct} BETWEEN 0 AND 100`),
    check("purchase_return_lines_gst_check", sql`${t.gstRate} BETWEEN 0 AND 100`),
  ],
);

/**
 * Money paid to a vendor. It lowers what we owe them as a whole (a running
 * account), not one particular bill. Never deleted; a wrong entry is
 * cancelled, which keeps the numbering without gaps.
 */
export const vendorPayments = pgTable(
  "vendor_payments",
  {
    id: id(),
    /** e.g. PAY/26-27/0001 */
    number: text("number").notNull().unique(),
    fy: text("fy").notNull(),
    seq: integer("seq").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    vendorId: integer("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "restrict" }),
    amount: money("amount").notNull(),
    mode: paymentMode("mode").notNull(),
    /** UTR, cheque number and so on. */
    reference: text("reference"),
    notes: text("notes"),
    status: invoiceStatus("status").notNull().default("final"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    unique("vendor_payments_fy_seq_unique").on(t.fy, t.seq),
    index("vendor_payments_date_idx").on(t.date.desc(), t.id.desc()),
    index("vendor_payments_vendor_idx").on(t.vendorId),
    check("vendor_payments_amount_check", sql`${t.amount} > 0`),
  ],
);

// ---------------------------------------------------------------------------
// Expenses
// ---------------------------------------------------------------------------

/** Money spent on running the shop (rent, salary, freight…), not on parts for stock. */
export const expenses = pgTable(
  "expenses",
  {
    id: id(),
    /** e.g. EXP/26-27/0001 */
    number: text("number").notNull().unique(),
    fy: text("fy").notNull(),
    seq: integer("seq").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    /** Free text with suggestions, e.g. Rent, Salary, Freight. */
    category: text("category").notNull(),
    /** Who was paid, e.g. landlord, staff member, transporter. */
    paidTo: text("paid_to"),
    /** Set when the expense was paid to a saved vendor; `paidTo` then holds their name. */
    vendorId: integer("vendor_id").references(() => vendors.id, { onDelete: "set null" }),
    /** Total paid, including any GST. */
    amount: money("amount").notNull(),
    /** GST rate included in `amount`; 0 when no GST is claimed. */
    gstRate: percent("gst_rate").notNull().default(0),
    cgst: money("cgst").notNull().default(0),
    sgst: money("sgst").notNull().default(0),
    igst: money("igst").notNull().default(0),
    mode: paymentMode("mode").notNull(),
    reference: text("reference"),
    notes: text("notes"),
    status: invoiceStatus("status").notNull().default("final"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    unique("expenses_fy_seq_unique").on(t.fy, t.seq),
    index("expenses_date_idx").on(t.date.desc(), t.id.desc()),
    index("expenses_category_idx").on(sql`lower(${t.category})`),
    check("expenses_amount_check", sql`${t.amount} > 0`),
    check("expenses_gst_check", sql`${t.cgst} + ${t.sgst} + ${t.igst} <= ${t.amount}`),
    index("expenses_vendor_idx").on(t.vendorId),
  ],
);

// ---------------------------------------------------------------------------
// Inventory adjustments
// ---------------------------------------------------------------------------

/** Stock corrected by hand: damaged, lost, found in a count, opening stock… */
export const stockAdjustments = pgTable(
  "stock_adjustments",
  {
    id: id(),
    /** e.g. ADJ/26-27/0001 */
    number: text("number").notNull().unique(),
    fy: text("fy").notNull(),
    seq: integer("seq").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    reason: text("reason").notNull(),
    notes: text("notes"),
    status: invoiceStatus("status").notNull().default("final"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    unique("stock_adjustments_fy_seq_unique").on(t.fy, t.seq),
    index("stock_adjustments_date_idx").on(t.date.desc(), t.id.desc()),
  ],
);

export const stockAdjustmentLines = pgTable(
  "stock_adjustment_lines",
  {
    id: id(),
    adjustmentId: integer("adjustment_id")
      .notNull()
      .references(() => stockAdjustments.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    productId: integer("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "restrict" }),
    partNo: text("part_no"),
    description: text("description").notNull(),
    unit: text("unit").notNull(),
    /** Stock just before this adjustment was saved. */
    qtyBefore: quantity("qty_before").notNull(),
    /** Positive: added to stock. Negative: taken out. */
    qty: quantity("qty").notNull(),
    /** Latest purchase price at the time, to value the adjustment. */
    cost: cost("cost"),
  },
  (t) => [
    unique("stock_adjustment_lines_line_unique").on(t.adjustmentId, t.lineNo),
    index("stock_adjustment_lines_product_idx").on(t.productId),
    check("stock_adjustment_lines_qty_check", sql`${t.qty} <> 0`),
  ],
);

// ---------------------------------------------------------------------------
// Quotes, sales orders and delivery challans
// ---------------------------------------------------------------------------

export const salesDocKind = pgEnum("sales_doc_kind", ["quote", "order", "challan"]);
export const salesDocStatus = pgEnum("sales_doc_status", ["open", "closed", "cancelled"]);

/**
 * A quote, sales order or delivery challan. These never move stock or money;
 * the invoice made from one does. They share a table because they hold the
 * same things: a customer, priced lines and GST worked out the same way.
 */
export const salesDocs = pgTable(
  "sales_docs",
  {
    id: id(),
    kind: salesDocKind("kind").notNull(),
    /** e.g. QT/26-27/0001 */
    number: text("number").notNull().unique(),
    fy: text("fy").notNull(),
    seq: integer("seq").notNull(),
    date: date("date", { mode: "string" }).notNull(),
    /** Quote: valid until. Order: deliver by. Challan: not used. */
    secondDate: date("second_date", { mode: "string" }),
    customerId: integer("customer_id").references(() => customers.id, { onDelete: "restrict" }),
    customerName: text("customer_name").notNull(),
    customerGstin: text("customer_gstin"),
    customerMobile: text("customer_mobile"),
    billingAddress: text("billing_address"),
    placeOfSupply: text("place_of_supply"),
    taxType: taxType("tax_type").notNull(),
    priceListId: integer("price_list_id").references(() => priceLists.id, { onDelete: "restrict" }),
    taxableTotal: money("taxable_total").notNull(),
    cgstTotal: money("cgst_total").notNull(),
    sgstTotal: money("sgst_total").notNull(),
    igstTotal: money("igst_total").notNull(),
    roundOff: money("round_off").notNull(),
    grandTotal: money("grand_total").notNull(),
    notes: text("notes"),
    /** Challan: why the goods are moving without an invoice. */
    reason: text("reason"),
    /** Transporter, vehicle and e-way bill details. */
    transport: jsonb("transport").$type<Transport>().notNull().default({}),
    status: salesDocStatus("status").notNull().default("open"),
    /** The quote or order this was made from. */
    sourceId: integer("source_id").references((): AnyPgColumn => salesDocs.id, { onDelete: "set null" }),
    /** The invoice this became. */
    invoiceId: integer("invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    unique("sales_docs_kind_fy_seq_unique").on(t.kind, t.fy, t.seq),
    index("sales_docs_kind_date_idx").on(t.kind, t.date.desc(), t.id.desc()),
    index("sales_docs_customer_idx").on(t.customerId),
    index("sales_docs_invoice_idx").on(t.invoiceId),
    check("sales_docs_grand_total_check", sql`${t.grandTotal} >= 0`),
  ],
);

export const salesDocLines = pgTable(
  "sales_doc_lines",
  {
    id: id(),
    docId: integer("doc_id")
      .notNull()
      .references(() => salesDocs.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    productId: integer("product_id").references(() => products.id, { onDelete: "restrict" }),
    partNo: text("part_no"),
    description: text("description").notNull(),
    hsn: text("hsn"),
    unit: text("unit").notNull().default("Nos"),
    qty: quantity("qty").notNull(),
    rate: money("rate").notNull(),
    discountPct: percent("discount_pct").notNull().default(0),
    gstRate: percent("gst_rate").notNull(),
    taxable: money("taxable").notNull(),
    cgst: money("cgst").notNull(),
    sgst: money("sgst").notNull(),
    igst: money("igst").notNull(),
    total: money("total").notNull(),
  },
  (t) => [
    unique("sales_doc_lines_doc_line_unique").on(t.docId, t.lineNo),
    index("sales_doc_lines_product_idx").on(t.productId),
    check("sales_doc_lines_qty_check", sql`${t.qty} > 0`),
    check("sales_doc_lines_rate_check", sql`${t.rate} >= 0`),
    check("sales_doc_lines_discount_check", sql`${t.discountPct} BETWEEN 0 AND 100`),
    check("sales_doc_lines_gst_check", sql`${t.gstRate} BETWEEN 0 AND 100`),
  ],
);

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

/**
 * A scanned paper or PDF kept for the shop: a vendor's bill, a receipt, a bank
 * statement. It can be attached to a bill or an expense. The bytes live in
 * `document_files`, so lists never load them.
 */
export const documents = pgTable(
  "documents",
  {
    id: id(),
    title: text("title").notNull(),
    /** A key of DOCUMENT_FOLDERS. */
    folder: text("folder").notNull().default("other"),
    mimeType: text("mime_type").notNull(),
    /** File size in bytes. */
    size: integer("size").notNull(),
    /** The date on the paper, if the user gave one. */
    docDate: date("doc_date", { mode: "string" }),
    notes: text("notes"),
    /** Hidden from staff, e.g. bank papers and payslips. */
    ownerOnly: boolean("owner_only").notNull().default(false),
    billId: integer("bill_id").references(() => bills.id, { onDelete: "set null" }),
    expenseId: integer("expense_id").references(() => expenses.id, { onDelete: "set null" }),
    uploadedBy: integer("uploaded_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("documents_created_idx").on(t.createdAt.desc(), t.id.desc()),
    index("documents_folder_idx").on(t.folder),
    index("documents_bill_idx").on(t.billId),
    index("documents_expense_idx").on(t.expenseId),
    check("documents_size_check", sql`${t.size} > 0`),
  ],
);

export const documentFiles = pgTable("document_files", {
  documentId: integer("document_id")
    .primaryKey()
    .references(() => documents.id, { onDelete: "cascade" }),
  data: bytea("data").notNull(),
});

// ---------------------------------------------------------------------------
// Banking: money that is not a sale, a purchase or an expense
// ---------------------------------------------------------------------------

export const moneyEntryKind = pgEnum("money_entry_kind", [
  "owner_in",
  "owner_out",
  "loan_in",
  "loan_out",
  "gst_paid",
  "asset_buy",
  "other_in",
  "deposit",
  "withdraw",
]);

/**
 * Money the owner puts in or takes out, loans, GST paid to the government,
 * equipment bought, other income, and cash moved to or from the bank. With
 * these the cash and bank balances match what is really there. Never deleted;
 * a wrong entry is cancelled.
 */
export const moneyEntries = pgTable(
  "money_entries",
  {
    id: id(),
    date: date("date", { mode: "string" }).notNull(),
    kind: moneyEntryKind("kind").notNull(),
    amount: money("amount").notNull(),
    /** Null for cash moved to or from the bank, which touches both. */
    mode: paymentMode("mode"),
    /** Who the money came from or went to, e.g. the bank that gave the loan. */
    party: text("party"),
    reference: text("reference"),
    notes: text("notes"),
    status: invoiceStatus("status").notNull().default("final"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelReason: text("cancel_reason"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("money_entries_date_idx").on(t.date.desc(), t.id.desc()),
    check("money_entries_amount_check", sql`${t.amount} > 0`),
    check("money_entries_mode_check", sql`(${t.kind} IN ('deposit', 'withdraw')) = (${t.mode} IS NULL)`),
  ],
);

// ---------------------------------------------------------------------------
// Recurring invoices
// ---------------------------------------------------------------------------

export const recurringFrequency = pgEnum("recurring_frequency", ["weekly", "monthly", "quarterly", "half_yearly", "yearly"]);

/**
 * An invoice to bill again at a steady interval. Nothing is created on its
 * own: when the next date arrives it shows as due, and a person opens a new
 * invoice filled in from the one being repeated, checks it and saves it.
 */
export const recurringInvoices = pgTable(
  "recurring_invoices",
  {
    id: id(),
    /** The invoice whose customer, items and rates are repeated. */
    invoiceId: integer("invoice_id")
      .notNull()
      .references(() => invoices.id, { onDelete: "restrict" }),
    customerId: integer("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "restrict" }),
    frequency: recurringFrequency("frequency").notNull(),
    /** Day of the month to bill on (1–31); shorter months use their last day. */
    anchorDay: integer("anchor_day").notNull(),
    /** When the next invoice is due. */
    nextDate: date("next_date", { mode: "string" }).notNull(),
    /** No invoices are due after this date; null repeats until stopped. */
    endDate: date("end_date", { mode: "string" }),
    active: boolean("active").notNull().default(true),
    /** Invoices made so far. */
    made: integer("made").notNull().default(0),
    lastInvoiceId: integer("last_invoice_id").references(() => invoices.id, { onDelete: "set null" }),
    notes: text("notes"),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("recurring_invoices_due_idx").on(t.active, t.nextDate),
    index("recurring_invoices_customer_idx").on(t.customerId),
    check("recurring_invoices_anchor_check", sql`${t.anchorDay} BETWEEN 1 AND 31`),
    check("recurring_invoices_made_check", sql`${t.made} >= 0`),
  ],
);

// ---------------------------------------------------------------------------
// Tasks
// ---------------------------------------------------------------------------

/** A to-do for the shop: call a customer, pay a bill, order a part. */
export const tasks = pgTable(
  "tasks",
  {
    id: id(),
    title: text("title").notNull(),
    notes: text("notes"),
    dueDate: date("due_date", { mode: "string" }),
    /** Who should do it; null is anyone. */
    assignedTo: integer("assigned_to").references(() => users.id, { onDelete: "set null" }),
    done: boolean("done").notNull().default(false),
    doneAt: timestamp("done_at", { withTimezone: true }),
    doneBy: integer("done_by").references(() => users.id, { onDelete: "set null" }),
    createdBy: integer("created_by").references(() => users.id, { onDelete: "set null" }),
    ...timestamps,
  },
  (t) => [
    index("tasks_open_idx").on(t.done, t.dueDate),
    check("tasks_done_check", sql`${t.done} = (${t.doneAt} IS NOT NULL)`),
  ],
);
