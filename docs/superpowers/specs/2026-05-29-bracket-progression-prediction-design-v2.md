# Bracket-progresszió tipp típus – design spec v2

**Dátum:** 2026-05-29
**Story-jelölt:** US-946 (felülírja a v1 design draft-ot)
**Státusz:** Design draft v2 – approval pending
**Előzmény:** [v1 spec](./2026-05-29-bracket-progression-prediction-design.md) — v2 felülírja a 1. (áttekintés), 3. (adatmodell), 4. (UX), 6. (komponens) és 12. (függőség) szekciókat.
**Referencia screenshot:** `screenshots/best-32-16-8-4-2.png` (a tényleges torna bracket struktúra: W A1 vs RU B1, W B1 vs 3rd C/D/E, …)

## 0. Mi változik a v1-hez képest?

| # | Változás | Hatás |
|---|----------|-------|
| 1 | **Pár-alapú bracket UI minden körben.** A v1 chip-pool volt (válassz N csapatot egy halmazból). A v2-ben minden kör **pár-listát** mutat (Last 32: 16 pár, Last 16: 8 pár, …), a user **páronként a győztest pickeli**. A győztesek az **admin-rögzített bracket-template** szerint automatikusan a következő kör pár-szerkezetébe kerülnek. | Teljes UX redesign, új mentális modell. |
| 2 | **Csoport-pozíció alapján auto-derivált Last 32 pár-szerkezet.** A bracket-slot-ok (W A1, RU B1, 3rd C/D/E, …) a user **csoport végeredmény tippjéhez (US-945)** kötődnek. A Last 32 16 párosítása ebből számolódik. | **Új hard dependency: US-945.** Csoport végeredmény tipp nélkül a v2 bracket nem jeleníthető meg. |
| 3 | **Cascading invalidálás csoport-tipp módosításnál.** Ha a user módosítja az US-945-as csoport-tippjét és egy slot-tartalmazó csapata változik → az adott Last 32 pár új csapattal töltődik, a régi csapatra vonatkozó győztes-pick **elveszik** (toast jelez). További körökön cascading szűrés. | Több validáció, több értesítési csatorna. |
| 4 | **A "champion" és "bronze" külön match-ként jelenik meg.** A Final 1 pár (a 2 finalista), a Bronze 1 pár (a 2 SF-vesztes), egyszerű 1-csapat-pick mindkettőn. | Egyértelműbb mentális modell, mint a v1 rádió-beágyazott megoldása. |

**Nincs változás:** auto-save logika, deadline kezelés, single `special_predictions` rekord, JSON answer mezőben tárolás. Backend endpoint változatlan struktúrában (csak a JSON séma változik).

A v1 többi szekciója (5. auto-save, 7. backend, 9. kizárások, 10. tesztelés, 11. effort, 13. nyitott kérdések) **nagyrészt változatlan** — eltérések egyenként megemlítve.

---

## 1. Áttekintés (v2)

A user a torna **kieséses ágának teljes lefutását** tippeli **6 körben**, egy bracket-szerű
nézetben. Minden kör **párokat** mutat (a torna fix bracket-struktúrája szerint), és a
felhasználó **páronként a győztest** jelöli ki. A győztes automatikusan tovább kerül a
következő kör pár-szerkezetébe.

| Kör | Párok száma | Pool / forrás | User pick |
|-----|-------------|---------------|-----------|
| **Last 32** | 16 | Csoport végeredmény tipp (US-945) → bracket slot mapping | 16 győztes |
| **Last 16** | 8 | Last 32 győztesek + bracket-template | 8 győztes |
| **Negyeddöntő (8)** | 4 | Last 16 győztesek + bracket-template | 4 győztes |
| **Elődöntő (4)** | 2 | Negyeddöntő győztesek + bracket-template | 2 győztes |
| **Döntő (2)** | 1 | Elődöntő győztesek | 1 győztes (= bajnok) |
| **Bronz (1)** | 1 | Elődöntő vesztesek (auto) | 1 győztes (= bronz) |

