CREATE TYPE "public"."insight_type" AS ENUM('raw_stats', 'defense', 'attack', 'form', 'set_pieces', 'key_matchup', 'fatigue', 'historical');--> statement-breakpoint
CREATE TABLE "match_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"type" "insight_type" NOT NULL,
	"data" jsonb NOT NULL,
	"summary" varchar(200),
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"version" smallint DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_insights" ADD CONSTRAINT "match_insights_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "match_insights_match_id_type_idx" ON "match_insights" USING btree ("match_id","type");--> statement-breakpoint
CREATE INDEX "match_insights_match_id_idx" ON "match_insights" USING btree ("match_id");