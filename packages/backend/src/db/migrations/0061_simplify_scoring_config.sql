-- SCORING-001: hard cut to 3-field stackable scoring + leagues.starts_at.
-- The custom migrator wraps this file in BEGIN/COMMIT — do NOT add explicit BEGIN/COMMIT here.
-- Statements are split on the statement-breakpoint token.

ALTER TABLE "leagues" ADD COLUMN "starts_at" timestamp with time zone;--> statement-breakpoint

ALTER TABLE "scoring_configs"
  DROP COLUMN "correct_winner_and_diff",
  DROP COLUMN "correct_winner",
  DROP COLUMN "correct_draw",
  DROP COLUMN "incorrect",
  DROP COLUMN "frozen_at";--> statement-breakpoint

ALTER TABLE "scoring_configs" RENAME COLUMN "exact_score" TO "exact_bonus_points";--> statement-breakpoint
ALTER TABLE "scoring_configs" RENAME COLUMN "correct_outcome" TO "correct_outcome_points";--> statement-breakpoint

ALTER TABLE "scoring_configs"
  ADD COLUMN "extra_time_bonus_points" smallint NOT NULL DEFAULT 1;--> statement-breakpoint

UPDATE "scoring_configs" SET
  "exact_bonus_points" = 1,
  "correct_outcome_points" = 1,
  "extra_time_bonus_points" = 1;
