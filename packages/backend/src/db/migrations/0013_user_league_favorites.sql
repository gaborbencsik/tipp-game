CREATE TABLE "user_league_favorites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"league_id" uuid NOT NULL,
	"team_id" uuid NOT NULL,
	"set_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user_league_favorites" ADD CONSTRAINT "user_league_favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_league_favorites" ADD CONSTRAINT "user_league_favorites_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_league_favorites" ADD CONSTRAINT "user_league_favorites_team_id_teams_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "ulf_user_league_unique" ON "user_league_favorites" USING btree ("user_id","league_id");
--> statement-breakpoint
CREATE INDEX "ulf_user_idx" ON "user_league_favorites" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "ulf_league_idx" ON "user_league_favorites" USING btree ("league_id");
