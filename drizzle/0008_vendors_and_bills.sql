ALTER TYPE "public"."stock_movement_kind" ADD VALUE 'purchase_edit';--> statement-breakpoint
ALTER TYPE "public"."stock_movement_kind" ADD VALUE 'purchase_cancel';--> statement-breakpoint
CREATE TABLE "bill_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bill_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"bill_id" integer NOT NULL,
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
	CONSTRAINT "bill_lines_bill_line_unique" UNIQUE("bill_id","line_no"),
	CONSTRAINT "bill_lines_qty_check" CHECK ("bill_lines"."qty" > 0),
	CONSTRAINT "bill_lines_rate_check" CHECK ("bill_lines"."rate" >= 0),
	CONSTRAINT "bill_lines_discount_check" CHECK ("bill_lines"."discount_pct" BETWEEN 0 AND 100),
	CONSTRAINT "bill_lines_gst_check" CHECK ("bill_lines"."gst_rate" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "bills" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bills_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"vendor_id" integer NOT NULL,
	"bill_no" text NOT NULL,
	"date" date NOT NULL,
	"due_date" date,
	"tax_type" "tax_type" NOT NULL,
	"taxable_total" numeric(12, 2) NOT NULL,
	"cgst_total" numeric(12, 2) NOT NULL,
	"sgst_total" numeric(12, 2) NOT NULL,
	"igst_total" numeric(12, 2) NOT NULL,
	"round_off" numeric(12, 2) NOT NULL,
	"grand_total" numeric(12, 2) NOT NULL,
	"update_prices" boolean DEFAULT true NOT NULL,
	"notes" text,
	"status" "invoice_status" DEFAULT 'final' NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "bills_grand_total_check" CHECK ("bills"."grand_total" >= 0)
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vendors_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"contact_person" text,
	"mobile" text,
	"email" text,
	"address" text,
	"city" text,
	"state_code" text,
	"pincode" text,
	"gstin" text,
	"opening_balance" numeric(12, 2) DEFAULT 0 NOT NULL,
	"payment_terms_days" integer,
	"notes" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_state_code_check" CHECK ("vendors"."state_code" IS NULL OR "vendors"."state_code" ~ '^[0-9]{2}$'),
	CONSTRAINT "vendors_payment_terms_check" CHECK ("vendors"."payment_terms_days" IS NULL OR "vendors"."payment_terms_days" >= 0)
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "bill_id" integer;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_lines" ADD CONSTRAINT "bill_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bills" ADD CONSTRAINT "bills_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bill_lines_product_idx" ON "bill_lines" USING btree ("product_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bills_vendor_bill_no_unique" ON "bills" USING btree ("vendor_id",lower("bill_no")) WHERE "bills"."status" = 'final';--> statement-breakpoint
CREATE INDEX "bills_date_idx" ON "bills" USING btree ("date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "bills_vendor_idx" ON "bills" USING btree ("vendor_id");--> statement-breakpoint
CREATE INDEX "vendors_name_idx" ON "vendors" USING btree (lower("name"));--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_movements_bill_idx" ON "stock_movements" USING btree ("bill_id");