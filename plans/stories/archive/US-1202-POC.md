# US-1202-POC: Football API Integration Proof of Concept

> Epic: E12 – Automatikus adatszinkron

**Story:**
Mint **fejlesztő**, szeretnék egy egyszeri POC scriptet futtatni az api-football.com ellen, hogy **validáljam: a 2 szükséges liga (WC 2026, NB I) elérhető, a response struktúra megfelel a schemánknak, és a rate limitek tarthatóak**.

**Scope – BENNE VAN:**
- One-shot script: `packages/backend/scripts/football-api-poc.ts` (futtatás: `FOOTBALL_API_KEY=xxx npx tsx scripts/football-api-poc.ts`)
- Fetch fixtures: WC 2026, NB I
- Fetch teams: WC 2026
- Fetch egy befejezett meccs eredménye — response shape validáció
- Response mentés fixture fájlokba: `packages/backend/tests/fixtures/api-football-*.json`
- Rate limit headerek logolása
- Összefoglaló output: pass/fail minden validációra
- `plans/api-football-ids.md` — megerősített liga ID-k, season paraméterek, quirks

**Scope – NINCS BENNE:**
- Nincs DB írás
- Nincs retry/backoff logika
- Nincs service absztrakció
- Nincs unit teszt (ez maga A teszt)

**Elfogadási kritériumok:**
- [ ] Script csatlakozik az api-football.com-hoz valódi API key-jel
- [ ] WC 2026 fixtures endpoint visszaad jövőbeli meccseket (teams, dates, venues)
- [ ] NB I liga elérhető és fixtures-t ad vissza
- [ ] Befejezett meccs response tartalmaz: `goals.home`, `goals.away`, helyes status
- [ ] Teams endpoint visszaad: name, logo/flag URL, numeric ID
- [ ] Liga ID-k dokumentálva: `plans/api-football-ids.md`
- [ ] Adathiányok/quirk-ök dokumentálva (pl. csapatnév formátum, hiányzó venue, stage mapping)
- [ ] Fixture JSON fájlok commitolva: `packages/backend/tests/fixtures/`
- [ ] Rate limit headerek logolva — Free tier (100 req/nap) elegendő a POC-hoz

**Output artifacts:**
- `packages/backend/scripts/football-api-poc.ts`
- `packages/backend/tests/fixtures/api-football-fixtures-wc.json`
- `packages/backend/tests/fixtures/api-football-fixtures-nbi.json`
- `packages/backend/tests/fixtures/api-football-teams-wc.json`
- `plans/api-football-ids.md`

**Mock API terv (US-1202-hez):**
A POC-ból kimentett fixture JSON-ök lesznek a fake API alapja:
- `football-api.fake.ts` — `FootballApiClient` interface implementáció, fixture fájlokból olvas
- `FOOTBALL_API_MODE=fake` env var → fake adapter-re vált
- Nem kell MSW, JSON server, vagy Docker — zero infra

**Komplexitás:** S (fél nap)
**Prioritás:** Should Have (blocker US-1202-höz)
**Függőség:** US-1201 (kész) + aktív API key (free tier elég)

---

## Kérdések amiket a POC válaszol meg

1. A WC 2026 adatok már elérhetőek, vagy csak a season indulása után?
2. Az NB I liga ID valóban 271?
3. A venue adatok konzisztensek (van-e null venue)?
4. A team logo URL-ek használhatóak flag_url-ként?
5. A `league.round` mező hogyan mappelhető a `stage` + `groupName` mezőkre?
6. Van-e `match_number` megfelelő mező az API-ban?

## Blokkoló schema kérdések (US-1202 előtt megoldandó)

- `matches.external_id INTEGER` (nullable, partial unique) — fixture ID tárolás
- `teams.external_id INTEGER` (nullable, partial unique) — team ID tárolás
- `match_results.recorded_by` — jelenleg NOT NULL users FK. Sync-hez: system user VAGY nullable
