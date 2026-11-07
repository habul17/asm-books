CREATE TYPE "public"."invoice_status" AS ENUM('final', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."payment_type" AS ENUM('credit', 'cash');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_kind" AS ENUM('opening', 'adjust', 'sale', 'sale_edit', 'sale_cancel', 'purchase');--> statement-breakpoint
CREATE TYPE "public"."tax_type" AS ENUM('intra', 'inter');--> statement-breakpoint
CREATE TABLE "invoice_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invoice_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"invoice_id" integer NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" integer,
	"part_no" text,
	"description" text NOT NULL,
	"hsn" text,
	"unit" text DEFAULT 'Nos' NOT NULL,
	"qty" numeric(14, 3) NOT NULL,
	"rate" numeric(12, 2) NOT NULL,
	"discount_pct" numeric(6, 2) DEFAULT 0 NOT NULL,
	"gst_rate" numeric(6, 2) NOT NULL,
	"taxable" numeric(12, 2) NOT NULL,
	"cgst" numeric(12, 2) NOT NULL,
	"sgst" numeric(12, 2) NOT NULL,
	"igst" numeric(12, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"cost" numeric(20, 10),
	CONSTRAINT "invoice_lines_invoice_line_unique" UNIQUE("invoice_id","line_no"),
	CONSTRAINT "invoice_lines_qty_check" CHECK ("invoice_lines"."qty" > 0),
	CONSTRAINT "invoice_lines_rate_check" CHECK ("invoice_lines"."rate" >= 0),
	CONSTRAINT "invoice_lines_discount_check" CHECK ("invoice_lines"."discount_pct" BETWEEN 0 AND 100),
	CONSTRAINT "invoice_lines_gst_check" CHECK ("invoice_lines"."gst_rate" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "invoices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invoices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"number" text NOT NULL,
	"fy" text NOT NULL,
	"seq" integer NOT NULL,
	"date" date NOT NULL,
	"due_date" date,
	"customer_id" integer,
	"customer_name" text NOT NULL,
	"customer_gstin" text,
	"customer_mobile" text,
	"billing_address" text,
	"place_of_supply" text,
	"tax_type" "tax_type" NOT NULL,
	"price_list_id" integer,
	"payment_type" "payment_type" DEFAULT 'credit' NOT NULL,
	"taxable_total" numeric(12, 2) NOT NULL,
	"cgst_total" numeric(12, 2) NOT NULL,
	"sgst_total" numeric(12, 2) NOT NULL,
	"igst_total" numeric(12, 2) NOT NULL,
	"round_off" numeric(12, 2) NOT NULL,
	"grand_total" numeric(12, 2) NOT NULL,
	"notes" text,
	"status" "invoice_status" DEFAULT 'final' NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "invoices_number_unique" UNIQUE("number"),
	CONSTRAINT "invoices_fy_seq_unique" UNIQUE("fy","seq"),
	CONSTRAINT "invoices_grand_total_check" CHECK ("invoices"."grand_total" >= 0),
	CONSTRAINT "invoices_walk_in_cash_check" CHECK ("invoices"."customer_id" IS NOT NULL OR "invoices"."payment_type" = 'cash')
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_movements_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"qty" numeric(14, 3) NOT NULL,
	"kind" "stock_movement_kind" NOT NULL,
	"invoice_id" integer,
	"date" date NOT NULL,
	"note" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_qty_check" CHECK ("stock_movements"."qty" <> 0)
);
--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_lines_product_idx" ON "invoice_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "invoices_date_idx" ON "invoices" USING btree ("date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "invoices_customer_idx" ON "invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "stock_movements_product_idx" ON "stock_movements" USING btree ("product_id","date");--> statement-breakpoint
CREATE INDEX "stock_movements_invoice_idx" ON "stock_movements" USING btree ("invoice_id");