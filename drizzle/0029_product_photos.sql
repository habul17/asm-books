CREATE TABLE "product_photos" (
	"id" text PRIMARY KEY NOT NULL,
	"mime_type" text NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_photo_product_photos_id_fk" FOREIGN KEY ("photo") REFERENCES "public"."product_photos"("id") ON DELETE set null ON UPDATE no action;