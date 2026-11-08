ALTER TYPE "public"."stock_movement_kind" ADD VALUE 'adjust_cancel';--> statement-breakpoint
CREATE TABLE "stock_adjustment_lines" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_adjustment_lines_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"adjustment_id" integer NOT NULL,
	"line_no" integer NOT NULL,
	"product_id" integer NOT NULL,
	"part_no" text,
	"description" text NOT NULL,
	"unit" text NOT NULL,
	"qty_before" numeric(14, 3) NOT NULL,
	"qty" numeric(14, 3) NOT NULL,
	"cost" numeric(20, 10),
	CONSTRAINT "stock_adjustment_lines_line_unique" UNIQUE("adjustment_id","line_no"),
	CONSTRAINT "stock_adjustment_lines_qty_check" CHECK ("stock_adjustment_lines"."qty" <> 0)
);
--> statement-breakpoint
CREATE TABLE "stock_adjustments" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "stock_adjustments_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"number" text NOT NULL,
	"fy" text NOT NULL,
	"seq" integer NOT NULL,
	"date" date NOT NULL,
	"reason" text NOT NULL,
	"notes" text,
	"status" "invoice_status" DEFAULT 'final' NOT NULL,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_adjustments_number_unique" UNIQUE("number"),
	CONSTRAINT "stock_adjustments_fy_seq_unique" UNIQUE("fy","seq")
);
--> statement-breakpoint
ALTER TABLE "stock_movements" ADD COLUMN "adjustment_id" integer;--> statement-breakpoint
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_adjustment_id_stock_adjustments_id_fk" FOREIGN KEY ("adjustment_id") REFERENCES "public"."stock_adjustments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustment_lines" ADD CONSTRAINT "stock_adjustment_lines_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_adjustments" ADD CONSTRAINT "stock_adjustments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_adjustment_lines_product_idx" ON "stock_adjustment_lines" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "stock_adjustments_date_idx" ON "stock_adjustments" USING btree ("date" DESC NULLS LAST,"id" DESC NULLS LAST);--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_adjustment_id_stock_adjustments_id_fk" FOREIGN KEY ("adjustment_id") REFERENCES "public"."stock_adjustments"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_movements_adjustment_idx" ON "stock_movements" USING btree ("adjustment_id");