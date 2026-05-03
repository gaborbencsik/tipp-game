ALTER TABLE "teams" ADD COLUMN "external_id" integer UNIQUE;--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN "external_id" integer UNIQUE;--> statement-breakpoint
ALTER TABLE "players" ADD COLUMN "external_id" integer UNIQUE;--> statement-breakpoint
ALTER TABLE "match_results" ALTER COLUMN "recorded_by" DROP NOT NULL;
