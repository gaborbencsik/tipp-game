-- SCORER-002: scorer pick storage on predictions and goal scorer set on match_results.
-- The custom migrator wraps this file in BEGIN/COMMIT — do NOT add explicit BEGIN/COMMIT here.

ALTER TABLE "predictions"
  ADD COLUMN "scorer_pick_player_id" uuid REFERENCES "players"("id") ON DELETE RESTRICT;--> statement-breakpoint

ALTER TABLE "predictions"
  ADD COLUMN "scorer_player_name_snapshot" text;--> statement-breakpoint

ALTER TABLE "predictions"
  ADD COLUMN "scorer_bonus_points" smallint;--> statement-breakpoint

CREATE INDEX "predictions_scorer_pick_idx"
  ON "predictions" ("scorer_pick_player_id");--> statement-breakpoint

ALTER TABLE "match_results"
  ADD COLUMN "scorer_player_ids" uuid[] NOT NULL DEFAULT '{}'::uuid[];--> statement-breakpoint

CREATE INDEX "match_results_scorer_ids_idx"
  ON "match_results" USING gin ("scorer_player_ids");
