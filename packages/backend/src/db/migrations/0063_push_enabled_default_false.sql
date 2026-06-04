-- PUSH-001: change push_enabled default to false (opt-in).
-- The custom migrator wraps this file in BEGIN/COMMIT — do NOT add explicit BEGIN/COMMIT here.

ALTER TABLE "users" ALTER COLUMN "push_enabled" SET DEFAULT false;--> statement-breakpoint
UPDATE "users" SET "push_enabled" = false WHERE "push_enabled" = true;
