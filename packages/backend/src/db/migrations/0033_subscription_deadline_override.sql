ALTER TABLE "group_global_type_subscriptions" ADD COLUMN IF NOT EXISTS "deadline_override" timestamp with time zone;
