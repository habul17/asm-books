CREATE TYPE "public"."sales_doc_kind" AS ENUM('quote', 'order', 'challan');--> statement-breakpoint
CREATE TYPE "public"."sales_doc_status" AS ENUM('open', 'closed', 'cancelled');--> statement-breakpoint
CREATE TABLE "sales_doc_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_doc_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"doc_id" integer NOT NULL,
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
	CONSTRAINT "sales_doc_lines_doc_line_unique" UNIQUE("doc_id","line_no"),
	CONSTRAINT "sales_doc_lines_qty_check" CHECK ("sales_doc_lines"."qty" > 0),
	CONSTRAINT "sales_doc_lines_rate_check" CHECK ("sales_doc_lines"."rate" >= 0),
	CONSTRAINT "sales_doc_lines_discount_check" CHECK ("sales_doc_lines"."discount_pct" BETWEEN 0 AND 100),
	CONSTRAINT "sales_doc_lines_gst_check" CHECK ("sales_doc_lines"."gst_rate" BETWEEN 0 AND 100)
);
--> statement-breakpoint
CREATE TABLE "sales_docs" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "sales_docs_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" "sales_doc_kind" NOT NULL,
	"number" text NOT NULL,
	"fy" text NOT NULL,
	"seq" integer NOT NULL,
	"date" date NOT NULL,
	"second_date" date,
	"customer_id" integer,
	"customer_name" text NOT NULL,
	"customer_gstin" text,
	"customer_mobile" text,
	"billing_address" text,
	"place_of_supply" text,
	"tax_type" "tax_type" NOT NULL,
	"price_list_id" integer,
	"taxable_total" numeric(12, 2) NOT NULL,
	"cgst_total" numeric(12, 2) NOT NULL,
	"sgst_total" numeric(12, 2) NOT NULL,
	"igst_total" numeric(12, 2) NOT NULL,
	"round_off" numeric(12, 2) NOT NULL,
	"grand_total" numeric(12, 2) NOT NULL,
	"notes" text,
	"reason" text,
	"transport" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" "sales_doc_status" DEFAULT 'open' NOT NULL,
	"source_id" integer,
	"invoice_id" integer,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_docs_number_unique" UNIQUE("number"),
	CONSTRAINT "sales_docs_kind_fy_seq_unique" UNIQUE("kind","fy","seq"),
	CONSTRAINT "sales_docs_grand_total_check" CHECK ("sales_docs"."grand_total" >= 0)
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "transport" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "sales_doc_lines" ADD CONSTRAINT "sales_doc_lines_doc_id_sales_docs_id_fk" FOREIGN KEY ("doc_id") REFERENCES "public"."sales_docs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_doc_lines" ADD CONSTRAINT "sales_doc_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_docs" ADD CONSTRAINT "sales_docs_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_docs" ADD CONSTRAINT "sales_docs_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_docs" ADD CONSTRAINT "sales_docs_source_id_sales_docs_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."sales_docs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_docs" ADD CONSTRAINT "sales_docs_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales_docs" ADD CONSTRAINT "sales_docs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_doc_lines_product_idx" ON "sales_doc_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "sales_docs_kind_date_idx" ON "sales_docs" USING btree ("kind","date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sales_docs_customer_idx" ON "sales_docs" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "sales_docs_invoice_idx" ON "sales_docs" USING btree ("invoice_id");