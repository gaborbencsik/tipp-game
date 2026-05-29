# Group Standings tipp típus – design spec

**Dátum:** 2026-05-29
**Story-jelölt:** US-945 (új; az US-936 / US-937 mintáját követi)
**Státusz:** Design draft – approval pending

## 1. Áttekintés

Új special prediction típus, amely a felhasználótól a torna **mind a 12 csoportja (A–L)
1–4. helyezésének sorrendjét** és **a 4 továbbjutó 3. helyezett csapatot** kéri egyetlen
összefüggő tippben.

A teljes tipp **egyetlen `special_predictions` rekord**, JSON-encoded answerrel. Egyetlen
egységes deadline (a torna első csoportmeccsének kickoffja), egyetlen submit/save folyamat.
**Auto-save**: minden részleges változtatás (egy dropdown érték, egy 3rd-place chip toggle)
azonnal perzisztálódik – nincs külön „Mentés" gomb a végén.

A pontozási logika (poszícióhelyes / all-or-nothing / hibrid) **nem ennek a story-nak a
hatóköre**; külön story dönti el. A tipp tárolható és módosítható deadline-ig akkor is, ha
a pontozási konfig még nincs megadva.

## 2. Cél, kontextus, illeszkedés

| Story | Funkció | Megosztott infrastruktúra |
|-------|---------|---------------------------|
| US-935 | Globális statisztikai bonus tippek (gólkirály, stb.) | Egységes deadline, "Torna tippek" tab |
| US-936 | Upset Special (multi-csapatos, súlyozott) | `multi_team_weighted` enum, JSON answer |
| US-937 | Progresszió tippek (Last 16 / QF / SF / döntő) | `multi_team_select`, `group_standing` enum, `points_per_correct` |
| **Ez a spec** | **Csoport végeredmény (12× sorrend + 4 best 3rd)** | Az US-937-ben bevezetett `group_standing` inputType **kibővítése**. |

**Kapcsolat az US-937-tel:** az US-937 már bevezeti a `group_standing` enum értéket egyetlen
csoport sorrendjéhez. Ez a spec **kibővíti** az inputType-ot `all_groups_standing`-re (vagy
ekvivalens), ami a 12 csoport és a best 3rd lista együttes tárolása. A `group_standing` enum
megmarad granuláris használatra (egy csoportos típus), de az alapértelmezett seedelt típus
ez a kombinált változat.

> **Implementációs sorrend:** US-937 → ez a story. Ha az US-937 még nincs implementálva, ez
> a story self-contained: bevezeti a szükséges enum értékeket önállóan.

## 3. Adatmodell

### 3.1 `special_prediction_types` rekord (seed)

```ts
{
  name: 'Csoport végeredmény',
  description: 'Tippeld meg a 12 csoport (A–L) végső sorrendjét és válassz 4 továbbjutó 3. helyezett csapatot.',
  inputType: 'all_groups_standing',     // új enum érték
  isGlobal: true,
  isActive: true,
  deadline: '<első csoportmeccs kickoff>',
  options: {
    groups: ['A','B','C','D','E','F','G','H','I','J','K','L'],
    teamsPerGroup: 4,
    best3rdPicks: 4,
  },
  // pointsPerCorrect / points: 0 / null  (külön story tölti ki)
}
```

Csak **egy** rekord; `groupId: NULL` (globális). A `options.groups` lista a torna konfig
alapján bővíthető, de a default a 12 csoport.

### 3.2 `special_predictions.answer` (felhasználó tipp)

JSON-string a `text` mezőben (US-936 mintája szerint, backward compatible):

```json
{
  "groups": {
    "A": ["uuid-mex", "uuid-kor", "uuid-cze", "uuid-rsa"],
    "B": ["uuid-can", "uuid-sui", null, null],
    "C": [null, null, null, null],
    "...": "..."
  },
  "best3rds": ["uuid-cze", "uuid-bih", "uuid-civ", "uuid-jpn"]
}
```

- `groups[X]` minden csoportra **mindig 4 elemű tömb**, ahol az index a helyezés (0=1.hely);
  hiányzó pozíció `null`.
- `best3rds` 0–4 elemű `teamId` tömb.
- A backend a részleges (még nem teljes) tippet is **érvényesnek** tekinti tárolásra –
  csak a deadline pillanatában (vagy submit final esetén) számít teljességnek a kiértékelés.
