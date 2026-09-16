CREATE TYPE "public"."collaborator_role" AS ENUM('owner', 'admin', 'writer', 'editor', 'viewer');--> statement-breakpoint
CREATE TYPE "public"."invitation_status" AS ENUM('pending', 'accepted', 'declined', 'revoked', 'expired');--> statement-breakpoint
CREATE TABLE "collaboration_invitations" (
	"id" uuid PRIMARY KEY NOT NULL,
	"novel_id" uuid NOT NULL,
	"invitee_id" uuid NOT NULL,
	"inviter_id" uuid,
	"role" "collaborator_role" NOT NULL,
	"status" "invitation_status" DEFAULT 'pending' NOT NULL,
	"responded_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "collaborators" (
	"id" uuid PRIMARY KEY NOT NULL,
	"novel_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "collaborator_role" NOT NULL,
	"invited_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "forks" (
	"id" uuid PRIMARY KEY NOT NULL,
	"source_novel_id" uuid NOT NULL,
	"forked_novel_id" uuid NOT NULL,
	"forked_by" uuid,
	"root_novel_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "forks_forked_novel_id_unique" UNIQUE("forked_novel_id")
);
--> statement-breakpoint
ALTER TABLE "collaboration_invitations" ADD CONSTRAINT "collaboration_invitations_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_invitations" ADD CONSTRAINT "collaboration_invitations_invitee_id_users_id_fk" FOREIGN KEY ("invitee_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaboration_invitations" ADD CONSTRAINT "collaboration_invitations_inviter_id_users_id_fk" FOREIGN KEY ("inviter_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_novel_id_novels_id_fk" FOREIGN KEY ("novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "collaborators" ADD CONSTRAINT "collaborators_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forks" ADD CONSTRAINT "forks_source_novel_id_novels_id_fk" FOREIGN KEY ("source_novel_id") REFERENCES "public"."novels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forks" ADD CONSTRAINT "forks_forked_novel_id_novels_id_fk" FOREIGN KEY ("forked_novel_id") REFERENCES "public"."novels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forks" ADD CONSTRAINT "forks_forked_by_users_id_fk" FOREIGN KEY ("forked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "forks" ADD CONSTRAINT "forks_root_novel_id_novels_id_fk" FOREIGN KEY ("root_novel_id") REFERENCES "public"."novels"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "collaboration_invitations_invitee_idx" ON "collaboration_invitations" USING btree ("invitee_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "collaboration_invitations_pending_uq" ON "collaboration_invitations" USING btree ("novel_id","invitee_id") WHERE "collaboration_invitations"."status" = 'pending';--> statement-breakpoint
CREATE UNIQUE INDEX "collaborators_novel_user_uq" ON "collaborators" USING btree ("novel_id","user_id");--> statement-breakpoint
CREATE INDEX "collaborators_user_idx" ON "collaborators" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "collaborators_owner_uq" ON "collaborators" USING btree ("novel_id") WHERE "collaborators"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "forks_source_idx" ON "forks" USING btree ("source_novel_id");--> statement-breakpoint
CREATE UNIQUE INDEX "forks_forked_uq" ON "forks" USING btree ("forked_novel_id");