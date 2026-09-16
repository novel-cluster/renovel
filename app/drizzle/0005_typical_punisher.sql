CREATE SCHEMA "analytics";
--> statement-breakpoint
CREATE TABLE "analytics"."analytics_events" (
	"id" uuid PRIMARY KEY NOT NULL,
	"event_type" text NOT NULL,
	"novel_id" uuid,
	"episode_id" uuid,
	"actor_id" uuid,
	"session_id" text,
	"utm_source" text,
	"utm_medium" text,
	"utm_campaign" text,
	"props" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "analytics_events_novel_idx" ON "analytics"."analytics_events" USING btree ("novel_id","occurred_at");--> statement-breakpoint
CREATE INDEX "analytics_events_episode_idx" ON "analytics"."analytics_events" USING btree ("episode_id","event_type");