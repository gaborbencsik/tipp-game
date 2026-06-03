-- PUSH-001 Phase 1: webpush infrastruktúra DB schema.
-- The custom migrator wraps this file in BEGIN/COMMIT — do NOT add explicit BEGIN/COMMIT here.
-- Statements are split on the statement-breakpoint token.

ALTER TYPE "audit_action" ADD VALUE IF NOT EXISTS 'push_send';--> statement-breakpoint

CREATE TYPE "push_notification_type" AS ENUM (
  'match_kickoff_reminder',
  'tournament_tip_deadline',
  'daily_match_review',
  'admin_broadcast'
);--> statement-breakpoint

CREATE TYPE "push_skipped_reason" AS ENUM (
  'quiet_hours',
  'rate_limit',
  'push_disabled',
  'no_subscription'
);--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN "push_enabled" boolean NOT NULL DEFAULT true;--> statement-breakpoint

CREATE TABLE "push_subscriptions" (
  "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"      uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "endpoint"     text NOT NULL,
  "auth"         text NOT NULL,
  "p256dh"       text NOT NULL,
  "user_agent"   text,
  "created_at"   timestamp with time zone NOT NULL DEFAULT now(),
  "last_used_at" timestamp with time zone,
  "deleted_at"   timestamp with time zone
);--> statement-breakpoint

CREATE UNIQUE INDEX "push_sub_user_endpoint_unique" ON "push_subscriptions" ("user_id", "endpoint");--> statement-breakpoint
CREATE INDEX "push_sub_user_idx" ON "push_subscriptions" ("user_id");--> statement-breakpoint

CREATE TABLE "push_notification_log" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id"        uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type"           "push_notification_type" NOT NULL,
  "scope_key"      text,
  "endpoint"       text,
  "sent_at"        timestamp with time zone NOT NULL DEFAULT now(),
  "clicked_at"     timestamp with time zone,
  "skipped_reason" "push_skipped_reason"
);--> statement-breakpoint

CREATE UNIQUE INDEX "push_log_user_type_scope_unique" ON "push_notification_log" ("user_id", "type", "scope_key");--> statement-breakpoint
CREATE INDEX "push_log_user_idx" ON "push_notification_log" ("user_id");--> statement-breakpoint
CREATE INDEX "push_log_sent_at_idx" ON "push_notification_log" ("sent_at");
