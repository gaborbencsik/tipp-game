ALTER TABLE "sync_state" ADD COLUMN "raw_stats_sync_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_state" ADD COLUMN "last_raw_stats_sync_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "sync_state" ADD COLUMN "raw_stats_skip_fresh" boolean DEFAULT false NOT NULL;