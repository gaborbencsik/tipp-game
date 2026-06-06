---
id: PUSH-007
title: "Admin push: szegmensszűrés (hiányzó torna tippek, hiányzó meccs tippek)"
priority: Should Have
status: Open
dependencies: [PUSH-001]
complexity: S
epic: E15 – Értesítések (webpush)
---

# PUSH-007: Admin push szegmensszűrés

## Háttér

Az `/admin/push` UI (PUSH-001-ből) jelenleg **minden push-engedélyezett, nem törölt felhasználónak** küld broadcastot — nincs szegmens-választó. A backend `broadcastToAllUsers()` egyetlen célcsoportot ismer: `users.push_enabled = true AND deleted_at IS NULL`.

A 2026 VB-n minden globális speciális típus (8 db: gólkirály, csoport végeredmények, biztos kiesők, stb.) deadline-ja a torna kezdetére esik (2026-06-11). Egyetlen reminderre van szükség — egy automatikus cron (lásd: ~~PUSH-003~~) overkill ennyi típushoz, ha mind ugyanaznapi határidővel rendelkezik. **Egy manuális admin broadcast a deadline előtti napon célszerű, ha lehet csak a hiányzókat célozni.**

Ezzel együtt a meccs-tippekre is hasznos szegmens, ha az admin gyors értesítést akar küldeni a lemaradóknak.

## Story

Mint **admin**, szeretném a `/admin/push` UI-n **kiválasztani, hogy a broadcast kiknek menjen** (összes / hiányzó torna tippes / hiányzó mai meccs tippes), hogy **ne kelljen mindenkinek küldenem értesítést, csak a tényleg érintetteknek**.

## Elfogadási kritériumok

### Frontend – AdminPushView szegmens-választó

- [ ] A meglévő admin push form fölött egy **rádiógomb-csoport** kerül elhelyezésre „Címzettek" címkével, három opcióval:
  1. **„Mindenki"** (default, jelenlegi viselkedés) – `segment: 'all'`
  2. **„Akiknek van hiányzó torna tippje"** – `segment: 'missing-tournament-tips'`
  3. **„Akiknek van hiányzó mai meccs tippje"** – `segment: 'missing-today-match-tips'`
