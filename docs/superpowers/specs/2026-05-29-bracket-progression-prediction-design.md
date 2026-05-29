# Bracket-progresszió tipp típus – design spec

**Dátum:** 2026-05-29
**Story-jelölt:** US-946 (új; az US-937 / US-945 mintáját követi, de **független kategória**)
**Státusz:** Design draft – approval pending
**Referencia screenshot:** `screenshots/best-32-16-8-4-2.png` (a 6 körös bracket struktúra: Last 32 → Last 16 → Quarterfinals → Semifinals → Bronze + Final)

## 1. Áttekintés

Új special prediction típus, amely a felhasználótól a torna **kieséses ágának teljes
lefutását** kéri **6 egymásra épülő körben**:

| Kör | Mit tippel | Pool | Választandó N |
|-----|-----------|------|---------------|
| **Last 32** | A 32 továbbjutó csapat | A torna 48 csapata (csoportok szerint vizuálisan rendezve) | 32 |
| **Last 16** | A 16 közé jutók | A user **saját Last 32-es** tippje | 16 |
| **Quarterfinals (8)** | A negyeddöntős csapatok | A user saját Last 16-os tippje | 8 |
| **Semifinals (4)** | Az elődöntős csapatok | A user saját Last 8-as tippje | 4 |
| **Final (2)** | A két döntős csapat | A user saját Last 4-es tippje | 2 |
| **Bronze (1)** | A bronzérmes csapat | A 2 elődöntő-vesztes (auto-derivált a Final-ből) | 1 |
| **Champion (1)** *(Final része)* | A bajnok | A 2 finalista (auto-derivált) | 1 |

A teljes tipp **egyetlen `special_predictions` rekord**, JSON-encoded answerrel. Egyetlen
egységes deadline (a torna első csoportmeccsének kickoffja), egyetlen submit/save folyamat.
**Auto-save**: minden részleges változtatás (egy chip toggle, egy körön belüli kijelölés)
azonnal perzisztálódik – nincs „Mentés" gomb.

A pontozási logika (per-correct-team, kör-súlyozott vagy hibrid) **nem ennek a story-nak
a hatóköre**; külön story dönti el. A tipp tárolható és módosítható deadline-ig akkor is,
ha a pontozási konfig még nincs megadva.

**Független kategória.** A tipp nem támaszkodik más speciális tippre (sem a csoport
végeredmény tippre [US-945], sem a progression bonus tippekre [US-937]). Az adatmodell,
UI flow és validáció önállóan állja meg a helyét.

## 2. Cél, kontextus, illeszkedés

| Story | Funkció | Mi a különbség ehhez képest? |
|-------|---------|-------------------------------|
| US-935 | Globális statisztikai bonus tippek (gólkirály, stb.) | Egyetlen érték; nincs kör-rendszer. |
| US-936 | Upset Special (multi-csapatos, súlyozott) | Egy körös pick; nincs cascading. |
| US-937 | Progresszió bonus tippek (Last 16 / QF / SF / döntő) | **Stage-enként független pick** a 48 csapatból; nincs körök közötti megkötés. |
| US-945 | Csoport végeredmény (12 csoport sorrend + 4 best 3rd) | A csoportkört fedi le, nem a kieséses ágat. |
| **Ez a spec (US-946)** | **Bracket-progresszió 6 kör, körök közötti cascading constraint** | A user a saját korábbi tippjéből szűkít minden következő körben. |

**Kulcs különbség az US-937-tel:** az US-937 mind a 6 stage-et **egymástól független
csapathalmazként** kezeli (lehet 16 olyan csapatot tippelni a Last 16-ba, akik nincsenek
a saját Last 32-es tippben). Az US-946 ezzel szemben **lánc-szabályt** vezet be: a
következő kör pool-ja **mindig a user előző körös tippje**. A két story egymással **nem
kompatibilis** — egy projektben vagy az egyik vagy a másik aktív; alapértelmezett
ajánlás: az US-946 self-contained bracket flow felhasználóbarátabb.

