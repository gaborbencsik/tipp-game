-- US-956: Per-league on-demand sync. Adds a dedicated audit action so every
-- manual per-league sync trigger is recorded (entity_type = 'league').
-- The custom migrator wraps this file in BEGIN/COMMIT — do NOT add explicit BEGIN/COMMIT here.

ALTER TYPE "public"."audit_action" ADD VALUE IF NOT EXISTS 'league_sync_run';
