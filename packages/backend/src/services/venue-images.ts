// Maps a venue name (as returned by API-Football or other sources) to the
// corresponding banner image URL shipped under packages/frontend/public/venues.
// Names are normalized (lowercased, apostrophe + extra whitespace stripped) so
// minor punctuation differences (e.g. curly vs straight apostrophe) still match.

const VENUE_IMAGE_MAP: Readonly<Record<string, string>> = {
  'metlife stadium': '/venues/metlife-stadium.webp',
  'estadio banorte': '/venues/estadio-azteca.webp',
  'estadio azteca': '/venues/estadio-azteca.webp',
  'at&t stadium': '/venues/att-stadium.webp',
  'sofi stadium': '/venues/sofi-stadium.webp',
  'estadio akron': '/venues/estadio-akron.webp',
  'bc place': '/venues/bc-place.webp',
  'hard rock stadium': '/venues/hard-rock-stadium.webp',
  'lincoln financial field': '/venues/lincoln-financial-field.webp',
  'nrg stadium': '/venues/nrg-stadium.webp',
  'lumen field': '/venues/lumen-field.webp',
  'levis stadium': '/venues/levis-stadium.webp',
  'mercedes-benz stadium': '/venues/mercedes-benz-stadium.webp',
  'arrowhead stadium': '/venues/arrowhead-stadium.webp',
  'gillette stadium': '/venues/gillette-stadium.webp',
  'estadio bbva': '/venues/estadio-bbva.webp',
  'bmo field': '/venues/bmo-field.webp',
}

function normalize(name: string): string {
  return name
    .toLowerCase()
    .replace(/[‘’']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizeVenueName(name: string): string {
  return normalize(name)
}

export function lookupVenueImage(name: string): string | null {
  return VENUE_IMAGE_MAP[normalize(name)] ?? null
}
