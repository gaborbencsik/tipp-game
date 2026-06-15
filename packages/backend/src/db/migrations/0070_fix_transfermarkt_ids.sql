-- Fix transfermarkt_id values seeded in 0028_transfermarkt_market_value.sql.
-- The original seed had three off-by-one IDs (ESP/POR/ENG were each shifted to the
-- neighbouring transfermarkt verein), so the team-name link on match pages opened the
-- wrong national team (ESP → Hungary, POR → Spain, ENG → Portugal).
-- Verified IDs against transfermarkt.com:
--   3299 = England, 3300 = Portugal, 3375 = Spain, 3468 = Hungary
-- The custom migrator wraps this file in BEGIN/COMMIT — do NOT add explicit BEGIN/COMMIT here.

UPDATE "teams" SET "transfermarkt_id" = 3375 WHERE "short_code" = 'ESP' AND "team_type" = 'national';
UPDATE "teams" SET "transfermarkt_id" = 3375 WHERE "short_code" = 'SPA' AND "team_type" = 'national';
UPDATE "teams" SET "transfermarkt_id" = 3300 WHERE "short_code" = 'POR' AND "team_type" = 'national';
UPDATE "teams" SET "transfermarkt_id" = 3299 WHERE "short_code" = 'ENG' AND "team_type" = 'national';
