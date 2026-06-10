-- SECURITY: enable RLS on push_* tables flagged by Supabase database linter
-- (rls_disabled_in_public). These tables are backend-only — no frontend
-- Supabase client access — so we add a service_role policy for safety and
-- intentionally do NOT grant access to the authenticated/anon roles.

ALTER TABLE "push_settings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "push_subscriptions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "push_notification_log" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE POLICY "service_write_push_settings" ON "push_settings" FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "service_write_push_subscriptions" ON "push_subscriptions" FOR ALL TO service_role USING (true) WITH CHECK (true);
    CREATE POLICY "service_write_push_notification_log" ON "push_notification_log" FOR ALL TO service_role USING (true) WITH CHECK (true);
  END IF;
END $$;
