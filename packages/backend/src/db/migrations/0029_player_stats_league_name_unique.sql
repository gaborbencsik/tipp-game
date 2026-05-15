-- Make league_name NOT NULL (always present in API response)
ALTER TABLE "player_stats" ALTER COLUMN "league_name" SET NOT NULL;--> statement-breakpoint
-- Drop old unique index (player_id, season, league_id)
DROP INDEX IF EXISTS "player_stats_player_season_league_idx";--> statement-breakpoint
-- Drop league_id column (redundant, API often returns null)
ALTER TABLE "player_stats" DROP COLUMN IF EXISTS "league_id";--> statement-breakpoint
-- Create new unique index (player_id, season, league_name)
CREATE UNIQUE INDEX "player_stats_player_season_league_idx" ON "player_stats" USING btree ("player_id","season","league_name");
