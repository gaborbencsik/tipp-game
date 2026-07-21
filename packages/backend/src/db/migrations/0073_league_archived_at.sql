-- US-940: League archiving (soft-hide). archived_at is nullable
-- (NULL = active, non-NULL = archived + timestamp of archival) and
-- is reversible + surface-selective (unlike deleted_at).

ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'league_archive';--> statement-breakpoint
ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'league_restore';--> statement-breakpoint

ALTER TABLE "leagues"
  ADD COLUMN IF NOT EXISTS "archived_at" timestamp with time zone;--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "leagues_archived_at_idx" ON "leagues" USING btree ("archived_at");