- Validáció minden részmódosításnál: csak az `options.groups`-ban szereplő csoportokra;
  csapat IDk a torna mezőnyében; csoporton belül nincs ismétlődés; `best3rds` csapatainak
  pozíciója pontosan 3 (= 2-es index) valamelyik csoportban.

### 3.3 `correct_answer` (admin reveal után)

Ugyanaz a séma, mint a user answer, de minden mező kitöltve:

```json
{
  "groups": { "A": ["uuid-...", "uuid-...", "uuid-...", "uuid-..."], "...": "..." },
  "best3rds": ["uuid-...", "uuid-...", "uuid-...", "uuid-..."]
}
```

## 4. UX flow

### 4.1 Mobile-first nézet (elsődleges)

```
┌─────────────────────────────────┐
│  ← Csoport végeredmény    [?]   │
│                                 │
│  Tippeld meg mind a 12 csoport  │
│  sorrendjét + 4 továbbjutó      │
│  3. helyezettet.                │
│  Határidő: jún. 11. 18:00       │
│  Mentés automatikus.            │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  ▼ A csoport          ✓ Kész   │  ← collapsed (4/4)
│  🇲🇽 MEX 1 · 🇰🇷 KOR 2 ·         │
│  🇨🇿 CZE 3 · 🇿🇦 RSA 4           │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  ▲ B csoport          2/4      │  ← expanded
├─────────────────────────────────┤
│  🇨🇦 Canada            [ 1. ▾ ] │
│  🇨🇭 Switzerland       [ 2. ▾ ] │
│  🇧🇦 Bosnia-Hercegovina[ –  ▾ ] │  ← dropdown: 3,4
│  🇶🇦 Qatar             [ –  ▾ ] │  ← dropdown: 3,4
│                       ⏎ Ürítés  │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  ▶ C csoport          0/4      │
└─────────────────────────────────┘
       ⋮  (D–L)
┌─────────────────────────────────┐
│  ▶ Legjobb 4 harmadik 🔒       │  ← lockolt amíg !12/12 csoport
│  Töltsd ki előbb a csoportokat  │
└─────────────────────────────────┘
╔═════════════════════════════════╗  ← sticky bottom bar
║  ●●●●●○○○○○○○○                 ║
║  2 / 13 kész · ✓ Mentve         ║
╚═════════════════════════════════╝
```

**Best 3rd szekció (12 csoport után automatikusan kinyílik):**

```
┌─────────────────────────────────┐
│  ▲ Legjobb 4 harmadik  2/4     │
├─────────────────────────────────┤
│  Válassz 4-et a 12 csoportból   │
│  beállított 3.helyezettek közül.│
│                                 │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐    │
│  │CZE │ │BIH │ │HAI │ │PAR │    │
│  │ ✓  │ │ ✓  │ │    │ │    │    │  ← chip toggle (kék = aktív)
│  └────┘ └────┘ └────┘ └────┘    │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐    │
│  │CIV │ │JPN │ │IRN │ │CPV │    │
│  │ ✓  │ │ ✓  │ │    │ │    │    │
│  └────┘ └────┘ └────┘ └────┘    │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐    │
│  │SEN │ │ALG │ │COD │ │GHA │    │
│  └────┘ └────┘ └────┘ └────┘    │
└─────────────────────────────────┘
```

### 4.2 Desktop nézet

4×3 grid; minden csoport saját kártyán; a 12 csoport teljes egészében látszik. Az aktívan
szerkesztett csoport halvány highlight ringgel kiemelve. Sticky progress sáv tetőn (header
alatt). A best 3rd szekció a grid alatt jelenik meg, lockoltan amíg !12/12.

### 4.3 Read-only nézet (deadline után)

- Minden csoport collapsed, chip-szerű 4 csapat-helyezés.
- Best 3rd: a 4 választott chip kiemelve.
- Admin kiértékelés után (`correctAnswer` set):
  - helyes pozíció: zöld háttér + ✓
  - helytelen pozíció: piros háttér + a tényleges helyezett csapat halvány second sorban
  - best 3rd helyes: zöld; helytelen: piros
- A pontszám-megjelenítés a pontozási story hatóköre; addig csak a vizuális visszajelzés
  látszik.

## 5. Auto-save viselkedés

### 5.1 Általános elv

