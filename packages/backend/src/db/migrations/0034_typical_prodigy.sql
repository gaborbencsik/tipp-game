CREATE TABLE "live_match_states" (
	"match_id" uuid PRIMARY KEY NOT NULL,
	"home_score" smallint NOT NULL,
	"away_score" smallint NOT NULL,
	"minute" smallint,
	"api_status" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "live_match_states" ADD CONSTRAINT "live_match_states_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;
