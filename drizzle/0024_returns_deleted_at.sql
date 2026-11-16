ALTER TABLE "credit_notes" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "purchase_returns" ADD COLUMN "deleted_at" timestamp with time zone;