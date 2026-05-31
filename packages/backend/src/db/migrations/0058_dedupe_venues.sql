-- Remove duplicate venue rows produced by API-Football sync inserting names
-- that differ only in apostrophe style or whitespace from a seeded row.
-- Per normalized name, keep the oldest row as canonical, re-point any matches
-- referencing a duplicate to the canonical row, then delete the duplicates.
-- Run after 0057 so the canonical rows already have their imageUrl backfilled.

WITH normalized AS (
  SELECT id, created_at,
    TRIM(REGEXP_REPLACE(REGEXP_REPLACE(LOWER("name"), '[''‘’]', '', 'g'), '\s+', ' ', 'g')) AS norm_name
  FROM "venues"
),
canonical AS (
  SELECT DISTINCT ON (norm_name) id AS canonical_id, norm_name
  FROM normalized
  ORDER BY norm_name, created_at ASC
),
duplicates AS (
  SELECT n.id AS duplicate_id, c.canonical_id
  FROM normalized n
  JOIN canonical c ON c.norm_name = n.norm_name AND c.canonical_id <> n.id
)
UPDATE "matches"
SET "venue_id" = d.canonical_id
FROM duplicates d
WHERE "matches"."venue_id" = d.duplicate_id;

WITH normalized AS (
  SELECT id, created_at,
    TRIM(REGEXP_REPLACE(REGEXP_REPLACE(LOWER("name"), '[''‘’]', '', 'g'), '\s+', ' ', 'g')) AS norm_name
  FROM "venues"
),
canonical AS (
  SELECT DISTINCT ON (norm_name) id AS canonical_id, norm_name
  FROM normalized
  ORDER BY norm_name, created_at ASC
)
DELETE FROM "venues"
WHERE id IN (
  SELECT n.id
  FROM normalized n
  JOIN canonical c ON c.norm_name = n.norm_name AND c.canonical_id <> n.id
);
