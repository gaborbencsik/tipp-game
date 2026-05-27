ALTER TABLE "player_stats" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "live_match_states" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "match_insights" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "llm_usage_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE POLICY "authenticated_read_player_stats" ON "player_stats" FOR SELECT TO authenticated USING (true);
    CREATE POLICY "authenticated_read_live_match_states" ON "live_match_states" FOR SELECT TO authenticated USING (true);
    CREATE POLICY "authenticated_read_match_insights" ON "match_insights" FOR SELECT TO authenticated USING (true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE POLICY "service_write_player_stats" ON "player_stats" FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "service_write_live_match_states" ON "live_match_states" FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "service_write_match_insights" ON "match_insights" FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "service_write_llm_usage_log" ON "llm_usage_log" FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
