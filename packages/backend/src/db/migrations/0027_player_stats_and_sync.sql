CREATE TABLE IF NOT EXISTS "player_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"player_id" uuid NOT NULL,
	"season" smallint NOT NULL,
	"league_id" integer NOT NULL,
	"league_name" varchar(100),
	"appearances" smallint DEFAULT 0 NOT NULL,
	"goals" smallint DEFAULT 0 NOT NULL,
	"assists" smallint DEFAULT 0 NOT NULL,
	"conceded" smallint DEFAULT 0 NOT NULL,
	"passes" integer DEFAULT 0 NOT NULL,
	"key_passes" smallint DEFAULT 0 NOT NULL,
	"pass_accuracy" smallint,
	"duels_total" integer DEFAULT 0 NOT NULL,
	"duels_won" integer DEFAULT 0 NOT NULL,
	"yellow_cards" smallint DEFAULT 0 NOT NULL,
	"red_cards" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'player_stats_player_id_players_id_fk') THEN
    ALTER TABLE "player_stats" ADD CONSTRAINT "player_stats_player_id_players_id_fk" FOREIGN KEY ("player_id") REFERENCES "public"."players"("id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "player_stats_player_season_league_idx" ON "player_stats" USING btree ("player_id","season","league_id");--> statement-breakpoint
ALTER TABLE "sync_state" ADD COLUMN IF NOT EXISTS "player_sync_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "sync_state" ADD COLUMN IF NOT EXISTS "last_player_sync_at" timestamp with time zone;
