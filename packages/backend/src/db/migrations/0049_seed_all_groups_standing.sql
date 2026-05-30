-- US-945: Group standings global type — all_groups_standing single record covering all 12 groups + 4 best 3rd picks.
-- Derives the groups list dynamically from distinct non-null teams.group values.
-- Skipped if no groups exist (fresh dev environments without team seed).

DO $$
DECLARE
  group_codes jsonb;
  expected_id uuid := '44444444-aaaa-bbbb-cccc-000000000945';
BEGIN
  IF EXISTS (SELECT 1 FROM "special_prediction_types" WHERE "id" = expected_id) THEN
    RETURN;
  END IF;

  SELECT jsonb_agg(g ORDER BY g)
    INTO group_codes
    FROM (
      SELECT DISTINCT "group" AS g
        FROM "teams"
       WHERE "group" IS NOT NULL
         AND "team_type" = 'national'
    ) sub;

  IF group_codes IS NULL OR jsonb_array_length(group_codes) = 0 THEN
    RAISE NOTICE 'US-945 seed skipped: no groups found in teams table';
    RETURN;
  END IF;

  INSERT INTO "special_prediction_types" (
    "id", "group_id", "name", "description", "input_type",
    "deadline", "points", "is_global", "is_active", "options"
  ) VALUES (
    expected_id,
    NULL,
    'Csoport végeredmény',
    'Tippeld meg mind a 12 csoport (A–L) végső sorrendjét és válaszd ki a 4 továbbjutó 3. helyezett csapatot.',
    'all_groups_standing',
    '2026-06-11 02:00:00+00',
    0,
    true,
    true,
    jsonb_build_object(
      'groups', group_codes,
      'teamsPerGroup', 4,
      'best3rdPicks', 4
    )
  );
END $$;
