ALTER TABLE "custom_fields" DROP CONSTRAINT "custom_fields_entity_check";--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "extra" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "custom_fields" ADD CONSTRAINT "custom_fields_entity_check" CHECK ("custom_fields"."entity" IN ('customer', 'invoice'));