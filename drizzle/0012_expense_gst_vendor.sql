ALTER TABLE "expenses" ADD COLUMN "vendor_id" integer;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "gst_rate" numeric(6, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "cgst" numeric(12, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "sgst" numeric(12, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD COLUMN "igst" numeric(12, 2) DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "expenses_vendor_idx" ON "expenses" USING btree ("vendor_id");--> statement-breakpoint
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_gst_check" CHECK ("expenses"."cgst" + "expenses"."sgst" + "expenses"."igst" <= "expenses"."amount");