> **Implementációs sorrend:** önálló — nem függ az US-937 / US-945 implementációjától.

## 3. Adatmodell

### 3.1 `special_prediction_types` rekord (seed)

```ts
{
  name: 'Bracket-progresszió',
  description: 'Tippeld meg ki jut tovább a torna minden kieséses körében (Last 32 → bajnok).',
  inputType: 'bracket_progression',     // új enum érték
  isGlobal: true,
  isActive: true,
  deadline: '<első csoportmeccs kickoff>',
  options: {
    rounds: [
      { code: 'last_32',       size: 32, source: 'all_teams' },
      { code: 'last_16',       size: 16, source: 'previous_round' },
      { code: 'quarter_final', size:  8, source: 'previous_round' },
      { code: 'semi_final',    size:  4, source: 'previous_round' },
      { code: 'final',         size:  2, source: 'previous_round' },
      { code: 'champion',      size:  1, source: 'final' },
      { code: 'bronze',        size:  1, source: 'semi_final_losers' },  // auto: SF \ Final
    ],
  },
  // pointsPerCorrect / points: 0 / null  (külön story tölti ki)
}
```

Csak **egy** rekord; `groupId: NULL` (globális). A `options.rounds` lista a torna
formátum alapján bővíthető/csökkenthető (pl. ha nincs Last 32, a `last_32` round
kihagyható és a `last_16.source = 'all_teams'`).

### 3.2 `special_predictions.answer` (felhasználó tipp)

JSON-string a `text` mezőben (US-936/938 mintája szerint, backward compatible):

```json
{
  "rounds": {
    "last_32":       ["uuid-mex", "uuid-can", "uuid-…", "…(32 db)"],
    "last_16":       ["uuid-mex", "uuid-…",          "…(16 db)"],
    "quarter_final": ["uuid-mex", "uuid-…",           "…(8 db)"],
    "semi_final":    ["uuid-mex", "uuid-…",           "…(4 db)"],
    "final":         ["uuid-mex", "uuid-bra"],
    "champion":      ["uuid-bra"],
    "bronze":        ["uuid-arg"]
  }
}
```

- Minden round egy `teamId[]`. Részleges (még nem teljes) lista **érvényes** tárolásra.
- `champion ⊆ final ⊆ semi_final ⊆ quarter_final ⊆ semi_final ⊆ last_16 ⊆ last_32`
  (lánc-invariáns).
- `bronze ⊆ semi_final \ final` (a bronz a két nem-finalista SF csapatból érkezik).
- Validáció minden részmódosításnál:
  - Csapat ID-k a torna mezőnyében.
  - Round mérete ≤ `options.rounds[…].size`; submit-final csak akkor lehet, ha
    minden round mérete pontosan `size`.
  - Lánc-invariáns betartva: ha `last_16` változik és kiesik egy csapat, a `quarter_final`
    automatikusan szűrődik (és cascading módon `semi_final`, `final`, `champion`, `bronze`).
  - `champion`-nak `final`-ben kell lennie; `bronze`-nak `semi_final \ final`-ban.

### 3.3 `correct_answer` (admin reveal után)

Ugyanaz a séma, mint a user answer, de minden mező teljesen kitöltve:

```json
{
  "rounds": {
    "last_32":       ["uuid-...", "...(32 db)"],
    "last_16":       ["uuid-...", "...(16 db)"],
    "quarter_final": ["uuid-...", "...(8 db)"],
    "semi_final":    ["uuid-...", "...(4 db)"],
    "final":         ["uuid-...", "uuid-..."],
    "champion":      ["uuid-..."],
    "bronze":        ["uuid-..."]
  }
}
```

A torna előrehaladtával a kör-szintű `correct_answer` **fokozatosan tölthető**: pl. a
csoportkör után a `last_32` már beállítható, miközben a többi még üres. A frontend
read-only nézet körönként mutatja a kiértékelést, ahogy elérhető.

