ALTER TABLE "match_market_data" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "sync_state" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "authenticated_read" ON "match_market_data" FOR SELECT TO authenticated USING (true);--> statement-breakpoint
CREATE POLICY "service_write" ON "match_market_data" FOR ALL TO service_role USING (true) WITH CHECK (true);--> statement-breakpoint
CREATE POLICY "authenticated_read" ON "sync_state" FOR SELECT TO authenticated USING (true);--> statement-breakpoint
CREATE POLICY "service_write" ON "sync_state" FOR ALL TO service_role USING (true) WITH CHECK (true);
