CREATE TABLE "group_leagues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"league_id" uuid NOT NULL,
	"added_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "group_leagues" ADD CONSTRAINT "group_leagues_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "group_leagues" ADD CONSTRAINT "group_leagues_league_id_leagues_id_fk" FOREIGN KEY ("league_id") REFERENCES "public"."leagues"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "group_leagues_unique" ON "group_leagues" USING btree ("group_id","league_id");--> statement-breakpoint
CREATE INDEX "group_leagues_group_idx" ON "group_leagues" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "group_leagues_league_idx" ON "group_leagues" USING btree ("league_id");
