ALTER TYPE "public"."stock_movement_kind" ADD VALUE 'purchase_return';--> statement-breakpoint
ALTER TYPE "public"."stock_movement_kind" ADD VALUE 'purchase_return_cancel';--> statement-breakpoint
CREATE TABLE "purchase_return_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_return_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"purchase_return_id" integer NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" integer NOT NULL,
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
	CONSTRAINT "purchase_return_lines_line_unique" UNIQUE("purchase_return_id","line_no"),
	CONSTRAINT "purchase_return_lines_qty_check" CHECK ("purchase_return_lines"."qty" > 0),
	CONSTRAINT "purchase_return_lines_rate_check" CHECK ("purchase_return_lines"."rate" >= 0),
	CONSTRAINT "purchase_return_lines_discount_check" CHECK ("purchase_return_lines"."discount_pct" BETWEEN 0 AND 100),
	CONSTRAINT "purchase_return_lines_gst_check" CHECK ("purchase_return_lines"."gst_rate" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "purchase_returns" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_returns_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"number" text NOT NULL,
	"fy" text NOT NULL,
	"seq" integer NOT NULL,
	"date" date NOT NULL,
	"vendor_id" integer NOT NULL,
	"vendor_name" text NOT NULL,
	"vendor_gstin" text,
	"bill_ref" text,
	"tax_type" "tax_type" NOT NULL,
	"reason" text NOT NULL,
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
	CONSTRAINT "purchase_returns_number_unique" UNIQUE("number"),
	CONSTRAINT "purchase_returns_fy_seq_unique" UNIQUE("fy","seq"),
	CONSTRAINT "purchase_returns_grand_total_check" CHECK ("purchase_returns"."grand_total" >= 0)
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "purchase_return_id" integer;--> statement-breakpoint
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_purchase_return_id_purchase_returns_id_fk" FOREIGN KEY ("purchase_return_id") REFERENCES "public"."purchase_returns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_return_lines" ADD CONSTRAINT "purchase_return_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_returns" ADD CONSTRAINT "purchase_returns_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "purchase_return_lines_product_idx" ON "purchase_return_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "purchase_returns_date_idx" ON "purchase_returns" USING btree ("date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "purchase_returns_vendor_idx" ON "purchase_returns" USING btree ("vendor_id");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_purchase_return_id_purchase_returns_id_fk" FOREIGN KEY ("purchase_return_id") REFERENCES "public"."purchase_returns"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_movements_purchase_return_idx" ON "stock_movements" USING btree ("purchase_return_id");