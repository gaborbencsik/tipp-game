CREATE TABLE "sync_state" (
  "id"                       uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "mode"                     text NOT NULL DEFAULT 'off',
  "last_successful_sync_at"  timestamp with time zone,
  "api_calls_today"          integer NOT NULL DEFAULT 0,
  "api_calls_date"           text NOT NULL DEFAULT '',
  "sync_in_progress"         boolean NOT NULL DEFAULT false,
  "updated_at"              timestamp with time zone NOT NULL DEFAULT now()
);