## 4. UX flow

### 4.1 Mobile-first nézet (elsődleges)

A 6 kör **vertikális accordion** struktúrában; az aktuálisan szerkesztett kör expanded,
a többi collapsed. **A körök bármilyen sorrendben szerkeszthetők**, de a későbbi kör
pool-ja mindig a user **aktuális** előző körös tippje (üres pool esetén a kör lockolt).

```
┌─────────────────────────────────┐
│  ← Bracket-progresszió    [?]   │
│                                 │
│  Tippeld meg ki jut tovább a    │
│  torna minden kieséses körében. │
│  Minden kör a saját előző körös │
│  tippedből szűkít.              │
│  Határidő: jún. 11. 18:00       │
│  Mentés automatikus.            │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  ▲ Last 32         24 / 32     │  ← expanded
├─────────────────────────────────┤
│  Válassz 32 csapatot a 48-ból.  │
│                                 │
│  A csoport                      │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐    │
│  │MEX │ │KOR │ │CZE │ │RSA │    │
│  │ ✓  │ │ ✓  │ │    │ │ ✓  │    │  ← chip toggle
│  └────┘ └────┘ └────┘ └────┘    │
│                                 │
│  B csoport                      │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐    │
│  │CAN │ │SUI │ │BIH │ │QAT │    │
│  │ ✓  │ │ ✓  │ │    │ │    │    │
│  └────┘ └────┘ └────┘ └────┘    │
│       ⋮  (C–L)                  │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  ▶ Last 16          🔒          │  ← lockolt amíg Last 32 üres
│  Válassz előbb Last 32 csapatot.│
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  ▶ Negyeddöntő (8)   0 / 8     │  ← részleges Last 16 = részleges pool
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  ▶ Elődöntő (4)      0 / 4     │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  ▶ Döntő (2)         0 / 2     │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  ▶ Bronz (1)         0 / 1     │
└─────────────────────────────────┘
╔═════════════════════════════════╗  ← sticky bottom bar
║  ●●●●●●○○○○○○                  ║
║  Last 32: 24/32 · ✓ Mentve     ║
╚═════════════════════════════════╝
```

**Last 16 (és további körök) chip-pool dinamikája:**

```
┌─────────────────────────────────┐
│  ▲ Last 16         12 / 16     │
├─────────────────────────────────┤
│  Válassz 16-ot a 32-es Last 32 │
│  tippedből.                     │
│                                 │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐    │
│  │MEX │ │KOR │ │CAN │ │SUI │    │
│  │ ✓  │ │ ✓  │ │ ✓  │ │    │    │
│  └────┘ └────┘ └────┘ └────┘    │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐    │
│  │RSA │ │JPN │ │BRA │ │ARG │    │
│  │ ✓  │ │ ✓  │ │ ✓  │ │ ✓  │    │
│  └────┘ ⋮  (32-ből összes)      │
└─────────────────────────────────┘
```

A pool-ban **csak a user Last 32-es tippjében szereplő csapatok** látszanak, eredeti
csoportkód-rendben. A 17. tap blokkolt + toast: „Maximum 16 csapat választható."

**Final + Bronze + Champion (a 3 utolsó kör tipikusan kombinált nézetben):**

```
┌─────────────────────────────────┐
│  ▲ Döntő, bronz, bajnok        │
├─────────────────────────────────┤
│  Az elődöntős 4 csapatból:      │
│                                 │
│  Döntősök (válassz 2-t):        │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐    │
│  │BRA │ │ARG │ │FRA │ │GER │    │
│  │ ✓  │ │    │ │ ✓  │ │    │    │
│  └────┘ └────┘ └────┘ └────┘    │
│                                 │
│  Bajnok (a 2 finalistából):     │
│   ( ) BRA   (●) FRA             │  ← rádió
│                                 │
│  Bronz (a másik 2-ből):         │
│   (●) ARG   ( ) GER             │  ← rádió
└─────────────────────────────────┘
```

