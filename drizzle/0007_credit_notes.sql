ALTER TYPE "public"."stock_movement_kind" ADD VALUE 'sale_return';--> statement-breakpoint
ALTER TYPE "public"."stock_movement_kind" ADD VALUE 'sale_return_cancel';--> statement-breakpoint
CREATE TABLE "credit_note_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "credit_note_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"credit_note_id" integer NOT NULL,
	"line_no" integer NOT NULL,
	"invoice_line_id" integer,
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
	CONSTRAINT "credit_note_lines_note_line_unique" UNIQUE("credit_note_id","line_no"),
	CONSTRAINT "credit_note_lines_qty_check" CHECK ("credit_note_lines"."qty" > 0)
);
--> statement-breakpoint
CREATE TABLE "credit_notes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "credit_notes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"number" text NOT NULL,
	"fy" text NOT NULL,
	"seq" integer NOT NULL,
	"date" date NOT NULL,
	"invoice_id" integer NOT NULL,
	"customer_id" integer,
	"customer_name" text NOT NULL,
	"customer_gstin" text,
	"customer_mobile" text,
	"billing_address" text,
	"place_of_supply" text,
	"tax_type" "tax_type" NOT NULL,
	"refund_type" "payment_type" NOT NULL,
	"restocked" boolean DEFAULT true NOT NULL,
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
	CONSTRAINT "credit_notes_number_unique" UNIQUE("number"),
	CONSTRAINT "credit_notes_fy_seq_unique" UNIQUE("fy","seq"),
	CONSTRAINT "credit_notes_grand_total_check" CHECK ("credit_notes"."grand_total" >= 0),
	CONSTRAINT "credit_notes_walk_in_cash_check" CHECK ("credit_notes"."customer_id" IS NOT NULL OR "credit_notes"."refund_type" = 'cash')
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "credit_note_id" integer;--> statement-breakpoint
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_invoice_line_id_invoice_lines_id_fk" FOREIGN KEY ("invoice_line_id") REFERENCES "public"."invoice_lines"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_note_lines" ADD CONSTRAINT "credit_note_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "credit_note_lines_invoice_line_idx" ON "credit_note_lines" USING btree ("invoice_line_id");--> statement-breakpoint
CREATE INDEX "credit_notes_date_idx" ON "credit_notes" USING btree ("date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "credit_notes_invoice_idx" ON "credit_notes" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "credit_notes_customer_idx" ON "credit_notes" USING btree ("customer_id");--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_credit_note_id_credit_notes_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "public"."credit_notes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_movements_credit_note_idx" ON "stock_movements" USING btree ("credit_note_id");