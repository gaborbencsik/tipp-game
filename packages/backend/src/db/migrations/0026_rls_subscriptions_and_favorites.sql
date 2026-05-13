ALTER TABLE "group_global_type_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "user_league_favorites" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE POLICY "authenticated_read_subscriptions" ON "group_global_type_subscriptions" FOR SELECT TO authenticated USING (true);
    CREATE POLICY "authenticated_read_favorites" ON "user_league_favorites" FOR SELECT TO authenticated USING (true);
    CREATE POLICY "authenticated_write_favorites" ON "user_league_favorites" FOR INSERT TO authenticated WITH CHECK (true);
    CREATE POLICY "authenticated_delete_favorites" ON "user_league_favorites" FOR DELETE TO authenticated USING (true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE POLICY "service_write_subscriptions" ON "group_global_type_subscriptions" FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "service_write_favorites" ON "user_league_favorites" FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