A „Bajnok" és „Bronz" rádió **automatikusan szinkronizálódik**, ha a Final-ben
módosítja a felhasználó a 2 finalistát: a kiesett csapat rádió-választása törlődik, a
megmaradó csapat marad kiválasztva, az újonnan beérkező csapat default unselected.
Toast: „A döntős kerete módosult — bajnok / bronz választás frissítve."

### 4.2 Desktop nézet

3×2 grid (vagy egyszerű vertikális oszlop, `lg:` 2 oszlopos), minden kör saját
kártyán. Az aktívan szerkesztett kör halvány highlight ringgel kiemelve. Sticky
progress sáv tetőn (header alatt), a 6 kör állapotát mutatja egy lépcsős progress
indikátorban (Last 32 → … → Bronze).

### 4.3 Read-only nézet (deadline után)

- Minden kör collapsed; a chipek listája rácsban.
- Admin kiértékelés után (`correctAnswer` set):
  - **Helyes csapat** (a user tippelte ÉS tényleg eljutott): zöld háttér + ✓
  - **Téves csapat** (a user tippelte, de NEM jutott el): piros háttér + halvány second
    sorban a tényleg továbbjutott csapat (ha még van szabad slot).
  - **Lemaradt csapat** (NEM tippelte a user, de eljutott): külön „Eltaláltad volna +X"
    sávban szürke háttérrel.
- A pontszám-megjelenítés a pontozási story hatóköre.

## 5. Auto-save viselkedés

### 5.1 Általános elv

A v2-es group-standings spec auto-save logikája **változatlanul érvényes**:

1. **Optimistic UI:** a chip toggle azonnal látszik.
2. **Debounce:** 400 ms inaktivitás után PATCH.
3. **Teljes answer JSON** mentődik egyetlen request-ben (~2–4 KB max, mivel `last_32`
   array max 32 UUID = ~1.2 KB).
4. **Sticky progress sávban státusz indikátor:** `↻ Mentés…` / `✓ Mentve` / `⚠ Retry` / `⛔ Sikertelen`.

### 5.2 Backend endpoint

`PATCH /api/special-predictions/:typeId` (vagy meglévő POST upsert kiterjesztése).
Body: `{ answer: <full json string> }`.
Validáció: 3.2 szerint, lánc-invariáns kötelező.
Idempotens.

### 5.3 Cascading szűrés mentés előtt

Ha a user a Last 16-ot szerkeszti és kiveszi MEX-et, akkor a frontend store **automatikusan
szűri** a `quarter_final`, `semi_final`, `final`, `champion`, `bronze` mezőket is, ha
azokban szerepelt MEX. A felhasználó toast-ot kap: „MEX kikerült a Last 16-ból — a
további körök automatikusan frissültek." A backend a teljes szűrt answer-t kapja.

Ezzel a backend validáció soha nem találkozik invalid lánc-állapottal — a frontend
tartja a invariánst. A backend ettől függetlenül **ellenőrzi** a lánc-invariánst,
és 400-at ad ha sérül (defenzíven).

### 5.4 Race / hálózat / deadline

Azonos a v2-es group-standings spec 5.3–5.5 szekciójával: monoton request-id, last-write-wins,
exponenciális backoff retry, `400 Deadline elapsed` esetén lockolt read-only.

## 6. Komponens-struktúra (frontend)

```
BracketProgressionPredictionView.vue           # tab-szintű nézet
 ├─ ProgressBar.vue                            # sticky progress + auto-save status
 ├─ RoundCard.vue (×6)                         # egy kör accordion kártya
 │    ├─ TeamChipPicker.vue                    # generikus chip multi-select (Last 32-höz csoport-grouping)
 │    └─ FinalsRoundCard.vue                   # speciális: 2 chip + 2 rádió kombinált nézet
 └─ Best3rdPicker.vue (n/a — nincs ilyen ebben a típusban)
```

