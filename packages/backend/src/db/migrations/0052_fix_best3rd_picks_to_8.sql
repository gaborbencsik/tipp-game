-- US-946 prerequisite: WC2026 advances 8 best third-placed teams (not 4).
-- The earlier US-945 seed configured best3rdPicks=4 by mistake; this migration corrects it to 8
-- and updates the description string accordingly. Existing user predictions remain valid: their
-- best3rds array contains 0..4 entries, all of which are still legal under the new options
-- (best3rdPicks is an upper bound; validation only fails on more than max).

DO $$
DECLARE
  expected_id uuid := '44444444-aaaa-bbbb-cccc-000000000945';
BEGIN
  UPDATE "special_prediction_types"
     SET "options" = jsonb_set("options", '{best3rdPicks}', to_jsonb(8)),
         "description" = 'Tippeld meg mind a 12 csoport (A–L) végső sorrendjét és válaszd ki a 8 továbbjutó 3. helyezett csapatot.',
         "updated_at" = now()
   WHERE "id" = expected_id;
END $$;
