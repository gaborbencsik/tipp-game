---
id: SCORER-001-council-review
title: "Council of High Intelligence – SCORER-001 tervek áttekintése"
type: review
status: open
related:
  - SCORER-001
  - SCORER-001-ux
  - SCORER-001-arch
  - SCORER-001-api-research
date: 2026-06-07
council:
  mode: quick (3-tag triád)
  members:
    - Aristotle (kategorizáció, hiányzó esetek)
    - Ada Lovelace (formális ellentmondások, idempotencia, invariánsok)
    - Richard Feynman (egyszerűsítés, first-principles)
  chairman: opus (single-provider fallback)
---

# Council Verdict — SCORER-001 tervek áttekintése

A 3 tagú council (Aristotle + Ada + Feynman) áttekintette a 4 dokumentumot:
`SCORER-001.md`, `SCORER-001-ux.md`, `SCORER-001-arch.md`, `SCORER-001-api-research.md`.

Mindegyik tag egymástól függetlenül ugyanarra a két kritikus inkonzisztenciára futott rá:
(a) az `arch` és az `api-research` két különböző tábla-koncepciót ír le ugyanarra a célra,
(b) a `predictions.homeGoals/awayGoals NOT NULL` séma ütközik a "csak góllövő tipp is leadható"
UX-ígérettel.

---

## 🔴 Kritikus ellentmondások (merge előtt fixálandó)

### 1. Két párhuzamos tábla ugyanarra a célra (3 tag jelezte)

- `arch §3.1` → `match_goal_scorers (match_id, player_id, goal_count, is_shootout)` — **per-játékos aggregált** (UNIQUE: `match_id, player_id`)
- `api-research §5.1` → `match_scorer_events (match_id, player_id, external_player_id, minute, extra_minute, detail, cancelled, raw_event)` — **per-esemény raw** (UNIQUE: `match_id, externalPlayerId, minute, …`)
- A `SCORER-001.md §6/§8` az `arch` változatra hivatkozik, de a VAR-cancel és re-attribution workflow csak az event-szintű változattal működik.
- **Javaslat (Feynman)**: csak a `match_scorer_events` (raw_event jsonb) maradjon — a shootout sorokat be se szúrjuk, így az `is_shootout` flag is törölhető. Az aggregátumot a kiértékelő pure függvény számolja.

### 2. Új mezők neve nem konzisztens 3 dokumentum között

| arch | api-research | story |
|---|---|---|
| `topScorerPlayerId` | `scorerPlayerId` | `topScorerPlayerId` |
| `scorerBonusPoints` | `scorerPointsAwarded` | `scorerBonusPoints` |
| — | `scorerEvaluatedAt` | — |

- **Javaslat**: egységes nevezéktan; a `scorerEvaluatedAt` valószínűleg törölhető (Feynman: `scorer_bonus_points IS NULL` ugyanazt jelenti).

### 3. Sémagap: "csak góllövő tipp is leadható" ↔ `predictions.homeGoals/awayGoals NOT NULL`

- A `SCORER-001.md §5`, `UX §3` explicit ígéret a parciális tippre.
- A jelenlegi schema `homeGoals: smallint NOT NULL`. A `0065` migration nem említi ezt.
- **Javaslat**: vagy `homeGoals/awayGoals NULLABLE` migration is bekerül (törő változás a meglévő invariánsokra), vagy a story §5 szabályt revízióra kell venni ("tipphez kell mindkettő"). User döntés szükséges — érintheti a meglévő tippeket is.

---

## 🟡 Logikai / formális rések

### 4. Idempotencia szivárgás: `scoring_configs.scorer_bonus_points` post-finalize mutáció

- Ha admin a meccs lezárása UTÁN átállítja 1→2, a következő recalc a leaderboardot retroaktívan átírja.
- **Javaslat (Ada)**: vagy a config lock-olódik `pointsCalculatedAt IS NOT NULL` után, vagy a `predictions` táblában snapshot-mező őrzi az értékeléskor érvényes pontot.

### 5. `isShootoutEvent` 3. szabálya false-positive ET-büntetőre

- `elapsed === null + type=Goal + detail==="Penalty"` → ha az api-football ET-ben adott büntetőre is null-t ad (lehetséges, lásd `api-research §10`), egy 105. perc ET-büntetőt shootoutnak nyilvánít → 0 pont.
- **Javaslat**: keresztellenőrzés `fixture.status.short === "PEN"` — ha a fixture nem PEN-nel végződött, az `isShootoutEvent` mindig false.

### 6. `players` táblának nincs soft delete, de a 0065 `ON DELETE SET NULL`-t használ

- Hard-delete egy lezárt meccs UTÁN → `top_scorer_player_id` NULL, de `scorer_bonus_points` megmarad → UI "[+1] · ?" anomália.
- **Javaslat**: `ON DELETE RESTRICT` vagy `scorer_player_name_snapshot` text mező a `predictions`-ben. A `match_scorer_events.player_id` is RESTRICT legyen (audit-szempontból kötelező).

---

## 🟠 Hiányzó kategóriák / dokumentálatlan esetek

### 7. Csoport-szintű (groups) override-nak nincs tárolóhelye

