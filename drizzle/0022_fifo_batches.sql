CREATE TABLE "invoice_line_batches" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "invoice_line_batches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"invoice_id" integer NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" integer NOT NULL,
	"bill_id" integer,
	"bill_no" text,
	"bill_date" date,
	"qty" numeric(14, 3) NOT NULL,
	"cost" numeric(20, 10),
	"short" boolean DEFAULT false NOT NULL,
	CONSTRAINT "invoice_line_batches_qty_check" CHECK ("invoice_line_batches"."qty" > 0)
);
--> statement-breakpoint
ALTER TABLE "invoice_line_batches" ADD CONSTRAINT "invoice_line_batches_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_batches" ADD CONSTRAINT "invoice_line_batches_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_line_batches" ADD CONSTRAINT "invoice_line_batches_bill_id_bills_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."bills"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "invoice_line_batches_invoice_idx" ON "invoice_line_batches" USING btree ("invoice_id","line_no");--> statement-breakpoint
CREATE INDEX "invoice_line_batches_bill_idx" ON "invoice_line_batches" USING btree ("bill_id");