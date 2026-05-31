-- Set venue_id for the three pre-WC friendly matches that synced without
-- venue info. Match by team short codes + scheduled date so the migration is
-- idempotent and works across environments where match UUIDs differ.
-- Venues are looked up by name (apostrophe-tolerant) for the same reason.

-- Qatar vs Switzerland (2026-06-13) → Levi's Stadium
UPDATE "matches" m
SET "venue_id" = v.id
FROM "venues" v, "teams" h, "teams" a
WHERE m."home_team_id" = h.id
  AND m."away_team_id" = a.id
  AND h."short_code" = 'QAT'
  AND a."short_code" = 'SWI'
  AND m."scheduled_at"::date = DATE '2026-06-13'
  AND TRIM(REGEXP_REPLACE(LOWER(v."name"), '[''‘’]', '', 'g')) = 'levis stadium'
  AND m."venue_id" IS NULL;

-- Netherlands vs Japan (2026-06-14) → AT&T Stadium
UPDATE "matches" m
SET "venue_id" = v.id
FROM "venues" v, "teams" h, "teams" a
WHERE m."home_team_id" = h.id
  AND m."away_team_id" = a.id
  AND h."short_code" = 'NET'
  AND a."short_code" = 'JAP'
  AND m."scheduled_at"::date = DATE '2026-06-14'
  AND LOWER(v."name") = 'at&t stadium'
  AND m."venue_id" IS NULL;

-- Japan vs Sweden (2026-06-25) → AT&T Stadium
UPDATE "matches" m
SET "venue_id" = v.id
FROM "venues" v, "teams" h, "teams" a
WHERE m."home_team_id" = h.id
  AND m."away_team_id" = a.id
  AND h."short_code" = 'JAP'
  AND a."short_code" = 'SWE'
  AND m."scheduled_at"::date = DATE '2026-06-25'
  AND LOWER(v."name") = 'at&t stadium'
  AND m."venue_id" IS NULL;
