CREATE TABLE "note_files" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"note_id" integer NOT NULL,
	"name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size" integer NOT NULL,
	"encrypted" boolean DEFAULT false NOT NULL,
	"data" "bytea" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_folders" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "note_folders_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "note_locks" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"salt" text NOT NULL,
	"iterations" integer NOT NULL,
	"check" text NOT NULL,
	"hint" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "notes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"user_id" integer NOT NULL,
	"folder_id" integer,
	"title" text DEFAULT '' NOT NULL,
	"preview" text DEFAULT '' NOT NULL,
	"body" jsonb,
	"search_text" text DEFAULT '' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"cipher" text,
	"version" integer DEFAULT 1 NOT NULL,
	"edited_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notes_locked_check" CHECK ("notes"."locked" = ("notes"."cipher" IS NOT NULL) AND (NOT "notes"."locked" OR "notes"."body" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "note_files" ADD CONSTRAINT "note_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_files" ADD CONSTRAINT "note_files_note_id_notes_id_fk" FOREIGN KEY ("note_id") REFERENCES "public"."notes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_folders" ADD CONSTRAINT "note_folders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "note_locks" ADD CONSTRAINT "note_locks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notes" ADD CONSTRAINT "notes_folder_id_note_folders_id_fk" FOREIGN KEY ("folder_id") REFERENCES "public"."note_folders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "note_files_note_idx" ON "note_files" USING btree ("note_id");--> statement-breakpoint
CREATE UNIQUE INDEX "note_folders_user_name_uq" ON "note_folders" USING btree ("user_id",lower("name"));--> statement-breakpoint
CREATE INDEX "notes_user_idx" ON "notes" USING btree ("user_id","deleted_at","edited_at");