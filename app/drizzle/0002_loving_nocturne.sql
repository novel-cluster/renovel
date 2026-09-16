CREATE TYPE "public"."library_state" AS ENUM('reading', 'read_later', 'completed', 'favorite');--> statement-breakpoint
CREATE TABLE "library_entries" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"novel_id" uuid NOT NULL,
	"state" "library_state" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reading_progress" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"novel_id" uuid NOT NULL,
	"episode_id" uuid NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"is_completed" boolean DEFAULT false NOT NULL,
	"last_read_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_entries" ADD CONSTRAINT "library_entries_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "library_entries_user_novel_uq" ON "library_entries" USING btree ("user_id","novel_id");--> statement-breakpoint
CREATE INDEX "library_entries_user_state_idx" ON "library_entries" USING btree ("user_id","state");--> statement-breakpoint
CREATE UNIQUE INDEX "reading_progress_user_episode_uq" ON "reading_progress" USING btree ("user_id","episode_id");--> statement-breakpoint
CREATE INDEX "reading_progress_user_novel_idx" ON "reading_progress" USING btree ("user_id","novel_id");--> statement-breakpoint
CREATE INDEX "reading_progress_recent_idx" ON "reading_progress" USING btree ("user_id","last_read_at");