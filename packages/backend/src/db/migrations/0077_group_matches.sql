-- US-953: Hand-picked matches per group. A group admin can pull individual
-- matches from ANY league into the group for tipping, independent of the
-- group's subscribed leagues. Additive to the league-based scoping.
-- The custom migrator wraps this file in BEGIN/COMMIT — do NOT add explicit BEGIN/COMMIT here.

ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'group_match_add';
--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'group_match_remove';
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "group_matches" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL,
	"added_by" uuid
);
--> statement-breakpoint
ALTER TABLE "group_matches" ADD CONSTRAINT "group_matches_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "group_matches" ADD CONSTRAINT "group_matches_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "group_matches" ADD CONSTRAINT "group_matches_added_by_users_id_fk" FOREIGN KEY ("added_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "group_matches_group_match_idx" ON "group_matches" USING btree ("group_id","match_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "group_matches_group_idx" ON "group_matches" USING btree ("group_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "group_matches_match_idx" ON "group_matches" USING btree ("match_id");
