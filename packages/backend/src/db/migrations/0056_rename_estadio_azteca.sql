-- Rename the Estadio Azteca venue to Estadio Banorte (sponsorship rename) and
-- ensure the venue banner image keeps rendering. Covers both pre-rename rows
-- still named "Estadio Azteca" and any post-rename rows that were created via
-- API-Football sync without an imageUrl set.

UPDATE "venues"
SET "name" = 'Estadio Banorte',
    "image_url" = '/venues/estadio-azteca.webp'
WHERE "name" = 'Estadio Azteca';

UPDATE "venues"
SET "image_url" = '/venues/estadio-azteca.webp'
WHERE "name" = 'Estadio Banorte'
  AND ("image_url" IS NULL OR "image_url" = '');