Minden részmódosítás (egy dropdown érték, egy chip toggle, egy ürítés) **azonnal**
persistálódik a backendre. A felhasználónak nincs „Mentés" gombja. A flow:

1. **Optimistic UI:** a változás azonnal látszik a felületen.
2. **Debounce:** 400 ms inaktivitás után indul a hívás (gyors egymás utáni dropdown
   változtatások egy hívásba aggregálódnak).
3. **PATCH endpoint** küldi a teljes aktuális answer JSON-t (egyszerűség kedvéért: a
   payload kicsi, kb. 1–2 KB). Diff-alapú PATCH túlmérnökölés ehhez a méretarányhoz.
4. **Sticky progress sávban státusz indikátor:**
   - `↻ Mentés…` (in-flight)
   - `✓ Mentve` (success, default állapot)
   - `⚠ Nem sikerült menteni — újrapróbálom` (transient hiba, retry-ban)
   - `⛔ Mentés sikertelen` (max retry után, manuális retry gombbal)

### 5.2 Backend endpoint

`PATCH /api/special-predictions/:typeId`
Body: `{ answer: <full json string> }`
Auth: bejelentkezett user, csoporttag.
Validáció: 4. szekció szerint.
Idempotens: ugyanaz az answer többször küldve azonos állapot.

A meglévő endpoint (`POST /api/special-predictions`) **upsert**-ként viselkedik (lásd
US-936-os mintát) — bővítendő, hogy a részleges answer JSON-t elfogadja, vagy új PATCH
endpoint dedikáltan az auto-save-hez. **Javaslat:** meglévő POST upsert kiterjesztése
(kisebb blast radius).

### 5.3 Race-condition kezelés

- A frontend **monoton verziószámot** (lokális counter, request-id) küld minden mentésen.
- A backend a legutóbb fogadott answer-t tárolja; a kliens a sikeres response után
  állítja be a `lastSavedRequestId`-t. Ha egy közben elindult későbbi PATCH felülírja
  a régebbit a szerveren – ez OK (minden mentés a teljes answer-t küldi).
- Ha egy PATCH sikertelen, miközben egy újabb már sikeres → a sikeres a forrás-igazság;
  a sikertelen NEM kerül retry-ba (felülírná egy elavult állapottal).
- Több device / több tab: nincs külön merge logika — last-write-wins. Reload-kor a
  szerverről jövő answer az autoritatív állapot.

### 5.4 Hálózati hiba

- Transient (5xx, network error): exponenciális backoff retry (3×: 1s, 3s, 9s).
- 4xx (validáció): nincs retry; UI hibaüzenet, a mező visszaáll az utolsó sikeres
  állapotra (rollback).
- Offline: az utolsó sikeres mentés óta levő változtatások **memóriában** maradnak,
  reconnect után egy darab payload-dal mentődnek. Localstorage perzisztálás
  **out of scope** ehhez a story-hoz.

### 5.5 Deadline-átlépés közben

- Ha a deadline a mentés futása közben telik le, a backend **400 Deadline elapsed**-t
  ad; a kliens a választ tárolja, és „⛔ Határidő lejárt — utolsó mentett állapot:
  X csoport / 4 best 3rd" üzenettel locked read-only nézetre vált.

## 6. Komponens-struktúra (frontend)

```
GroupStandingsPredictionView.vue            # tab-szintű nézet (route belépés)
 ├─ ProgressBar.vue                         # sticky progress + auto-save status
 ├─ GroupStandingCard.vue (×12)             # egy csoport accordion kártya
 │    ├─ TeamPositionDropdown.vue (×4)      # csapat melletti 1–4 dropdown smart filterrel
 │    └─ ClearGroupButton.vue
 └─ Best3rdPicker.vue                       # chip-szerű multi-toggle a 12 3.helyezett közül
```

- **Pinia store** (`useGroupStandingsStore`):
  - `state`: `groups: Record<GroupCode, (TeamId|null)[4]>`, `best3rds: TeamId[]`
  - `getters`: `completedGroupsCount`, `is12of12`, `isFullySubmitted` (12 + 4)
  - `actions`: `setPosition(group, team, position)`, `clearGroup(group)`,
    `toggleBest3rd(team)`, `flushSave()` (debounced)
  - `state.saveStatus`: `'idle' | 'saving' | 'saved' | 'error'`

### 6.1 Smart dropdown filter logika

