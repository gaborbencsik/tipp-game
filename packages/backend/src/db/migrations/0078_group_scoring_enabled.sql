-- US-956: per-group scoring toggle. scoring_enabled defaults to true so
-- existing groups keep their current behaviour (scoring ENABLED). When set
-- to false the scoring service skips the group; existing
-- group_prediction_points rows are preserved (not deleted).

ALTER TABLE "groups"
  ADD COLUMN IF NOT EXISTS "scoring_enabled" boolean DEFAULT true NOT NULL;
