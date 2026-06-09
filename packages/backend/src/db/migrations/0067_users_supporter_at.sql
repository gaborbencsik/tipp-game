-- SUPPORTER-001: global supporter status (set by global admin only).
-- The custom migrator wraps this file in BEGIN/COMMIT — do NOT add explicit BEGIN/COMMIT here.

ALTER TABLE "users"
  ADD COLUMN "supporter_at" timestamp with time zone;--> statement-breakpoint

ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'user_supporter_set';
