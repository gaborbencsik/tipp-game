-- Rename tournament tip display names per UX feedback (no schema change).

UPDATE "special_prediction_types"
SET "name" = 'Egyenes kiesés'
WHERE "input_type" = 'bracket_progression'
  AND "name" = 'Bracket-progresszió';

UPDATE "special_prediction_types"
SET "name" = 'Biztos kiesők'
WHERE "input_type" = 'multi_team_weighted'
  AND "name" = 'Upset Special – kiesett csapatok';
