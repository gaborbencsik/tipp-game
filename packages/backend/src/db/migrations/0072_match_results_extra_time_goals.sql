-- BUG-011: knockout matches now store 90-minute score in home_goals/away_goals
-- and the (optional) full-time-after-extra-time score in the new columns.
-- outcome_after_draw stays as the single source of truth for ET vs PK
-- (extra_time_home/away or penalties_home/away when the match was drawn at 90').

ALTER TABLE "match_results"
  ADD COLUMN "extra_time_home_goals" smallint;--> statement-breakpoint

ALTER TABLE "match_results"
  ADD COLUMN "extra_time_away_goals" smallint;
