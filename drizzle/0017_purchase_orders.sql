CREATE TYPE "public"."purchase_order_status" AS ENUM('open', 'closed', 'cancelled');--> statement-breakpoint
CREATE TABLE "purchase_order_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_order_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"order_id" integer NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" integer,
	"part_no" text,
	"description" text NOT NULL,
	"hsn" text,
	"unit" text DEFAULT 'Nos' NOT NULL,
	"qty" numeric(14, 3) NOT NULL,
	"rate" numeric(20, 10) NOT NULL,
	"discount_pct" numeric(6, 2) DEFAULT 0 NOT NULL,
	"gst_rate" numeric(6, 2) NOT NULL,
	"taxable" numeric(12, 2) NOT NULL,
	"cgst" numeric(12, 2) NOT NULL,
	"sgst" numeric(12, 2) NOT NULL,
	"igst" numeric(12, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	CONSTRAINT "purchase_order_lines_order_line_unique" UNIQUE("order_id","line_no"),
	CONSTRAINT "purchase_order_lines_qty_check" CHECK ("purchase_order_lines"."qty" > 0),
	CONSTRAINT "purchase_order_lines_rate_check" CHECK ("purchase_order_lines"."rate" >= 0),
	CONSTRAINT "purchase_order_lines_discount_check" CHECK ("purchase_order_lines"."discount_pct" BETWEEN 0 AND 100),
	CONSTRAINT "purchase_order_lines_gst_check" CHECK ("purchase_order_lines"."gst_rate" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_orders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"number" text NOT NULL,
	"fy" text NOT NULL,
	"seq" integer NOT NULL,
	"vendor_id" integer NOT NULL,
	"date" date NOT NULL,
	"expected_date" date,
	"tax_type" "tax_type" NOT NULL,
	"taxable_total" numeric(12, 2) NOT NULL,
	"cgst_total" numeric(12, 2) NOT NULL,
	"sgst_total" numeric(12, 2) NOT NULL,
	"igst_total" numeric(12, 2) NOT NULL,
	"round_off" numeric(12, 2) NOT NULL,
	"grand_total" numeric(12, 2) NOT NULL,
	"notes" text,
	"status" "purchase_order_status" DEFAULT 'open' NOT NULL,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_number_unique" UNIQUE("number"),
	CONSTRAINT "purchase_orders_fy_seq_unique" UNIQUE("fy","seq"),
	CONSTRAINT "purchase_orders_grand_total_check" CHECK ("purchase_orders"."grand_total" >= 0)
);
--> statement-breakpoint
ALTER TABLE "bills" ADD COLUMN "purchase_order_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_order_id_purchase_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_order_lines_product_idx" ON "purchase_order_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "purchase_orders_date_idx" ON "purchase_orders" USING btree ("date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "purchase_orders_vendor_idx" ON "purchase_orders" USING btree ("vendor_id");--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bills_purchase_order_idx" ON "bills" USING btree ("purchase_order_id");