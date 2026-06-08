-- ADMIN-001: group member paid status (set by global admin only).
-- The custom migrator wraps this file in BEGIN/COMMIT — do NOT add explicit BEGIN/COMMIT here.

ALTER TABLE "group_members"
  ADD COLUMN "paid_at" timestamp with time zone;--> statement-breakpoint

ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'group_member_paid_set';
