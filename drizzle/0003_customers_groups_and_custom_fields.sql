CREATE TYPE "public"."custom_field_type" AS ENUM('text', 'number', 'date');--> statement-breakpoint
CREATE TABLE "custom_fields" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "custom_fields_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"entity" text NOT NULL,
	"label" text NOT NULL,
	"type" "custom_field_type" DEFAULT 'text' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "custom_fields_entity_check" CHECK ("custom_fields"."entity" IN ('customer'))
);
--> statement-breakpoint
CREATE TABLE "customer_groups" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customer_groups_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"price_list_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "customers_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"contact_person" text,
	"mobile" text,
	"email" text,
	"address" text,
	"city" text,
	"state_code" text,
	"pincode" text,
	"gstin" text,
	"group_id" integer,
	"price_list_id" integer,
	"opening_balance" numeric(12, 2) DEFAULT 0 NOT NULL,
	"credit_limit" numeric(12, 2),
	"payment_terms_days" integer,
	"notes" text,
	"extra" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_state_code_check" CHECK ("customers"."state_code" IS NULL OR "customers"."state_code" ~ '^[0-9]{2}$'),
	CONSTRAINT "customers_credit_limit_check" CHECK ("customers"."credit_limit" IS NULL OR "customers"."credit_limit" >= 0),
	CONSTRAINT "customers_payment_terms_check" CHECK ("customers"."payment_terms_days" IS NULL OR "customers"."payment_terms_days" >= 0)
);
--> statement-breakpoint
ALTER TABLE "customer_groups" ADD CONSTRAINT "customer_groups_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_group_id_customer_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."customer_groups"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_price_list_id_price_lists_id_fk" FOREIGN KEY ("price_list_id") REFERENCES "public"."price_lists"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "customer_groups_name_unique" ON "customer_groups" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "customers_name_idx" ON "customers" USING btree (lower("name"));--> statement-breakpoint
CREATE INDEX "customers_group_idx" ON "customers" USING btree ("group_id");