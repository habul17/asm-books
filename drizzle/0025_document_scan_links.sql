ALTER TABLE "documents" ADD COLUMN "payment_id" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "vendor_payment_id" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "purchase_return_id" integer;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "scan_pending" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_vendor_payment_id_vendor_payments_id_fk" FOREIGN KEY ("vendor_payment_id") REFERENCES "public"."vendor_payments"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_purchase_return_id_purchase_returns_id_fk" FOREIGN KEY ("purchase_return_id") REFERENCES "public"."purchase_returns"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_payment_idx" ON "documents" USING btree ("payment_id");--> statement-breakpoint
CREATE INDEX "documents_vendor_payment_idx" ON "documents" USING btree ("vendor_payment_id");--> statement-breakpoint
CREATE INDEX "documents_purchase_return_idx" ON "documents" USING btree ("purchase_return_id");