-- US-945 follow-up: ensure all_groups_standing options always cover the canonical 12 groups (A-L).
-- The earlier 0049 seed used a dynamic SELECT DISTINCT teams.group snapshot which could miss groups
-- that hadn't been populated yet. This migration overwrites the options with the canonical list and
-- inserts the row if it was previously skipped.

DO $$
DECLARE
  expected_id uuid := '44444444-aaaa-bbbb-cccc-000000000945';
  canonical_options jsonb := jsonb_build_object(
    'groups', jsonb_build_array('A','B','C','D','E','F','G','H','I','J','K','L'),
    'teamsPerGroup', 4,
    'best3rdPicks', 4
  );
BEGIN
  IF EXISTS (SELECT 1 FROM "special_prediction_types" WHERE "id" = expected_id) THEN
    UPDATE "special_prediction_types"
       SET "options" = canonical_options,
           "updated_at" = now()
     WHERE "id" = expected_id;
  ELSE
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
      canonical_options
    );
  END IF;
END $$;
