CREATE TABLE "academy_logos" (
	"academy_id" uuid PRIMARY KEY NOT NULL,
	"mime" varchar(20) NOT NULL,
	"data" "bytea" NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"sha256" varchar(64) NOT NULL,
	"uploaded_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "academy_logos_not_empty" CHECK (octet_length("academy_logos"."data") > 0 and "academy_logos"."size_bytes" > 0)
);
--> statement-breakpoint
CREATE TABLE "announcements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" uuid NOT NULL,
	"title" varchar(120) NOT NULL,
	"body" text NOT NULL,
	"category" varchar(20) DEFAULT 'geral' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"archived_at" timestamp with time zone,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "student_ranks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"academy_id" uuid NOT NULL,
	"student_id" uuid NOT NULL,
	"modality_id" uuid,
	"rank" varchar(60) NOT NULL,
	"awarded_at" date NOT NULL,
	"awarded_by" varchar(120),
	"notes" varchar(200),
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "legal_name" varchar(160);--> statement-breakpoint
ALTER TABLE "academies" ADD COLUMN "owner_name" varchar(120);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "checkin_code" varchar(16);--> statement-breakpoint
ALTER TABLE "students" ADD COLUMN "checkin_code_created_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "academy_logos" ADD CONSTRAINT "academy_logos_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "academy_logos" ADD CONSTRAINT "academy_logos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "announcements" ADD CONSTRAINT "announcements_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_ranks" ADD CONSTRAINT "student_ranks_academy_id_academies_id_fk" FOREIGN KEY ("academy_id") REFERENCES "public"."academies"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_ranks" ADD CONSTRAINT "student_ranks_student_id_students_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."students"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_ranks" ADD CONSTRAINT "student_ranks_modality_id_modalities_id_fk" FOREIGN KEY ("modality_id") REFERENCES "public"."modalities"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "student_ranks" ADD CONSTRAINT "student_ranks_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "announcements_academy_idx" ON "announcements" USING btree ("academy_id","published_at");--> statement-breakpoint
CREATE INDEX "student_ranks_student_idx" ON "student_ranks" USING btree ("student_id","awarded_at");--> statement-breakpoint
ALTER TABLE "students" ADD CONSTRAINT "students_checkin_code_unique" UNIQUE("checkin_code");