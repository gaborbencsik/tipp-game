---
name: docs-and-commit
description: Run after a feature/refactor implementation is complete (tests green) to do the doc/story bookkeeping and commit the change to the local main branch. Updates plans/00-backlog.md, plans/00-history.md, archives the story file, and creates a single English-language commit on main with no Claude co-author trailer. Does NOT branch, does NOT push, does NOT trigger PR creation.
---

# Docs frissítés és commit (main, no push)

Use ONLY when explicit conditions hold; otherwise stop and ask.

## Mikor hívd

Hívd, ha **mindhárom** igaz:

1. A felhasználó épp most kérte ("doksi frissítés + commit", "doksizd le és mehet a commit", "mehet a commit", vagy ezzel ekvivalens magyar / angol kérés).
2. Az aktuális implementáció **kész**: minden érintett teszt (unit + típusellenőrzés) lefutott és **zöld**. Ha még futtatni kell, fusson le előbb.
3. A `git status` valódi, kapcsolódó változásokat mutat. Üres `git status` → ne hívd.

Ha bármelyik nem teljesül: állj meg, kérdezz vissza, ne commitálj.

## Mit NE csinálj

- **NE branchelj.** A commit a jelenlegi branch-re kerül (a CLAUDE.md szerint ez `main`). Ha a jelenlegi branch nem `main`, **szólj a usernek** és kérdezd meg, mit szeretne — ne válts magadtól.
- **NE pusholj.** Soha. `git push` szigorúan tilos ebben a flowban.
- **NE nyiss PR-t.** `gh pr create` szigorúan tilos.
- **NE adj `Co-Authored-By: Claude` trailert** a commit message-hez (a projekt CLAUDE.md tiltja).
- **NE módosíts migration fájlokat** vagy code-ot ebben a fázisban — csak doksi + commit. Ha közben kódhibát találsz, állj meg és szólj.

## Lépések — pontosan ebben a sorrendben

### 1. Sanity check

```bash
git status
git log --oneline -3
git branch --show-current
```

Ha a branch nem `main`: **állj meg**, jelezd a usernek. Ne folytasd jóváhagyás nélkül.

Ha üres a `git status`: szólj, hogy nincs mit commitálni, állj meg.

### 2. Story bookkeeping (csak ha story-hoz tartozik a változás)

Akkor releváns, ha a változás egy konkrét story (`US-...`, `UX-...`, `OPS-...`, `PUSH-...`, `SEC-...`, `PWA-...`) lezárása. Tisztán bugfix / refactor / dokumentáció / teszt esetén ezt a lépést **ugord át**.

A CLAUDE.md a következőt írja elő story lezárásakor — ezt **kövesd pontosan**:

1. **`plans/00-backlog.md`** — töröld a story sorát a táblából.
2. **`plans/00-history.md`** — add hozzá a story sorát a tábla végéhez (`ID | cím | prioritás` formátumban, ahogy a többi sor).
3. **`plans/00-backlog.md` fejléc "Haladás: X / Y" számláló** — növeld `X`-et 1-gyel, és frissítsd a "Utoljára frissítve: YYYY-MM-DD (<rövid leírás>)" sort a mai dátumra.
4. **Mozgasd a story fájlt:** `plans/stories/<ID>.md` → `plans/stories/archive/<ID>.md`. Ha már archive-ban van (mert korábbi commit oda mozgatta), csak frissítsd a `status:` mezőt `Done`-ra.

Ha a tábla nem tartalmazza a story-t (mert egy korábbi commit már lezárta) — hagyd ki ezt a lépést, csak a status mezőt frissítsd Done-ra az archived fájlban.

### 3. Tesztek zöld?

Ha még nem futottak le a változás óta, futtasd le most. Ne commitolj piros teszttel.

- Frontend: `cd packages/frontend && npx vitest run`
- Backend: `cd packages/backend && npx vitest run`
- Típusellenőrzés ahol releváns: `npx vue-tsc --noEmit` vagy `npx tsc --noEmit`

E2E (Playwright) **nem** előfeltétel — a user külön futtatja.

### 4. Stage + commit