- A projekt csoportonkénti `scoring_configs` override-ot támogat (`calculateAndSaveGroupPoints`).
- A tervek egyetlen `predictions.scorer_bonus_points` mezőbe írnak — itt nincs hova tárolni a csoportonként eltérő bónuszt. Vagy a `prediction_group_points`-ot (ha létezik) kell bővíteni, vagy v1-re kimondani: "globális szintű bónusz, csoport override nem támogatott".
- **Javaslat (Feynman + Aristotle)**: v1-re hardcoded `1`, kimondva nincs csoport override — egyszerűsíti a sémát is.

### 8. `favoriteTeamMultiplier` interakció

- A `applyFavoriteTeamMultiplier` a meccs pontot megszorozza. A scorer +1 multiplier-elendő-e? (kedvenc csapat játékosa = +2?)
- **Javaslat**: kimondani a story-ban — alapértelmezetten **NEM**, fix +1 marad (egyszerűbb, és a "kedvenc csapat" UX más mentális modell).

### 9. Edge state-ek nincsenek nevesítve

- Cancelled / abandoned meccs → `scorerBonusPoints = NULL` vagy `0`?
- Walkover / forfeit (gól nélkül eldől) → a `match_scorer_events` üres → 0 pont — explicit kimondani.
- Replay / megismételt meccs → a unique index ezt nem kezeli.

### 10. UX / API kérdés: deadline-előtti keret-kikerülés frissítés

- Story `text-amber-600` figyelmeztetést mond, de mikor frissül a select listája? Polling? SSE? Manual reload?
- **Javaslat**: kimondani — manual reload v1-re elég.

---

## 🟢 Egyszerűsítési javaslatok (Feynman)

```diff
- match_goal_scorers tábla (is_shootout flaggel)
- külön match_scorer_events tábla
+ EGYETLEN tábla: match_scorer_events (raw_event jsonb), shootout sorokat be sem szúrjuk

- scoring_configs.scorer_bonus_points (per-csoport override)
+ const SCORER_BONUS = 1 (v1, ha kell, későbbi ALTER TABLE 5 perc)

- predictions.scorer_evaluated_at
+ scorer_bonus_points IS NULL = még nem értékelve

- MatchScorerPicker.vue wrapper
+ <PlayerSelectCombobox restrictToTeams={[home, away]} /> közvetlenül

- POST /admin/matches/:id/rescore-scorers admin endpoint
+ meglévő recalc trigger (pointsCalculatedAt reset → calculateAndSavePoints)
```

---

## 📋 TDD lefedettségi rések (Ada)

A `SCORER-001.md §6` 8 teszt + még szükséges:

- Tippelt játékos nincs egyik csapatban sem → 400
- Tipp leadása lock után scorer-mezővel → 409
- `scorer_bonus_points = 0` config (degenerált eset)
- Csak scorer tipp gólszám nélkül (ha támogatott)
- Config mutáció post-finalize idempotencia
- ET-büntető `elapsed=null` shootout false-positive regresszió

---

## ⚠️ Kritikus bizonytalanság — kód előtt validálni

**Az api-football tényleg visszaadja-e a shootout-rúgásokat events-ként?** A research maga is azt mondja "lehetséges, hogy egyáltalán nem". Egyetlen `curl` egy múltbeli `PEN` meccsre eldönti — ezt MEG KELL csinálni, mielőtt a `isShootoutEvent` 3-szabályos heurisztikára kódot írunk. Ha az API magától nem küldi, a fél `§2.5` szekció és a `is_shootout` flag azonnal törölhető.

---

## Konkrét következő lépés

Mielőtt bármi kódot írnánk, a 4 dokumentum konvergáljon egyetlen igazságra a következő döntésekkel:

1. **Egyetlen tábla** (`match_scorer_events` raw_event jsonb-vel, shootout-ot be se szúrjuk)
2. **Egységes mezőnevek** a `predictions`-ben (`top_scorer_player_id`, `scorer_bonus_points`, `scorer_evaluated_at` törölve)
3. **Hardcoded SCORER_BONUS = 1** v1-re (csoport override out-of-scope)
4. **`PlayerSelectCombobox` direkt használata**, wrapper komponens nélkül
5. **`predictions.homeGoals/awayGoals` NULL-able?** — user döntés
6. **Élő `curl` egy PEN meccsre** az `isShootoutEvent` szabály véglegesítéséhez
7. **`ON DELETE RESTRICT`** a players FK-kon + snapshot `scorer_player_name` v1-re

---

## Kill criteria

Ha az élő api-football válasz a shootoutra eltér a research `§2.5` sejtésétől, a `isShootoutEvent` heurisztikát újra kell tervezni — addig kód ne készüljön a sync.service-ben.

---

## Egyetértés és eltérések a council tagjai között

**Erős konvergencia (mindhárom tag független úton)**:
1. A két párhuzamos tábla problémája
2. A `homeGoals NOT NULL` ↔ "csak scorer is mentődjön" ütközés

**Eltérő hangsúlyok**:
- **Aristotle** a kategorizációs lefedettséget (groups, replay, walkover) emeli ki
- **Ada** a formális idempotencia és FK invariánsokat
- **Feynman** radikálisan többet törölne (config override, wrapper komponens, `scorer_evaluated_at`)

Feynman a legprovokatívabb; ha a 4 dokumentumban már kimondtuk a `scoring_configs.scorer_bonus_points`-ot, érdemes explicit user-döntést kérni a config override sorsáról v1-ben.
