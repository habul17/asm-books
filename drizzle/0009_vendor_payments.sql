CREATE TABLE "vendor_payments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "vendor_payments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"number" text NOT NULL,
	"fy" text NOT NULL,
	"seq" integer NOT NULL,
	"date" date NOT NULL,
	"vendor_id" integer NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"mode" "payment_mode" NOT NULL,
	"reference" text,
	"notes" text,
	"status" "invoice_status" DEFAULT 'final' NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vendor_payments_number_unique" UNIQUE("number"),
	CONSTRAINT "vendor_payments_fy_seq_unique" UNIQUE("fy","seq"),
	CONSTRAINT "vendor_payments_amount_check" CHECK ("vendor_payments"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_vendor_id_vendors_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "public"."vendors"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vendor_payments" ADD CONSTRAINT "vendor_payments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "vendor_payments_date_idx" ON "vendor_payments" USING btree ("date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "vendor_payments_vendor_idx" ON "vendor_payments" USING btree ("vendor_id");