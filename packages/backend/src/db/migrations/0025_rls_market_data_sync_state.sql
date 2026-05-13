ALTER TABLE "match_market_data" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sync_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE POLICY "authenticated_read" ON "match_market_data" FOR SELECT TO authenticated USING (true);
    CREATE POLICY "authenticated_read" ON "sync_state" FOR SELECT TO authenticated USING (true);
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE POLICY "service_write" ON "match_market_data" FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "service_write" ON "sync_state" FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
