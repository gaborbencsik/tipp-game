-- PUSH-008: per-cron toggles for automatic push reminders.
-- The custom migrator wraps this file in BEGIN/COMMIT — do NOT add explicit BEGIN/COMMIT here.

CREATE TABLE "push_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "kickoff_reminder_enabled" boolean NOT NULL DEFAULT true,
  "daily_review_enabled" boolean NOT NULL DEFAULT true,
  "updated_at" timestamp with time zone NOT NULL DEFAULT now()
);--> statement-breakpoint

INSERT INTO "push_settings" ("kickoff_reminder_enabled", "daily_review_enabled") VALUES (true, true);
