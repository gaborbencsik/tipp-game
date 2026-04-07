ALTER TABLE "match_results" ADD COLUMN "outcome_after_draw" text;--> statement-breakpoint
ALTER TABLE "predictions" ADD COLUMN "outcome_after_draw" text;--> statement-breakpoint
ALTER TABLE "scoring_configs" ADD COLUMN "correct_outcome" smallint DEFAULT 1 NOT NULL;