```ts
// helyek 1..4, kivéve a már kiosztottakat
function availablePositionsFor(team: TeamId, group: GroupState): number[] {
  const used = new Set<number>()
  group.forEach((t, idx) => {
    if (t && t !== team) used.add(idx + 1)
  })
  return [1, 2, 3, 4].filter(p => !used.has(p))
}
```

Ha a felhasználó áthelyez egy csapatot egy már foglalt pozícióra (pl. swap), két opció:

- **A: Tilt + figyelmeztetés** – a dropdown opció nem is jelenik meg, ha foglalt.
- **B: Auto-swap** – ha a 2.hely jelenleg KOR-é és MEX-et átállítod 1→2-re, akkor KOR
  a régi MEX helyére (1.) kerül.

**Javaslat: A opció** (smart filter). Egyszerűbb mentális modell, kevesebb meglepetés;
a user a régi csapat mellett kell hogy felszabadítsa a pozíciót. Ha az UX rossznak
bizonyul testelés alatt, B opció a fallback.

### 6.2 Best 3rd dinamikus szinkronizáció

A `best3rdsAvailable` egy computed: a 12 csoport `groups[X][2]` (3.hely) értékeiből
összegyűjtött, `null`-mentes teamId lista. Ha valamelyik csoport 3.helyezettje
megváltozik:

- A `best3rds` állapot szűrésre kerül: csak azok maradnak, akik még az új
  `best3rdsAvailable` listában vannak.
- Toast: „A csoport módosult — Last 16 választás frissítve."
- Auto-save trigger: a változás a következő debounced PATCH-ben mentődik.

## 7. Backend változások

### 7.1 Schema migration

```sql
-- Új enum érték (csak akkor kell, ha az US-937 még nem vezette be)
ALTER TYPE special_prediction_input_type
  ADD VALUE IF NOT EXISTS 'all_groups_standing';
```

A `points_per_correct` és `max_selections` mezők **nem kötelezően** szükségesek ehhez
a típushoz (a pontozást másik story dönti el); ha az US-937 már bevezette, az `options`
JSONB-ben tárolt `groups` / `teamsPerGroup` / `best3rdPicks` átveszi ezt a szerepet.

### 7.2 Seed (`packages/backend/src/db/seeds/...`)

Idempotens (ON CONFLICT DO NOTHING) — egy globális típust hoz létre. A `options.groups`
listája a `groups` táblából deriválva (aktív torna csoportjai kódjai szerint).

### 7.3 Validáció

Tárolt függvény (vagy service-szintű) a következő ellenőrzésekkel:

1. `answer.groups` kulcsai mind az `options.groups` listájában vannak.
2. Minden csoport tömbje 4 elemű (null megengedett részleges állapotban).
3. Egy csoporton belül nincs ismétlődő (nem-null) teamId.
4. A teamId-k a torna mezőnyében szerepelnek, és pontosan annak a csoportnak a tagjai
   (pl. MEX csak az A csoportba kerülhet — nem hagyjuk, hogy a user MEX-et a B-ben
   tippelje).
5. `best3rds` 0–4 elemű, ismétlődés nélküli, és minden eleme valamelyik csoport
   `groups[X][2]` (3.hely) értéke.

### 7.4 Submission-status visszaadás

A backend a PATCH response-ban a teljes mentett state-et adja vissza, plusz egy:
`{ saved: true, completion: { groupsDone: 8, best3rdsDone: 0, totalDone: 8, totalSteps: 13 } }`
mező, hogy a frontend egységesen megjelenítse a progresst a sticky bar-ban.

## 8. Edge case-ek

| Helyzet | Elvárt viselkedés |
|---------|-------------------|
| User egy csoportban csak 2 helyezést tölt ki | Tárolódik (auto-save), progress 2/4; submit-final még nem lehetséges. |
| User a B csoportba MEX-et tippeli (de MEX A-csoportos) | Backend 400; frontend rollback + toast. |
| User a 3.helyezettet megváltoztatja, miközben best3rds-ben szerepel | A best3rds automatikusan szűrődik, toast jelez. |
| Network drop közben | Optimistic UI marad; reconnect után a memóriában lévő utolsó állapot egy mentésben megy ki. |
| Két tab nyitva, mindkettő szerkesztet | Last-write-wins; reload az authoritatív szerver-állapotra állít. |
| Deadline mentés közben telik le | Backend 400 Deadline elapsed; UI lockolt read-only. |
| Admin a deadline után átállítja `correctAnswer`-t | Tippek read-only nézete kiértékelt vizuális visszajelzést mutat (zöld/piros), de pontszám csak ha a pontozási story is megvan. |
| Felhasználó újratölti az oldalt félig kész tippel | A szerverről jövő answer az autoritatív; a felület helyreállítja a részleges állapotot, kitöltött csoportok collapsed, az első kitöltetlen expanded. |