- **Pinia store** (`useBracketProgressionStore`):
  - `state`: `rounds: Record<RoundCode, TeamId[]>` (kezdetben mind üres array).
  - `getters`:
    - `poolFor(roundCode)`: a kör pool-ja (`all_teams` / `previous_round` / `final` /
      `semi_final_losers` szerint).
    - `isComplete(roundCode)`: `rounds[code].length === options.rounds[code].size`.
    - `overallProgress`: 0..1 a 6 kör átlagolva.
  - `actions`:
    - `toggleTeam(roundCode, teamId)`: chip toggle, max-N enforcement,
      cascading szűrés a későbbi körökön.
    - `setChampion(teamId)` / `setBronze(teamId)`: rádió-szerű single pick.
    - `flushSave()` (debounced).
  - `state.saveStatus`: `'idle' | 'saving' | 'saved' | 'error'`.

### 6.1 Pool számítás

```ts
function poolFor(round: RoundCode, state: State): TeamId[] {
  switch (round) {
    case 'last_32':       return allTournamentTeams              // 48 csapat
    case 'last_16':       return state.rounds.last_32
    case 'quarter_final': return state.rounds.last_16
    case 'semi_final':    return state.rounds.quarter_final
    case 'final':         return state.rounds.semi_final
    case 'champion':      return state.rounds.final
    case 'bronze':        return diff(state.rounds.semi_final, state.rounds.final)
  }
}
```

Üres pool esetén a `RoundCard` lockolt: „Válassz előbb [előző kör neve] csapatot."

### 6.2 Cascading szűrés

```ts
function toggleTeam(round: RoundCode, teamId: TeamId) {
  // 1. Toggle az adott körben
  const next = togglePresence(state.rounds[round], teamId, max[round])

  // 2. Ha eltávolítás történt és a teamId szerepel későbbi körökben → szűrjük ki
  if (!next.includes(teamId)) {
    for (const downstream of downstreamRounds(round)) {
      state.rounds[downstream] = state.rounds[downstream].filter(t => t !== teamId)
    }
    showToast(`${teamName(teamId)} kikerült — a további körök frissültek.`)
  }

  state.rounds[round] = next
  scheduleSave()
}
```

### 6.3 Last 32 csoportbontás

A `TeamChipPicker` Last 32-es módja a 48 csapatot **csoportkód szerint csoportosítva**
mutatja (A csoport → B csoport → … → L csoport), 4 chippel csoportonként. A többi
körben a chipek **eredeti csoport rendben** sorakoznak (visual continuity), de a
grouping label ekkor opcionális (kompaktabb pool).

## 7. Backend változások

### 7.1 Schema migration

```sql
ALTER TYPE special_prediction_input_type
  ADD VALUE IF NOT EXISTS 'bracket_progression';
```

A `points_per_correct` és `max_selections` mezők **nem szükségesek** ehhez a típushoz
(round-specifikus konfig az `options.rounds` JSONB-ben él).

### 7.2 Seed (`packages/backend/src/db/seeds/...`)

Idempotens (ON CONFLICT DO NOTHING). Egy globális típust hoz létre. Az `options.rounds`
default a 7 kör (Last 32–Champion–Bronze); admin felület konfigurálhatja, ha a torna
formátum eltérő (pl. Last 32 kihagyása).

### 7.3 Validáció (service-szintű)

1. `answer.rounds` kulcsai mind az `options.rounds[].code` listájában vannak.
2. Minden round tömbje ≤ `options.rounds[…].size`.
3. Csapat ID-k a torna mezőnyében.
4. Lánc-invariáns:
   - `last_16 ⊆ last_32`
   - `quarter_final ⊆ last_16`
   - `semi_final ⊆ quarter_final`
   - `final ⊆ semi_final`
   - `champion ⊆ final`
   - `bronze ⊆ (semi_final \ final)` és `bronze.length ≤ 1`