**Kulcs előny:** a Last 16-tól kezdve a felhasználó **látja, milyen csapatok versenyezhetnek
egyáltalán** egy adott pozícióért — a bracket-szerkezet kizárja, hogy két ugyanazon ágon
lévő csapat találkozzon. (Ez a v1 chip-pool nem tudta visszaadni.)

A teljes tipp **egyetlen `special_predictions` rekord**, JSON-encoded answerrel.

---

## 2. Cél, kontextus, illeszkedés (v1 változatlan, kiegészítés)

A v2 **erős kapcsolatot** vesz fel az **US-945-as Csoport végeredmény tipp** story-val:

- A bracket template szlot-jai (W A1, RU B1, 3rd C/D/E, …) a torna **fix struktúrája**.
- A slot → csapat mapping a user **US-945-as tippjéből** olvasódik.
- Ha a user nem töltötte ki az US-945-at: a v2 bracket UI **lockolt**, csak az
  „Töltsd ki előbb a Csoport végeredmény tippet" prompt látszik, ami **deeplinkkel**
  vezet az US-945 nézetbe.
- Az US-945 részleges állapotnál (pl. csak A–F csoport kész) is megjelenik: a betöltött
  slot-ok látszanak, a hiányzó slot-ok placeholder-ek (pl. „G csoport — még nincs
  tippelve") és lockoltak.

> **Implementációs sorrend:** US-945 → US-946 v2. Feltétlenül ebben a sorrendben.

---

## 3. Adatmodell (v2)

### 3.1 `special_prediction_types` rekord (seed) — frissített

```ts
{
  name: 'Bracket-progresszió',
  inputType: 'bracket_progression_paired',  // új enum érték (vagy v1 'bracket_progression' opt-in flag-gel)
  isGlobal: true,
  isActive: true,
  deadline: '<első csoportmeccs kickoff>',
  options: {
    bracketTemplate: {
      // Fix admin-konfig — a torna sorsolása szerint.
      matches: [
        { id: 'l32_m1',  round: 'last_32', slotA: 'W_A1',     slotB: 'RU_B1',    winnerTo: 'l16_m1' },
        { id: 'l32_m2',  round: 'last_32', slotA: 'W_C1',     slotB: '3rd_DEF',  winnerTo: 'l16_m1' },
        { id: 'l32_m3',  round: 'last_32', slotA: 'W_D1',     slotB: 'RU_E1',    winnerTo: 'l16_m2' },
        { id: 'l32_m4',  round: 'last_32', slotA: 'W_F1',     slotB: '3rd_ABC',  winnerTo: 'l16_m2' },
        // ... 12 további l32 match
        { id: 'l16_m1',  round: 'last_16', slotA: '<l32_m1>', slotB: '<l32_m2>', winnerTo: 'qf_m1' },
        // ... 7 további l16 match
        // ... 4 qf, 2 sf, 1 final, 1 bronze
        { id: 'final',   round: 'final',   slotA: '<sf_m1>',  slotB: '<sf_m2>',  winnerTo: null    },
        { id: 'bronze',  round: 'bronze',  slotA: '<sf_m1_loser>', slotB: '<sf_m2_loser>', winnerTo: null },
      ],
    },
    slotResolver: 'group_standings',  // jelzi, hogy a group_standings tippből kell deriválni a slot-okat
  },
}
```

A `bracketTemplate` torna-konfigtól függ; admin konfigurálja egyszer torna előtt.
A `slotResolver = 'group_standings'` egy **referencia** az US-945 típusra; a backend
runtime-ban összerakja a slot → teamId mapping-et.

### 3.2 `special_predictions.answer` (felhasználó tipp) — egyszerűsített

```json
{
  "winners": {
    "l32_m1":  "uuid-mex",
    "l32_m2":  "uuid-cze",
    "l32_m3":  "uuid-fra",
    "l32_m4":  "uuid-cmr",
    "l16_m1":  "uuid-mex",
    "...":     "...",
    "qf_m1":   "uuid-mex",
    "sf_m1":   "uuid-bra",
    "sf_m2":   "uuid-fra",
    "final":   "uuid-fra",
    "bronze":  "uuid-arg"
  }
}
```

- Kulcs = match ID a `bracketTemplate.matches` listából.
- Érték = `teamId` (a két párban szereplő csapat egyike).
- **Részleges állapot érvényes**: nem minden match kell ki legyen töltve. Submit-final
  csak akkor, ha minden match-hez van győztes.
- **Nincs külön `champion` / `bronze` mező** — `winners.final` a bajnok, `winners.bronze`
  a bronzérmes.

### 3.3 Származtatott állapot (read-only, runtime computed)

A frontend és backend a következőket **számolja** a tárolt `winners` map-ből:

```ts
type DerivedBracket = {
  matches: Array<{
    id: string,
    round: 'last_32' | 'last_16' | 'qf' | 'sf' | 'final' | 'bronze',
    teamA: TeamId | null,    // null ha az upstream slot/match nem töltött
    teamB: TeamId | null,
    winnerId: TeamId | null, // user pick, vagy null
    isLocked: boolean,       // true ha teamA vagy teamB hiányzik
  }>,
}
```

A számítás:

1. **Last 32 match-ek `teamA` / `teamB`:** US-945 group standings tippből (vagy admin
   `correctAnswer`-ből, ha deadline után).
2. **Magasabb körök match-ek `teamA` / `teamB`:** a `winnerTo` mező alapján — minden
   match győztese az upstream `winnerTo` match egyik slot-ját adja.
3. **Bronze:** a 2 SF-vesztes (a két SF match teamA/teamB - winnerId).

### 3.4 `correct_answer` (admin reveal után)

Ugyanaz a séma mint a user answer:

```json
{
  "winners": {
    "l32_m1": "uuid-...",
    "...": "...",
    "final": "uuid-...",
    "bronze": "uuid-..."
  }
}
```

A torna előrehaladtával fokozatosan tölthető (Last 32 lezárása után csak a `l32_*` mezők
beállíthatók).

---

## 4. UX flow (v2)

### 4.1 Mobile-first nézet

```
┌─────────────────────────────────┐
│  ← Bracket-progresszió    [?]   │
│                                 │
│  Tippeld meg minden mérkőzés    │
│  győztesét a kieséses ágon.     │
│  A párok automatikusan jönnek a │
│  csoport-tippedből.             │
│  Határidő: jún. 11. 18:00       │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  ▲ Last 32          12 / 16    │  ← expanded
├─────────────────────────────────┤
│  Match 1                        │
│  ┌──────────────┐ ┌──────────┐  │
│  │ 🇲🇽 MEX (W A1)│ │🇰🇷 KOR(RU B1)│
│  │      ✓       │ │             │  ← MEX kiválasztva
│  └──────────────┘ └──────────┘  │
│                                 │
│  Match 2                        │
│  ┌──────────────┐ ┌──────────┐  │
│  │ 🇨🇿 CZE (W C1)│ │🇧🇦 BIH(3DEF)│
│  │      ✓       │ │             │
│  └──────────────┘ └──────────┘  │
│                                 │
│  Match 3                        │
│  ┌──────────────┐ ┌──────────┐  │
│  │ 🇫🇷 FRA(W D1) │ │🇨🇭 SUI(RU E1)│  ← még nincs pick
│  └──────────────┘ └──────────┘  │
│       ⋮  (Match 4–16)           │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  ▶ Last 16           4 / 8     │  ← partial (4 L32 győztes pár-pozíció kész)
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  ▶ Negyeddöntő       0 / 4 🔒  │  ← 8/8 L16 győztes után unlock
└─────────────────────────────────┘
       ⋮
╔═════════════════════════════════╗  ← sticky bottom bar
║  ●●●●●●●●●●●●○○○○ + 4 további  ║
║  Last 32: 12/16 · ✓ Mentve      ║
╚═════════════════════════════════╝
```

**Match kártya — nincs pick (tap-ra animál):**

```
┌──────────────┐  ┌──────────────┐
│ 🇫🇷 FRA       │  │ 🇨🇭 SUI      │
│   W D1       │  │   RU E1      │
└──────────────┘  └──────────────┘
   tap valamelyikre → kiválasztva (kék border + ✓)
```

**Match kártya — pick állapotban:**

```
┌──────────────┐  ┌──────────────┐
│ 🇫🇷 FRA   ✓  │  │ 🇨🇭 SUI       │  ← FRA kiemelve (kék bg + fehér text)
│   W D1       │  │   RU E1       │
└──────────────┘  └──────────────┘
```

A user másik csapatra tap-pal **átállítja** a győztest (radio-szerű viselkedés: pontosan
egy csapat lehet győztes párban).

### 4.2 Last 16+ kör nézet

Ugyanúgy match-kártyák, de a slot-címke a forrásmatch ID-t mutatja vagy a győztes csapat-
nevét, attól függően, hogy a megelőző kör match-je ki van-e töltve:

```
Match L16-1  (Match 1 győztese vs Match 2 győztese)
┌──────────────┐  ┌──────────────┐
│ 🇲🇽 MEX  ✓   │  │ 🇨🇿 CZE      │
│ győztes M1   │  │ győztes M2   │
└──────────────┘  └──────────────┘

Match L16-2  (Match 3 győztese vs Match 4 győztese)
┌──────────────┐  ┌──────────────┐
│ ⏳ vár M3    │  │ 🇨🇲 CMR      │  ← M3 még nincs kitöltve, ezért placeholder
│ M3-ra       │  │ győztes M4   │
└──────────────┘  └──────────────┘
   (pick lockolva amíg M3 nincs kész)
```

A „⏳ vár Mxx" placeholder kattinthatatlan; toast: „Töltsd ki előbb a Last 32 Match
3-at."

### 4.3 Final + Bronze nézet (összevont kártya)

```
┌─────────────────────────────────┐
│  ▲ Döntő · Bronz                │
├─────────────────────────────────┤
│  🏆 Bajnok (a Final győztese)   │
│  ┌──────────────┐ ┌──────────┐  │
│  │ 🇧🇷 BRA       │ │🇫🇷 FRA  ✓│
│  │ győztes SF1  │ │ győztes SF2│
│  └──────────────┘ └──────────┘  │
│                                 │
│  🥉 Bronz (SF vesztesek)        │
│  ┌──────────────┐ ┌──────────┐  │
│  │ 🇦🇷 ARG  ✓   │ │🇩🇪 GER   │
│  │ vesztes SF1  │ │vesztes SF2│
│  └──────────────┘ └──────────┘  │
│                                 │
│  ✅ Tipped: 🇫🇷 FRA bajnok ·    │
│      🇧🇷 BRA ezüst ·             │
│      🇦🇷 ARG bronz · 🇩🇪 GER 4. │
└─────────────────────────────────┘
```

A bronze kártya **automatikusan** a 2 SF-vesztest mutatja — ha a user az SF
győzteseit módosítja, a bronze pár automatikusan frissül (és ha a régi bronz-pick
már nincs benne, a pick törlődik, toast jelez).

### 4.4 Lockolt nézet — US-945 nincs kész

```
┌─────────────────────────────────┐
│  🔒 A bracket még nem            │
│  jeleníthető meg                │
│                                 │
│  Töltsd ki előbb a              │
│  Csoport végeredmény tippet     │
│  (12 csoport × 4 helyezés +     │
│   4 továbbjutó 3.helyezett).    │
│                                 │
│  [ Csoport tipp megnyitása →]   │
└─────────────────────────────────┘
```

Részlegesen kitöltött US-945 esetén: a már kész slot-okhoz tartozó match-ek
megjelennek, a többi placeholder-rel:

```
Match 8 (a G csoport még nincs tippelve)
┌──────────────┐  ┌──────────────┐
│ ⏳ G1 vár    │  │ 🇨🇲 CMR      │
│ G csoport    │  │   3rd ABF    │
└──────────────┘  └──────────────┘
   [ Csoport G tipp →]
```

### 4.5 Desktop nézet

**Klasszikus bracket-ábra**, balról jobbra: 8 oszlop (Last 32 fele, Last 32 fele tükörbe
helyezve középen Final + Bronze, …). Minden match egy kis kártya, vízszintes vonalak
jelzik a winnerTo kapcsolatokat. A user a kártyákban a két csapat egyikére tap-pal
pickeli a győztest. Mobil nézetben a klasszikus bracket-ábra túl szűk → a 4.1-es
accordion lista marad.

### 4.6 Read-only (deadline után)

- Minden match-kártya: a user pickje **kiemelve**, a tényleges győztes (admin reveal)
  zöld outline-nal jelölve.
  - Ha egyezik: dupla zöld pipa, ✓✓.
  - Ha eltér: piros háttér a user pickjén, zöld outline a tényleges győztesön.
- Minden kör fejlécében: „N / M helyes pick".

---

## 5. Auto-save (v1 változatlan)

Lásd v1 5. szekció. Egyetlen módosítás:

**Cascading invalidálás csoport-tipp módosításra:** ha a user az US-945-ban módosítja
egy csoport sorrendjét, a backend (vagy frontend store cross-store reaktivitás)
**végigfut** a `winners` map-en, és az összes olyan pick-et eldobja, ahol a teamId már
nem szerepel az auto-derivált pár-pozíciókban. Toast: „A csoport-tipped módosult — N
győztes-pick frissítésre szorul."

---

## 6. Komponens-struktúra (v2)

```
BracketProgressionPredictionView.vue           # tab-szintű nézet
 ├─ ProgressBar.vue                            # sticky progress + auto-save status
 ├─ GroupStandingsGate.vue                     # ÚJ: lockolt prompt ha US-945 nincs kész
 ├─ RoundCard.vue (×6)                         # egy kör accordion kártya
 │    └─ MatchCard.vue (×N)                    # egy mérkőzés (2 csapat-kártya, pick-radio)
 │         └─ TeamSlotChip.vue                 # csapat-csempe (zászló + név + slot-ID)
 └─ FinalsAndBronzeCard.vue                    # speciális összevont nézet a Final + Bronze-hoz
```

- **Pinia store** (`useBracketProgressionStore`):
  - `state.winners`: `Record<MatchId, TeamId>` (sparse).
  - **Cross-store reaktivitás:** `useGroupStandingsStore`-ból olvas (US-945).
  - `getters`:
    - `derivedBracket`: a 3.3-as számított struktúra.
    - `isComplete(round)`: minden round match-jén van pick.
    - `overallProgress`: pick-elt match-ek / összes match.
  - `actions`:
    - `pickWinner(matchId, teamId)`: pick set + cascading invalidate (downstream
      match-ek, ha a győztes csapat eltűnt).
    - `clearWinner(matchId)`: pick törlés + cascade.
    - `flushSave()` (debounced).
  - `state.saveStatus`: `'idle' | 'saving' | 'saved' | 'error'`.

### 6.1 Pick-cascading

```ts
function pickWinner(matchId: MatchId, teamId: TeamId) {
  // 1. Set the pick
  const oldWinner = state.winners[matchId]
  state.winners[matchId] = teamId

  // 2. Ha a csapat változott, invalidate downstream match-ek
  if (oldWinner && oldWinner !== teamId) {
    const downstream = derivedDownstreamMatches(matchId, bracketTemplate)
    for (const dsId of downstream) {
      if (state.winners[dsId] === oldWinner) {
        delete state.winners[dsId]
      }
    }
  }

  scheduleSave()
}
```

### 6.2 Group-standings change reactivity

```ts
watch(useGroupStandingsStore().answer, (newAnswer) => {
  const newSlotMap = computeSlotMap(newAnswer)
  const orphaned = []
  for (const [matchId, teamId] of Object.entries(state.winners)) {
    const match = derivedMatches[matchId]
    if (match.teamA !== teamId && match.teamB !== teamId) {
      orphaned.push(matchId)
      delete state.winners[matchId]
    }
  }
  if (orphaned.length > 0) {
    showToast(`A csoport-tipped módosult — ${orphaned.length} győztes-pick törlésre került.`)
    scheduleSave()
  }
})
```

---

## 7. Backend változások (v1 + delta)

### 7.1 Schema migration

```sql
ALTER TYPE special_prediction_input_type
  ADD VALUE IF NOT EXISTS 'bracket_progression_paired';
```

(Vagy v1 enum reuse + opt-in flag az `options.bracketTemplate` kulcs jelenlétével.)

### 7.2 Seed

Bracket template **a torna sorsolása szerint** kerül a `options.bracketTemplate`-be —
admin kézzel állítja össze a 32 match definícióját (vagy egy importer eszközből).
Idempotens (ON CONFLICT DO NOTHING).

### 7.3 Validáció

1. `winners` kulcsai mind a `bracketTemplate.matches[].id` halmazából.
2. Minden `winners[matchId]` érték = `teamA` vagy `teamB` az adott match-ben.
3. **Lánc-konzisztencia:** ha `winners[downstreamId]` létezik és az upstream győztes
   `winners[upstreamId]` nem szerepel a downstream párban → 400.
4. Az US-945 group_standings tipp **olvasásra** szükséges a slot resolver-hez.

### 7.4 Cascading mentés

A backend **nem** módosít autonóm más rekordot. A frontend felelős az invalidálásért
és a teljes szűrt `winners` map mentéséért. A backend csak a 7.3 validációt futtatja.

---

## 8. Edge case-ek (v1 + új)

| Helyzet | Elvárt viselkedés |
|---------|-------------------|
| User még nem töltötte ki az US-945-at | A teljes bracket lockolt; deeplink az US-945 nézetbe. |
| US-945 részlegesen kitöltött (pl. csak A–F kész) | A betöltött slot-okhoz tartozó match-ek megjelennek, a hiányzó slot-ok placeholder-rel; ezek a match-ek lockoltak. |
| User módosítja az US-945-at (pl. átírja A csoport 1.helyét MEX → KOR) | A bracket store reaktívan újraszámol; orphaned `winners` pick-ek törlődnek; toast jelez. |
| User pickel egy győztest, majd módosítja az upstream győztest | A downstream pick automatikusan invalidálódik (ha a régi győztes már nincs az új downstream párban). |
| User a Final-ben pickel, majd módosítja az SF-et | A Final pár csapata megváltozhat → ha a régi finalistát már nem nyerte meg az SF, a Final pick törlődik. Ugyanez a Bronze-ra. |
| Bronze auto-szinkron | A 2 SF-vesztes a `derivedBracket` számolja. SF-pick változás → Bronze pár automatikusan frissül; régi Bronze-pick orphan, toast. |
| Network drop mentés közben | v1 5.4 azonos. |
| Két tab nyitva | Last-write-wins; reload az authoritatív szerver-állapotra állít. |
| Deadline mentés közben telik le | v1 5.5 azonos. |

---

## 9. Kizárások (v1 + új)

V1 9. szekció + új:

- **Match-szintű részletes tipp** (gólok, hosszabbítás, büntetők) — out of scope; csak
  győztes csapat ID.
- **Saját pár-definíció** (a user maga állít össze párokat) — out of scope; a bracket
  template admin-rögzített.
- **US-945-tól független mód** (chip-pool fallback) — explicit kizárva v2-ben; ha a
  csoport-tipp nincs, a user ezt a story-t nem tudja használni. (Ha kell fallback,
  külön story.)

---

## 10. Tesztelés (v1 + új)

V1 10. szekció + új cases:

### Backend
- Cross-store olvasás: US-945 részleges állapotnál a bracket helyesen jelez locked
  match-eket.
- Lánc-konzisztencia: orphaned winner pick → 400.

### Frontend
- `MatchCard` pick: tap valamelyik csapatra → state update; tap másikra → swap.
- `MatchCard` lockolt állapot: `teamA` vagy `teamB` null → kattintás disabled, toast.
- Cascading pick invalidate: pickelek MEX-et l32_m1-ben, majd l16_m1-ben (ahol MEX
  szerepel mint l32_m1 győztese). Visszaállítom l32_m1-et KOR-ra → l16_m1 MEX-pick
  törlődik.
- Group-standings change cascade: módosítok a US-945 store-ban → bracket store reaktívan
  invalidál pick-eket; toast megjelenik.
- Final + Bronze sync: SF1 győztest változtatok → Bronze SF1-vesztes oldala változik;
  régi Bronze-pick orphan kezelése.

### E2E
- Boldog út: US-945 kitöltése → bracket nézet betöltődik → Last 32 16 match pick → …
  → Final + Bronze pick → reload → mentett állapot megjelenik.
- Cross-tipp módosítás: US-945 átírom egy csoport sorrendjét → bracket toast → érintett
  pick-ek törölve.
- US-945 nélkül: bracket nézet mutatja a lockolt prompt-ot, deeplink működik.

---

## 11. Effort becslés (v1-hez képest +)

| Munkacsomag | v1 becslés | v2 delta | v2 total |
|-------------|------------|----------|----------|
| Backend: enum, seed, validáció, PATCH endpoint | ~6 óra | +2 óra (slot resolver, lánc-konzisztencia) | ~8 óra |
| Frontend: store + komponensek | ~10 óra | +4 óra (cross-store reaktivitás, MatchCard, locked states, FinalsAndBronzeCard) | ~14 óra |
| Tesztek (Vitest + Playwright) | ~5 óra | +3 óra (cascading, cross-store cases) | ~8 óra |
| Admin reveal UI | ~3 óra | +1 óra (match-id alapú winner setup) | ~4 óra |
| **Total** | ~24 óra | +10 óra | **~34 óra (~4–5 nap)** |

---

## 12. Függőségek (v2 — frissített)

- ✓ `special_prediction_types` + `special_predictions` schema
- ✓ Speciális tippek tab (US-902-B)
- ✓ Auth + group membership
- **🔴 KÖTELEZŐ: US-945** (Csoport végeredmény tipp) — slot resolver forrása.
- **🟡 Cross-store reaktivitás:** a frontend store két Pinia store-ról olvas — ez új
  pattern, érdemes kis utility-be (subscribeAcrossStores) refaktorálni az implementáció
  során.
- **Külön story:** pontozási logika.

---

## 13. Nyitott kérdések (v2)

1. **Új `inputType` enum vagy v1 reuse?** Javaslat: új enum `bracket_progression_paired`,
   tisztább szétválasztás. Ha az US-946 csak v2 verzióban kerül implementálásra (v1 sosem
   indult prod-ban), elegendő egy enum.
2. **Bracket template admin-felület.** Külön story kell az admin UI-hoz, ami a 32
   match-et szerkeszti? Javaslat: igen, de **nem** ennek a story-nak a hatóköre — első
   körben SQL seed file-ban (a 2026-os FIFA VB sorsolása alapján).
3. **Részleges US-945 + bracket interakció.** Engedjük-e a usernek pickelni azokat a
   match-eket, ahol mindkét slot már kész (még akkor is, ha más slot-ok nincsenek)?
   Javaslat: **igen** (hadd haladjon, ahogy az US-945-at tölti). Edge case toast jelzi
   ha az érintett csoport később módosul.
4. **Bronze pick UI.** Külön kártyán vagy a Final-lal egy kártyán? Javaslat: egy
   közös FinalsAndBronzeCard (4.3 szerint).
5. **Klasszikus bracket-ábra desktop view.** Megéri-e a komplexitást, vagy mobil-szerű
   accordion lista marad desktop-on is? Javaslat: **MVP-re mobil-szerű accordion
   desktop-on is**, klasszikus bracket-ábra v3 iteráció (vizuális öröm, de + ~4 óra
   munka és reszponzivitási komplikáció).
6. **Pontozási story.** Match-szintű pontozás (1 helyes pick = X pont, kör-szintű
   súlyozással) — külön story, gyors release.