## 9. Kizárások (out of scope)

- **Pontozási logika** — külön story.
- **Drag-and-drop sorrendezés** — az MVP-ben dropdown smart filter; drag későbbi UX
  iteráció, ha igény van rá.
- **Auto-swap dropdown viselkedés** — A opció (smart filter) az MVP; B opció (swap) opcionális
  fallback.
- **Localstorage offline cache** — out of scope; csak in-memory + szerver az SSOT.
- **Eredmény diff-vizualizáció** (pl. Sankey-szerű ábrák) — out of scope, csak alap
  zöld/piros visszajelzés.
- **Aggregált csoportbontás** ("hányan tippelték MEX-et 1.helyre") — a US-934 mintát
  külön story követi.
- **A more granular `group_standing` per-csoport típus** — az US-937 lefedi, ha kell;
  ez a story a **kombinált, 12 csoport + best 3rd** változat.

## 10. Tesztelés

### 10.1 Backend unit tesztek (`vitest`)

- Validáció: érvényes/érvénytelen részleges és teljes answer kombinációk.
- Seed idempotencia.
- Pontozás-független integrációs teszt: PATCH endpoint felülírja a tárolt answer-t.

### 10.2 Frontend unit tesztek (`vitest + Vue Test Utils`)

- `TeamPositionDropdown` smart filter:
  - Először minden helyezés szabadon választható.
  - Egy csapat 1.-re állítása után a többi 3 dropdownban már nincs 1.
- `Best3rdPicker`:
  - Maximum 4 chip aktiválható; az 5. tap blokkolt + toast.
  - Csoport 3.helyezett változása szűri a best3rds-t.
- Auto-save:
  - Debounce: 5 gyors változtatás → 1 PATCH.
  - Sikertelen mentés visszaállít az utolsó sikeres állapotra.
  - Reconnect után pending változtatások mennek ki.

### 10.3 E2E (`playwright`)

- Boldog út: belépés → 12 csoport kitöltése dropdown-okkal → best 3rd 4 chip → reload →
  mentett állapot megjelenik.
- Validációs hiba: B csoport MEX bekevergetése → backend 400 → UI rollback.
- Deadline átlépés szimulációja: deadline közeli állapotban próba módosítás → lockolt
  nézet.

## 11. Effort becslés

| Munkacsomag | Becslés |
|-------------|---------|
| Backend: enum, seed, validáció, PATCH endpoint, unit tesztek | ~5 óra |
| Frontend: store, 3 komponens, smart filter, best3rds, auto-save, sticky bar | ~8 óra |
| Frontend tesztek (Vitest) | ~3 óra |
| E2E (Playwright) | ~2 óra |
| Admin reveal UI (correctAnswer beállítás 12 csoport + 4 best3rd) | ~3 óra |
| **Total** | **~21 óra (~3 nap)** |

## 12. Függőségek

- ✓ `special_prediction_types` + `special_predictions` schema
- ✓ Speciális tippek tab (US-902-B)
- ✓ Auth + group membership
- **Egyeztetendő:** US-937 (ha implementálva, megosztott enum / `points_per_correct`).
- **Külön story:** pontozási logika.

## 13. Nyitott kérdések

1. **Új `inputType` neve.** `all_groups_standing` vs. `tournament_standings`. Javaslat:
   `all_groups_standing` (pontosabb).
2. **Auto-save endpoint.** Új PATCH vs. meglévő POST upsert. Javaslat: meglévő POST
   upsert kiterjesztése (kisebb blast radius).
3. **Smart filter vs. auto-swap.** A vs. B opció a dropdown-on. Javaslat: A (smart
   filter) MVP-ben.
4. **Pontozási story sürgőssége.** A típus tárolható és kiértékelhető read-only,
   pontszám nélkül. A pontozási story bekerülhet ugyanabba a sprintbe vagy később.
   Javaslat: külön story, hogy ez gyorsan releaselhető legyen.