```bash
git add -A
git status   # ellenőrzés: stage tartalom egyezik a változásokkal
```

A commit message **mindig angolul**, a CLAUDE.md "Git commit message" szabálya szerint:

- Title: `<type>(<scope>): <imperative summary>` — konvencionális commit forma; type pl. `feat`, `fix`, `refactor`, `test`, `docs`, `chore`. A scope a story ID, ha van (`UX-043`), egyébként a domain (`scoring`, `auth`, …).
- Body: rövid felsorolás (`-` dashes), mit változott és miért. Ne idézd a diff-et, ne tedd hozzá a fájlneveket listaszerűen — tartalmi pontok kellenek.
- **Tilos** a `Co-Authored-By: Claude …` sor.

Példa:

```
feat(UX-043): show outcomeAfterDraw tip after evaluation on knockout matches

- Add OutcomeAfterDrawBadge with status-derived colors (correct/incorrect/inactive/pending/no-tip).
- Surface the predicted advancer + extra-time vs penalties mode in MatchDetailView
  and MatchPredictionsList for knockout matches.
- Add a pure resolveOutcomeAfterDrawStatus helper and unit tests.
- Backend predictions API now returns outcomeAfterDraw per row.
```

Hívd a `git commit -m "..."` parancsot. Ne nyisd meg az editort, ne használj `-i` flag-et.

### 5. Visszajelzés

Egy mondatban közöld:
- A commit hash-t (`git log --oneline -1`).
- Hogy a `main`-en van lokálisan, **a user pusholja kézzel**.

Ne ajánld fel a push-t, ne kérdezd meg, akar-e pusholni. A CLAUDE.md szerint a user mindig kézzel pusholja a saját ütemében.

### 6. Kontextus compactálása

A commit után **mindig** futtasd le a `/compact` parancsot, hogy a kontextus tömörített állapotra kerüljön a következő feladat előtt. Ez a skill utolsó lépése — a visszajelzés (5. lépés) után közvetlenül következik, külön user-kérdés nélkül.

Csak akkor hagyd ki, ha a commit nem jött létre (1–4. lépés bármelyikén elakadtál).

## Hibakezelés

- **Conflict / detached HEAD / nem `main` branch** → állj meg, magyarázd el a state-et, kérdezd a usert.
- **Pre-commit hook fail** → ne kerüld meg `--no-verify`-jal magadtól. Jelezd a hibát, és kérdezd a usert.
- **Git push véletlenül elindítva** → azonnal `Ctrl-C` egyenértékű leállítás; jelezd a usernek. A skill **soha nem hív** `git push`-t.

## Példa egy teljes futás

```
$ git status
modified:   packages/frontend/src/components/Foo.vue
modified:   plans/stories/archive/UX-043.md

$ git branch --show-current
main

# (story bookkeeping, ha kell — ebben a példában már korábban lezárt UX-043 follow-up, csak status frissül)

$ cd packages/frontend && npx vitest run
Test Files  78 passed (78)   Tests  955 passed

$ git add -A && git commit -m "refactor(UX-043): trim badge label, show ET/PK mode

- Drop the 'Döntetlen esetén:' prefix — match scoreline already implies the draw.
- Append · hosszabbítás / · 11-esek so users see which mode they tipped.
- Strike-through carries over to mode label on incorrect tips."
[main 807782f] refactor(UX-043): trim badge label, show ET/PK mode

# Visszajelzés a usernek:
# "Commit 807782f a main-en lokálisan; te pusholod."
```

## Ellenőrző lista (mentális TDD checklist)

- [ ] A user explicit kérte? ("doksizd le és mehet a commit" vagy ekvivalens)
- [ ] Tesztek zöldek?
- [ ] Aktuális branch `main`?
- [ ] Story-zárás esetén: backlog, history, számláló, archive mind frissítve?
- [ ] Commit message angol, conventional-commit forma, Co-Authored-By trailer nélkül?
- [ ] **Nem pushol, nem branchel, nem nyit PR-t.**
- [ ] Záró mondat: commit hash + "te pusholod kézzel".
- [ ] Commit után `/compact` lefutott.
