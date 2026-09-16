CREATE TYPE "public"."content_state" AS ENUM('visible', 'hidden');--> statement-breakpoint
CREATE TYPE "public"."episode_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."fork_policy" AS ENUM('disabled', 'approval_required', 'allowed');--> statement-breakpoint
CREATE TYPE "public"."genre" AS ENUM('fantasy', 'sf', 'romance', 'mystery', 'horror', 'literary', 'essay', 'other');--> statement-breakpoint
CREATE TYPE "public"."publication_status" AS ENUM('ongoing', 'completed', 'hiatus');--> statement-breakpoint
CREATE TYPE "public"."visibility" AS ENUM('public', 'unlisted', 'private');--> statement-breakpoint
CREATE TABLE "chapters" (
	"id" uuid PRIMARY KEY NOT NULL,
	"novel_id" uuid NOT NULL,
	"title" text NOT NULL,
	"order_index" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"novel_id" uuid NOT NULL,
	"chapter_id" uuid,
	"episode_no" integer NOT NULL,
	"order_index" integer NOT NULL,
	"title" text NOT NULL,
	"body" text DEFAULT '' NOT NULL,
	"char_count" integer DEFAULT 0 NOT NULL,
	"status" "episode_status" DEFAULT 'draft' NOT NULL,
	"visibility" "visibility",
	"content_state" "content_state" DEFAULT 'visible' NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "novels" (
	"id" uuid PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"author_id" uuid NOT NULL,
	"title" text NOT NULL,
	"catchphrase" text,
	"description" text,
	"genre" "genre",
	"visibility" "visibility" DEFAULT 'private' NOT NULL,
	"publication_status" "publication_status" DEFAULT 'ongoing' NOT NULL,
	"content_state" "content_state" DEFAULT 'visible' NOT NULL,
	"content_warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fork_policy" "fork_policy" DEFAULT 'disabled' NOT NULL,
	"total_char_count" integer DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"star_avg" numeric(3, 2) DEFAULT '0' NOT NULL,
	"star_count" integer DEFAULT 0 NOT NULL,
	"follow_count" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "novels_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "episode_revisions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"episode_id" uuid NOT NULL,
	"editor_id" uuid NOT NULL,
	"revision_no" integer NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"char_count" integer DEFAULT 0 NOT NULL,
	"change_note" text,
	"restored_from_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_publishes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"episode_id" uuid NOT NULL,
	"scheduled_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"executed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "scheduled_publishes_episode_id_unique" UNIQUE("episode_id")
);
--> statement-breakpoint
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "novels" ADD CONSTRAINT "novels_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_revisions" ADD CONSTRAINT "episode_revisions_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_revisions" ADD CONSTRAINT "episode_revisions_editor_id_users_id_fk" FOREIGN KEY ("editor_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episode_revisions" ADD CONSTRAINT "episode_revisions_restored_from_id_episode_revisions_id_fk" FOREIGN KEY ("restored_from_id") REFERENCES "public"."episode_revisions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "scheduled_publishes" ADD CONSTRAINT "scheduled_publishes_episode_id_episodes_id_fk" FOREIGN KEY ("episode_id") REFERENCES "public"."episodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "chapters_novel_idx" ON "chapters" USING btree ("novel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "chapters_order_uq" ON "chapters" USING btree ("novel_id","order_index");--> statement-breakpoint
CREATE UNIQUE INDEX "episodes_no_uq" ON "episodes" USING btree ("novel_id","episode_no");--> statement-breakpoint
CREATE UNIQUE INDEX "episodes_order_uq" ON "episodes" USING btree ("novel_id","order_index");--> statement-breakpoint
CREATE INDEX "episodes_chapter_idx" ON "episodes" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "episodes_published_idx" ON "episodes" USING btree ("novel_id","status","published_at");--> statement-breakpoint
CREATE INDEX "novels_author_idx" ON "novels" USING btree ("author_id");--> statement-breakpoint
CREATE INDEX "novels_listing_idx" ON "novels" USING btree ("visibility","publication_status","published_at" DESC NULLS LAST) WHERE "novels"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX "episode_revisions_no_uq" ON "episode_revisions" USING btree ("episode_id","revision_no");--> statement-breakpoint
CREATE INDEX "episode_revisions_editor_idx" ON "episode_revisions" USING btree ("editor_id");--> statement-breakpoint
CREATE INDEX "scheduled_publishes_due_idx" ON "scheduled_publishes" USING btree ("status","scheduled_at");