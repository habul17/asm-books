CREATE TYPE "public"."money_entry_kind" AS ENUM('owner_in', 'owner_out', 'loan_in', 'loan_out', 'gst_paid', 'asset_buy', 'other_in', 'deposit', 'withdraw');--> statement-breakpoint
CREATE TABLE "money_entries" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "money_entries_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"date" date NOT NULL,
	"kind" "money_entry_kind" NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"mode" "payment_mode",
	"party" text,
	"reference" text,
	"notes" text,
	"status" "invoice_status" DEFAULT 'final' NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "money_entries_amount_check" CHECK ("money_entries"."amount" > 0),
	CONSTRAINT "money_entries_mode_check" CHECK (("money_entries"."kind" IN ('deposit', 'withdraw')) = ("money_entries"."mode" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "cash_mode" "payment_mode";--> statement-breakpoint
ALTER TABLE "money_entries" ADD CONSTRAINT "money_entries_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "money_entries_date_idx" ON "money_entries" USING btree ("date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_cash_mode_check" CHECK ("invoices"."cash_mode" IS NULL OR "invoices"."payment_type" = 'cash');