# Előre definiált stat tipp sablonok + új input típusok

## Kontextus

A csoportszintű stat tippek (US-901/902) már implementálva vannak. Az adminnak jelenleg minden típust kézzel kell kitöltenie. Ezek a story-k **sablon-rendszert** és **új input típusokat** (`team_select`, `number`) vezetnek be, hogy egy kattintással lehessen pl. "Gólkirály" vagy "Világbajnok csapat" tippet hozzáadni.

Minden **csoportszintű** marad — nincs globális ranglista integráció.

---

### US-910 — `team_select` input típus bevezetése a stat tippekhez

**Leírás:**
Egyes stat tipp típusoknál (pl. "Világbajnok csapat") a helyes formátum egy konkrét csapat kiválasztása. A `team_select` input típus: a frontend csapat-választó dropdownt renderel, a backend validálja, hogy az `answer` érvényes csapat UUID.

**Elfogadási kritériumok:**
- [ ] Backend: `inputType = 'team_select'` elfogadva a validációban (a meglévő `text`/`dropdown` mellé)
- [ ] Tipp beküldéskor: ha `inputType = 'team_select'`, az `answer` egy létező csapat UUID-ja — ha nem, 400
- [ ] Típus létrehozáskor: `team_select` esetén az `options` mező `null` (nem szükséges)
- [ ] Kiértékeléskor: `correctAnswer` is csapat UUID, egyszerű string összehasonlítás
- [ ] Frontend tag nézet ("Stat tippek" tab): `team_select` típusnál csapat dropdown (név + zászló)
- [ ] Frontend admin konfig: inputType választóban "Csapatválasztó" opció; "Opciók" mező nem jelenik meg
- [ ] Admin "Kiértékel" dialógus: `team_select` esetén csapat dropdown (nem szöveges input)
- [ ] Unit tesztek: érvényes UUID → ok, nem létező UUID → 400, nem UUID formátum → 400
- [ ] Typecheck CLEAN, meglévő tesztek zöldek

**Prioritás:** Should Have
**Komplexitás:** S

---

### US-911 — Sablonok (preset) stat tipp típusokhoz

**Leírás:**
Az admin egy kattintással előtöltheti a stat tipp létrehozó formot előre definiált sablonokból. A sablonok hardcoded konstansok a backenden — nincs migráció, könnyen bővíthető.

**Elfogadási kritériumok:**
- [ ] Backend: `src/constants/stat-prediction-templates.ts` — hardcoded sablon lista
- [ ] `GET /api/stat-prediction-templates` endpoint (`authMiddleware`) — visszaadja az összes sablont
- [ ] Sablon struktúra: `{ id, name, description, inputType, options, defaultPoints }`
- [ ] Minimum sablonok:
  - "Világbajnok csapat" — `team_select`, 10 pont
  - "Döntős csapat (nem bajnok)" — `team_select`, 6 pont
  - "Gólkirály" — `text`, 8 pont
  - "Legtöbb gól egy meccsen" — `text`, 5 pont
  - "Legjobb kapus" — `text`, 5 pont
  - "Legtöbb lapot kapott csapat" — `team_select`, 4 pont
- [ ] Frontend admin konfig UI: form tetején "Sablon választása" szekció (kártyák/lista)
- [ ] Sablonra kattintva a form mezők előtöltődnek (`name`, `description`, `inputType`, `options`, `points`) — a `deadline` mező érintetlen
- [ ] Az előtöltött értékek szabadon szerkeszthetők
- [ ] Sablonra kattintás NEM menti el — csak az "Létrehozás" gomb
- [ ] Backend + frontend tesztek
- [ ] Typecheck CLEAN, meglévő tesztek zöldek

**Prioritás:** Should Have
**Komplexitás:** S

---

## Implementációs sorrend

```
US-910 (team_select) → US-911 (sablonok)
```

## Érintett fájlok

**Backend:**
- `src/services/special-prediction-types.service.ts` — validáció bővítés
- `src/services/special-predictions.service.ts` — answer validáció (team UUID, number)
- `src/constants/stat-prediction-templates.ts` — ÚJ (US-911)
- `src/routes/special-predictions.routes.ts` — templates endpoint (US-911)

**Frontend:**
- `src/views/GroupDetailView.vue` — csapat dropdown, number input, sablon választó
- `src/stores/groups.store.ts` — templates fetch
- `src/api/index.ts` — templates API
- `src/types/index.ts` — inputType bővítés
