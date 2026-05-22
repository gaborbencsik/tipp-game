CREATE TABLE "insight_reveals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"match_id" uuid NOT NULL,
	"revealed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "insight_reveals" ADD CONSTRAINT "insight_reveals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "insight_reveals" ADD CONSTRAINT "insight_reveals_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "insight_reveals_user_match_unique" ON "insight_reveals" USING btree ("user_id","match_id");--> statement-breakpoint
CREATE INDEX "insight_reveals_match_idx" ON "insight_reveals" USING btree ("match_id");--> statement-breakpoint
ALTER TABLE "insight_reveals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE POLICY "authenticated_read_reveals" ON "insight_reveals" FOR SELECT TO authenticated USING (true);
    CREATE POLICY "authenticated_write_reveals" ON "insight_reveals" FOR INSERT TO authenticated WITH CHECK (true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE POLICY "service_write_reveals" ON "insight_reveals" FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;