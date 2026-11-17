ALTER TABLE "documents" ADD COLUMN "invoice_id" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "purchase_order_id" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_invoice_idx" ON "documents" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "documents_purchase_order_idx" ON "documents" USING btree ("purchase_order_id");