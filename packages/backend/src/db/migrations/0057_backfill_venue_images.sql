-- Backfill imageUrl for venues created via API-Football sync where the name
-- matches a known WC2026 venue. The match is normalized (lowercase, apostrophes
-- removed, whitespace collapsed) so curly apostrophes ("Levi’s") and other
-- minor punctuation differences still resolve to the seeded image.

UPDATE "venues" v
SET "image_url" = m."image_url"
FROM (VALUES
  ('metlife stadium',         '/venues/metlife-stadium.webp'),
  ('estadio banorte',         '/venues/estadio-azteca.webp'),
  ('estadio azteca',          '/venues/estadio-azteca.webp'),
  ('at&t stadium',            '/venues/att-stadium.webp'),
  ('sofi stadium',            '/venues/sofi-stadium.webp'),
  ('estadio akron',           '/venues/estadio-akron.webp'),
  ('bc place',                '/venues/bc-place.webp'),
  ('hard rock stadium',       '/venues/hard-rock-stadium.webp'),
  ('lincoln financial field', '/venues/lincoln-financial-field.webp'),
  ('nrg stadium',             '/venues/nrg-stadium.webp'),
  ('lumen field',             '/venues/lumen-field.webp'),
  ('levis stadium',           '/venues/levis-stadium.webp'),
  ('mercedes-benz stadium',   '/venues/mercedes-benz-stadium.webp'),
  ('arrowhead stadium',       '/venues/arrowhead-stadium.webp'),
  ('gillette stadium',        '/venues/gillette-stadium.webp'),
  ('estadio bbva',            '/venues/estadio-bbva.webp'),
  ('bmo field',               '/venues/bmo-field.webp')
) AS m(normalized_name, image_url)
WHERE TRIM(REGEXP_REPLACE(LOWER(v."name"), '[''‘’]', '', 'g')) = m.normalized_name
  AND (v."image_url" IS NULL OR v."image_url" = '');