5. Ismétlődés mentes minden round-on belül.
6. `champion.length ≤ 1`, `bronze.length ≤ 1`.

### 7.4 Submission-status visszaadás

```json
{
  "saved": true,
  "completion": {
    "perRound": {
      "last_32": { "filled": 24, "total": 32 },
      "last_16": { "filled": 12, "total": 16 },
      "...": {}
    },
    "isFullySubmitted": false
  }
}
```

## 8. Edge case-ek

| Helyzet | Elvárt viselkedés |
|---------|-------------------|
| User csak részben tölti ki a Last 32-t | Tárolódik (auto-save), progress 24/32; submit-final még nem lehetséges. |
| User a Last 16-ban olyan csapatot választ, ami nincs a Last 32-jében | A Last 16 chip-pool csak a Last 32-es csapatokat mutatja → fizikailag nem választható. Backend defenzíven 400-at ad, ha mégis bejön. |
| User módosítja a Last 32-t (kivesz egy csapatot) | A frontend store cascading szűri a későbbi köröket; toast jelez; auto-save. |
| User a Final-ben 2 csapatot választ, de a Bajnok rádió még üres | OK, részleges állapot. Submit-final csak akkor érvényes, ha a `champion` és `bronze` is ki van választva. |
| User a Final 2 csapatát átállítja, miközben a Champion már be van állítva | Ha a régi Champion már nincs a Final-ben → Champion törlődik; toast: „Bajnok-választás frissítve." |
| Network drop mentés közben | Optimistic UI marad; reconnect után utolsó állapot egy mentésben megy ki. |
| Két tab nyitva, mindkettő szerkeszt | Last-write-wins; reload az authoritatív szerver-állapotra állít. |
| Deadline mentés közben telik le | Backend 400 Deadline elapsed; UI lockolt read-only. |
| Admin a csoportkör után beállítja a `last_32` correct_answer-t, a többi még üres | Read-only nézet a Last 32-höz színkódolt visszajelzést mutat; a többi kör vár. |
| User reload félig kész tippel | Szerverről jövő answer az autoritatív; az első kitöltetlen kör expanded. |

## 9. Kizárások (out of scope)

- **Pontozási logika** — külön story.
- **Pár-szintű (match-level) bracket tipp** — az MVP-ben csak „melyik csapatok jutnak
  tovább", nem „melyik pár-melyik győz" (pl. W A1 vs RU B1 párosítás). Ez a fajta
  pár-szintű tipp külön story (`match_winner` típus, ha a sorsolás már ismert).
- **Drag-and-drop bracket vizualizáció** — az MVP chip-pool; bracket-grafika későbbi
  iteráció.
