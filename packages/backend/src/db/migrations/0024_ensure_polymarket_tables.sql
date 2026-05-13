-- Idempotent guard: ensure match_market_data and polymarket_slug exist
-- regardless of prior migration state
CREATE TABLE IF NOT EXISTS "match_market_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"match_id" uuid NOT NULL,
	"source" text DEFAULT 'polymarket' NOT NULL,
	"home_win" double precision NOT NULL,
	"draw" double precision,
	"away_win" double precision NOT NULL,
	"one_day_change_home" double precision,
	"one_day_change_draw" double precision,
	"one_day_change_away" double precision,
	"one_week_change_home" double precision,
	"one_week_change_draw" double precision,
	"one_week_change_away" double precision,
	"market_volume" double precision,
	"market_liquidity" double precision,
	"best_bid_home" double precision,
	"best_ask_home" double precision,
	"last_trade_price_home" double precision,
	"competitive" double precision,
	"context_description" text,
	"raw_payload" jsonb,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "matches" ADD COLUMN IF NOT EXISTS "polymarket_slug" text;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'match_market_data_match_id_matches_id_fk') THEN
    ALTER TABLE "match_market_data" ADD CONSTRAINT "match_market_data_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_match_market_data_match_fetched" ON "match_market_data" USING btree ("match_id","fetched_at");
