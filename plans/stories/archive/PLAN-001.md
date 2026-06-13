---
id: PLAN-001
title: "Torna-tipp pontozási terv (globális speciális tippek kiértékelése)"
priority: Should Have
status: Open
dependencies: []
complexity: S
---

# PLAN-001: Torna-tipp pontozási terv (globális speciális tippek kiértékelése)

> Epic: E5 – Insights & UX / Tervezés

## Háttér

A **torna tippek** (globális, `is_global = true` speciális tippek, pl. „Torna győztese", „Gólkirály", „Lesz-e döntetlen a döntőben") kiértékelése ma **nem dokumentált**. A `special_prediction_types.points` mező és a manuálisan beírt `correct_answer` az egyetlen meglévő mechanizmus, de nincs sehol leírva, **mikor**, **ki** és **milyen forrásból** állítja be ezt, sem hogy hogyan jutnak el a pontok a leaderboard-ra. A torna vége előtt rendezni kell.

## Story

Mint **product owner / admin**, szeretném **egy elfogadott tervdokumentumot, ami leírja a torna-tippek kiértékelési logikáját**, hogy **a torna lezárásakor egyértelmű és auditálható legyen, hogyan kapnak a felhasználók pontot a globális speciális tippjeikre**, és hogy **az implementáció külön story-kban követhető legyen**.

> **Ez a story tervdokumentáció — nem keletkezik kód, migráció vagy teszt.** Az implementáció külön story-kban (PLAN-001 függő) lesz felvéve a terv elfogadása után.

## Elfogadási kritériumok

- [ ] Új tervdokumentum: `plans/05-tournament-scoring.md`.
- [ ] A `plans/00-backlog.md` fejlécében a tervdokumentumokra mutató hivatkozás bővül a `05-tournament-scoring.md`-vel.
- [ ] A doksi az alábbi szakaszokat **kötelezően** tartalmazza:

  ### 1. Hatókör
  - Csak a globális (`is_global = true`) speciális típusok. Csoport-szintű típusok érintőlegesen, részletezés nélkül.
  - Forrás-séma hivatkozás: `packages/backend/src/db/schema/index.ts:specialPredictionTypes` és `specialPredictions`.

  ### 2. Típus-katalógus
  - A jelenleg élő globális `special_prediction_types` listája `inputType` (pl. `team_select`, `player_select`, `boolean`, `number_input`) és `points` szerint csoportosítva.
  - DB seed és élő prod adat alapján.

  ### 3. Kiértékelési stratégia típusonként
  - Mikor és hogyan állítja be az admin a `correct_answer`-t: **manuális** vs. **automatikus** (a `match_results` / `player_stats` aggregáció alapján).
  - Lehetséges automatikus források:
    - **Torna gólkirály** → `match_results.scorerPlayerIds` aggregáció a torna meccsein.
    - **Torna győztese** → a finálé `match_results.homeGoals/awayGoals` + `outcomeAfterDraw` (penalty / extra time).
    - **Konkrét meccs eredmény-jellegű típusok** → már létező `match_results` rekordok.
  - Mit nem lehet automatizálni (pl. „legszebb gól", ha lenne) — marad manuális admin.

  ### 4. Pontozási képlet
  - Mikor jár teljes `points`, mikor 0.
  - **Részleges pontok** kérdése: pl. „dobogós csapat" típus 50%-os pontot kap, ha rossz pozícióba tippelt, de dobogós lett — döntési pont.
  - Hogyan íródik vissza a `special_predictions.points` mezőbe.

  ### 5. Időzítés és trigger
  - Mikor fut a kiértékelés: a torna utolsó meccse `finished` után automatikusan VAGY admin gombnyomásra VAGY mindkettő.
  - Soft-delete-elt user-ek és inaktív (`is_active = false`) típusok kezelése.
  - Idempotencia: a kiértékelést többször lefuttatva ugyanaz az eredmény szülessen.

  ### 6. Holtversenyek és edge case-ek
  - Több gólkirály (azonos gólszám) — kit fogadunk el helyesnek?
  - Nem létező válasz (időközben törölt játékos / csapat referenciája).
  - Határidő utáni admin-módosítás kezelése.
  - Késleltetett `match_results` (pl. utólagos gólszerző-korrekció) hatása a már kiosztott pontokra.

  ### 7. Auditálhatóság
  - Minden pontkiosztás `audit_logs` rekordot ír (új `action` érték, pl. `tournament_evaluation`).
  - Visszafordíthatóság: a torna lezárás visszavonható-e, és ha igen, hogyan.

  ### 8. UI érintettsége (terv szinten)
  - A leaderboard hogyan különbözteti meg a meccs- és torna-pontokat (külön oszlop / összeg / mindkettő).
  - A pontozási szabályzat modal (UX-028 / US-1502) bővítése: mit lát a felhasználó arról, hogyan számoljuk a torna-pontokat.
  - A felhasználó hol látja a saját torna-tippjei kiértékelt eredményét (saját profil, leaderboard, saját tippek nézet).

  ### 9. Implementációs lépések becslése
  - Konkrét, sorba állított story-k listája:
    - „Globális speciális típus kiértékelő service" (backend).
    - „Auto-derivation a `match_results`-ból" (gólkirály, torna győztes).
    - „Admin UI: kiértékelés gomb + visszavonás".
    - „Leaderboard torna-pont szelet (frontend + backend)".
    - „User-facing eredmény-megjelenítés".
  - Becsült komplexitás (S/M/L) story-nként.

  ### 10. Döntési pontok (lezárandó a PO-val)
  - Részleges pontok igen/nem.
  - Automatikus vs. manuális kiértékelés alapértelmezetten.
  - Holtversenyek kezelési szabálya.
  - A leaderboard összevonja-e a meccs- és torna-pontokat vagy külön mutatja.

- [ ] A doksi végén **„Következő lépések"** szekció: ki és mikor véleményezi, mikor várjuk az elfogadást.

## Mit ne csináljunk ebben a story-ban

- **Nincs kód, migráció, teszt.**
- Csoport-specifikus speciális típusok kiértékelése **nem cél**.
- A doksi nem rögzít végleges döntéseket a 10. pont döntési pontjain — azokat a PO zárja le egy review-ban.

## Függőség

- **UX-021** — ha a speciális tippek funkciót töröljük, ez a story won't do.

## Komplexitás

S (csak doksi).