- **Localstorage offline cache** — out of scope; csak in-memory + szerver SSOT.
- **Diff-vizualizáció** (pl. „a barátaid 70%-a tippelte BRA-t a döntőbe") — külön story.
- **Több bronze csapat / több champion** — fix `champion.size = 1`, `bronze.size = 1`.

## 10. Tesztelés

### 10.1 Backend unit tesztek (`vitest`)

- Validáció: érvényes/érvénytelen részleges és teljes answer kombinációk.
- Lánc-invariáns: pl. `last_16 ⊄ last_32` esetén 400.
- `bronze` validáció: `bronze ⊆ semi_final \ final`.
- Seed idempotencia.
- PATCH endpoint: részleges answer felülírja a tárolt állapotot.

### 10.2 Frontend unit tesztek (`vitest + Vue Test Utils`)

- `TeamChipPicker`:
  - Last 32 módban a 48 csapat 12 csoport-szekcióban jelenik meg.
  - 33. tap blokkolt + toast.
- Cascading szűrés:
  - Kiveszek egy csapatot Last 32-ből → eltűnik a Last 16/QF/SF/Final/Champion/Bronze
    körökből is.
  - Toast megjelenik.
- Final + Bronze + Champion kombinált kártya:
  - Final 2 chip → Champion rádió csak a 2 finalista közül választható.
  - Final módosítás → Champion rádió szinkronizál (törlődik vagy újraválasztandó).
  - Bronze rádió csak a 2 nem-finalista SF csapatból választható.
- Auto-save:
  - Debounce: 5 gyors toggle → 1 PATCH.
  - Sikertelen mentés visszaállít az utolsó sikeres állapotra.

### 10.3 E2E (`playwright`)

- Boldog út: belépés → Last 32 (24/32-ből 32-re) → Last 16 (16/16) → … → Champion +
  Bronze beállítása → reload → mentett állapot megjelenik.
- Cascading: töröljük a Last 32-ből MEX-et, miután a Last 16-ban is benne van →
  Last 16 chipje eltűnik, toast jelez.
- Lockolt round: üres Last 32-vel a Last 16 lockolt; egy chip kiválasztása után
  unlockolódik (1 elemű pool).
- Deadline átlépés szimulációja → lockolt read-only nézet.

## 11. Effort becslés

| Munkacsomag | Becslés |
|-------------|---------|
| Backend: enum, seed, validáció (lánc-invariáns), PATCH endpoint, unit tesztek | ~6 óra |
| Frontend: store (cascading), `RoundCard` × 6, `TeamChipPicker` (Last 32 csoport-grouping), `FinalsRoundCard`, auto-save, sticky bar | ~10 óra |
| Frontend tesztek (Vitest) | ~3 óra |
| E2E (Playwright) | ~2 óra |
| Admin reveal UI (correctAnswer beállítás 6 körre, fokozatos kitöltés) | ~3 óra |
| **Total** | **~24 óra (~3–4 nap)** |

## 12. Függőségek

- ✓ `special_prediction_types` + `special_predictions` schema
- ✓ Speciális tippek tab (US-902-B)
- ✓ Auth + group membership
- **Független:** US-937 / US-945 implementációjától.
- **Külön story:** pontozási logika.

## 13. Nyitott kérdések

1. **Új `inputType` neve.** `bracket_progression` vs. `knockout_bracket` vs.
   `tournament_bracket`. Javaslat: `bracket_progression` (világos: körök közötti
   cascading).
2. **Last 32 a torna formátumtól függ.** A jelenlegi FIFA VB 2026 formátumban 48
   csapat → 32 továbbjutó → … (matches a screenshotot). Régebbi 32-csapatos VB
   esetén Last 32 = a teljes mezőny → kihagyandó. Javaslat: `options.rounds`
   admin-konfigurálható, default a 48-csapatos verzió.
3. **Bronze mint külön kör vagy a Final része?** Javaslat: a Final/Champion/Bronze
   **egy közös UI-kártyában** jelenik meg (lásd 4.1), de adatszinten 3 különböző
   round (`final`, `champion`, `bronze`). A pontozás külön kezelheti őket.
4. **Last 32 csoport-constraint.** Akarunk-e per-csoport max-ot kényszeríteni
   (pl. csoportonként max 3 csapat = max 36, így 32 elérhető)? Javaslat: **nincs**
   csoport-constraint MVP-ben (a user szabadon választ 32-t a 48-ból, vizuálisan
   csoportokban rendezve, mégis bármilyen elosztással).
5. **US-937 vs US-946 kompatibilitás.** Egy projektben csak az egyik aktív legyen,
   vagy legyen két párhuzamos típus (a user mind a kettőt kitöltheti)? Javaslat:
   **két típus párhuzamosan** — más-más pontozási stratégia, a user dönthet
   melyikbe fektet erőfeszítést. Az admin kapcsolhatja egyenként (`isActive`).
6. **Pontozási story sürgőssége.** A típus tárolható és kiértékelhető read-only
   pontszám nélkül. Javaslat: külön story, gyors release.
