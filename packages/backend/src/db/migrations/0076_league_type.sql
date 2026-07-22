-- US-958: League type (league/cup/mixed). Drives the Matches-page phase-filter
-- visibility — only 'mixed' leagues show the group-stage vs. knockout tabs.
-- Existing leagues default to 'league'; the current World Cup league is manually
-- set to 'mixed' by an admin afterwards (data cleanup, not part of this migration).
-- The custom migrator wraps this file in BEGIN/COMMIT — do NOT add explicit BEGIN/COMMIT here.

CREATE TYPE "public"."league_type" AS ENUM ('league', 'cup', 'mixed');
--> statement-breakpoint
ALTER TABLE "leagues" ADD COLUMN "league_type" "public"."league_type" NOT NULL DEFAULT 'league';