- [ ] A szegmensváltáskor a „Címzettek" számláló (`targetCount`) **automatikusan újratöltődik** a kiválasztott szegmens szerint.
- [ ] A confirm modalban (`window.confirm`) a kiválasztott szegmens neve **megjelenik**: pl. „Biztosan elküldöd ezt az üzenetet 23 felhasználónak (akik hiányzó torna tippekkel rendelkeznek)?"
- [ ] Az utolsó eredmény („Elküldve" zöld kártya) is megjeleníti a használt szegmenst.
- [ ] `data-testid` attribútumok: `admin-push-segment-all`, `admin-push-segment-missing-tournament`, `admin-push-segment-missing-match`, `admin-push-segment-group`.

### Backend – szegmens lekérdezés és validáció

- [ ] `GET /admin/push/targets?segment=<all|missing-tournament-tips|missing-today-match-tips>` – a meglévő endpoint **bővül** a `segment` query paraméterrel, default `'all'`.
- [ ] `POST /admin/push/send` body bővül: `segment: 'all' | 'missing-tournament-tips' | 'missing-today-match-tips'` (default `'all'`).
- [ ] Ismeretlen segment érték → 400 Bad Request validációs hibával.
- [ ] `broadcastToAllUsers()` átnevezése `broadcastToSegment(actorId, input, segment)`-re; a meglévő hívások `'all'` segmentet kapnak.
- [ ] Új belső segéd: `listEligibleUserIdsBySegment(segment)`.
  - `'all'` → jelenlegi `listEligibleUserIds()` viselkedés (push_enabled = true, deleted_at IS NULL).
  - `'missing-tournament-tips'`: az `'all'` szűrésén felül – csak azok a userek, akiknél van **legalább 1 olyan aktív globális speciális típus**, amire **nem adtak le** `special_predictions` bejegyzést.
    - SQL feltétel: `EXISTS (SELECT 1 FROM special_prediction_types t WHERE t.is_global = true AND t.is_active = true AND t.deadline > now() AND NOT EXISTS (SELECT 1 FROM special_predictions sp WHERE sp.type_id = t.id AND sp.user_id = users.id AND sp.deleted_at IS NULL))`.
    - **Lejárt deadline-ú típusokat kizárjuk** – nincs értelme reminderelni.
  - `'missing-today-match-tips'`: az `'all'` szűrésén felül – csak azok a userek, akiknél van **legalább 1 olyan mai (Europe/Budapest) meccs**, amire **nem adtak le** `predictions` bejegyzést, és a meccs `kicked_at IS NULL`.
    - SQL feltétel: `EXISTS (SELECT 1 FROM matches m WHERE m.deleted_at IS NULL AND m.kicked_at IS NULL AND date(m.kickoff_time AT TIME ZONE 'Europe/Budapest') = date(now() AT TIME ZONE 'Europe/Budapest') AND NOT EXISTS (SELECT 1 FROM predictions p WHERE p.match_id = m.id AND p.user_id = users.id AND p.deleted_at IS NULL))`.

### Audit log

- [ ] Az audit log `newValue` payload bővül `segment` mezővel, hogy visszanyomozható legyen melyik szegmensbe ment a push.

### Tesztek

- [ ] **Unit teszt** a `listEligibleUserIdsBySegment()`-re mindhárom szegmensre:
  - `all` → push_enabled false / deleted user kizárva.
  - `missing-tournament-tips` → user akinek van hiányzó aktív globális típus, kerül; minden típusra leadott user nem kerül; lejárt deadline-ú típus nem számít hiánynak.
  - `missing-today-match-tips` → mai hiányzó tippes user kerül; csak tegnapi/holnapi hiányos user nem kerül; minden mai meccsre leadott user nem kerül; `kicked_at` set meccsek nem számítanak.
- [ ] **Integrációs teszt**: `GET /admin/push/targets?segment=missing-tournament-tips` és `POST /admin/push/send` mindhárom szegmenssel.
- [ ] **Komponens teszt** az `AdminPushView.vue`-ra: szegmens-rádiógomb, szegmens-váltáskor `targetCount` újratöltés, payloadban a `segment` érték.

### Edge case-ek

- [ ] **Nincs egyetlen aktív globális speciális típus sem** (`missing-tournament-tips` szegmens) → `targetCount = 0`, a Küldés gomb használható ugyan, de a confirm modal jelzi „0 címzett". Backend nem hibázik.
- [ ] **Nincs ma meccs** (`missing-today-match-tips` szegmens) → `targetCount = 0`.
- [ ] **A user push_enabled = false-ra váltott a számlálás és a küldés között** → a küldéskor szűrt lista a friss; a `targetCount` és a `totalTargets` kissé eltérhet, de mindkettő a saját pillanatában korrekt.

### MVP-ből kizárva (post-MVP külön story)

- Csoport-specifikus szegmens (csak adott `groups.id`-be tartozó userek).
- Frontend live preview a kiválasztott userek névsoráról.
- Több szegmens egyszerre kombinálva (most XOR választás).
- A „mai" definíció finomhangolása user timezone alapján – mindenhol Europe/Budapest.

## Technikai megjegyzések

- Az `'all'` viselkedés visszafelé kompatibilis: ha a régi frontend (cache nélkül) küld `segment` nélküli requestet, a default `'all'` érvényes.
- A SQL feltételek `EXISTS` / `NOT EXISTS` korreláált subquery-vel egyszerűek; PG indexek (`special_predictions(user_id, type_id)`, `predictions(user_id, match_id)`) már léteznek a meglévő migrationökből.
- Frontend api.admin.push.targets és .send szignatúra bővítés `segment` opcionális paraméterrel.

**Komplexitás:** S
**Prioritás:** Should Have

**Kapcsolódás:**
- ~~PUSH-003~~ (won't do – ez a story váltja le; ld. backlog 2026-06-05).
- PUSH-001 admin broadcast erre épül (alap UI + service).
