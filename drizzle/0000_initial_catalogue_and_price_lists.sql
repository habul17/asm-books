CREATE TYPE "public"."adjust_type" AS ENUM('markup', 'markdown');--> statement-breakpoint
CREATE TYPE "public"."price_base" AS ENUM('purchase', 'previous_purchase', 'list', 'manual');--> statement-breakpoint
CREATE TABLE "brands" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "brands_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "brands_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "categories_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"parent_id" integer,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "categories_name_parent_unique" UNIQUE NULLS NOT DISTINCT("name","parent_id")
);
--> statement-breakpoint
CREATE TABLE "price_list_folders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "price_list_folders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"parent_id" integer,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_list_items" (
	"price_list_id" integer NOT NULL,
	"product_id" integer NOT NULL,
	"manual_price" numeric(12, 2) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_list_items_price_list_id_product_id_pk" PRIMARY KEY("price_list_id","product_id"),
	CONSTRAINT "price_list_items_manual_price_check" CHECK ("price_list_items"."manual_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "price_lists" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "price_lists_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"folder_id" integer,
	"base" "price_base" DEFAULT 'purchase' NOT NULL,
	"adjust_type" "adjust_type" DEFAULT 'markup' NOT NULL,
	"adjust_pct" numeric(6, 2) DEFAULT 0 NOT NULL,
	"discount_pct" numeric(6, 2) DEFAULT 0 NOT NULL,
	"round_to" numeric(12, 2) DEFAULT 0 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"notes" text,
	"sort" integer DEFAULT 0 NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "price_lists_adjust_pct_check" CHECK ("price_lists"."adjust_pct" >= 0),
	CONSTRAINT "price_lists_markdown_check" CHECK ("price_lists"."adjust_type" <> 'markdown' OR "price_lists"."adjust_pct" <= 100),
	CONSTRAINT "price_lists_discount_pct_check" CHECK ("price_lists"."discount_pct" BETWEEN 0 AND 100),
	CONSTRAINT "price_lists_round_to_check" CHECK ("price_lists"."round_to" >= 0)
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "products_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"part_no" text NOT NULL,
	"description" text NOT NULL,
	"hsn" text,
	"brand_id" integer,
	"category_id" integer,
	"unit" text DEFAULT 'Nos' NOT NULL,
	"gst_rate" numeric(6, 2),
	"list_price" numeric(12, 2),
	"photo" text,
	"stock_qty" numeric(14, 3) DEFAULT 0 NOT NULL,
	"min_stock" numeric(14, 3),
	"active" boolean DEFAULT true NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_part_no_unique" UNIQUE("part_no"),
	CONSTRAINT "products_gst_rate_check" CHECK ("products"."gst_rate" IS NULL OR "products"."gst_rate" BETWEEN 0 AND 100),
	CONSTRAINT "products_list_price_check" CHECK ("products"."list_price" IS NULL OR "products"."list_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "purchase_prices" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "purchase_prices_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"product_id" integer NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"date" date NOT NULL,
	"supplier" text,
	"bill_ref" text,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_prices_price_check" CHECK ("purchase_prices"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_id_categories_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_folders" ADD CONSTRAINT "price_list_folders_parent_id_price_list_folders_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."price_list_folders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_list_items" ADD CONSTRAINT "price_list_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_lists" ADD CONSTRAINT "price_lists_folder_id_price_list_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."price_list_folders"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_brand_id_brands_id_fk" FOREIGN KEY ("brand_id") REFERENCES "public"."brands"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_prices" ADD CONSTRAINT "purchase_prices_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");--> statement-breakpoint
CREATE INDEX "purchase_prices_product_date_idx" ON "purchase_prices" USING btree ("product_id","date" DESC NULLS LAST,"id" DESC NULLS LAST);