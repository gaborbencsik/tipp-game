ALTER TABLE "match_results" ADD COLUMN "points_calculated_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "scoring_configs" ADD COLUMN "frozen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sync_state" ADD COLUMN "recalc_in_progress" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_state" ADD COLUMN "last_recalc_result" jsonb;