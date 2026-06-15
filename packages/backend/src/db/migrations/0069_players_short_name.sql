-- US-1313: players short_name column.
-- Stores the api-football short / common name (e.g. "Rodrygo", "Vinícius Júnior")
-- alongside the existing `name` column which holds the full firstname+lastname form.
-- The custom migrator wraps this file in BEGIN/COMMIT — do NOT add explicit BEGIN/COMMIT here.

ALTER TABLE "players"
  ADD COLUMN "short_name" varchar(100);
