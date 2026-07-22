-- US-949: Make leagues DB-driven. Introduces:
--   * league_status ENUM ('active','archived') — visibility state that SUPERSEDES
--     the US-940 archived_at column (status is now the single source of truth).
--   * sync_enabled boolean — INDEPENDENT sync toggle. The sync-runner selects only
--     rows with sync_enabled = true AND status = 'active'; an archived league is
--     NEVER synced.
--   * external_id / season / sync_from / sync_to / fixture_allowlist — per-league
--     sync config, replacing the env-driven LEAGUE_SPECS.
-- The custom migrator wraps this file in BEGIN/COMMIT — do NOT add explicit BEGIN/COMMIT here.

CREATE TYPE "public"."league_status" AS ENUM('active', 'archived');--> statement-breakpoint

ALTER TABLE "leagues"
  ADD COLUMN IF NOT EXISTS "status" "league_status" NOT NULL DEFAULT 'active';--> statement-breakpoint
ALTER TABLE "leagues"
  ADD COLUMN IF NOT EXISTS "sync_enabled" boolean NOT NULL DEFAULT false;--> statement-breakpoint
ALTER TABLE "leagues"
  ADD COLUMN IF NOT EXISTS "external_id" integer;--> statement-breakpoint
ALTER TABLE "leagues"
  ADD COLUMN IF NOT EXISTS "season" smallint;--> statement-breakpoint
ALTER TABLE "leagues"
  ADD COLUMN IF NOT EXISTS "sync_from" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leagues"
  ADD COLUMN IF NOT EXISTS "sync_to" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "leagues"
  ADD COLUMN IF NOT EXISTS "fixture_allowlist" integer[];--> statement-breakpoint

-- Data-migration: backfill status from the former archived_at column
-- (archived_at IS NOT NULL → 'archived', else 'active'). Guarded so it is a no-op
-- if archived_at was already dropped (re-run safety).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'leagues' AND column_name = 'archived_at'
  ) THEN
    UPDATE "leagues" SET "status" = 'archived' WHERE "archived_at" IS NOT NULL;
  END IF;
END $$;--> statement-breakpoint

-- Data-migration: seed the WC2026 sync config from the values previously held in env
-- (FOOTBALL_API_WC_LEAGUE_ID=1, season 2026). Matched by short_name, not a hardcoded
-- UUID, so it works regardless of how the prod row was created. No-op if the row is
-- missing; does NOT enable sync on any other league.
UPDATE "leagues"
  SET "external_id" = 1,
      "season" = 2026,
      "sync_enabled" = true,
      "status" = 'active',
      "updated_at" = now()
  WHERE "short_name" = 'VB'
    AND "external_id" IS NULL;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS "leagues_external_id_unique" ON "leagues" USING btree ("external_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leagues_status_idx" ON "leagues" USING btree ("status");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "leagues_sync_enabled_idx" ON "leagues" USING btree ("sync_enabled");--> statement-breakpoint

-- archived_at is superseded by status — drop it and its index after the backfill.
DROP INDEX IF EXISTS "leagues_archived_at_idx";--> statement-breakpoint
ALTER TABLE "leagues" DROP COLUMN IF EXISTS "archived_at";
