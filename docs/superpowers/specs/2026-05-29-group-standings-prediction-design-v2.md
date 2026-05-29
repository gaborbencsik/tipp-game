# Group Standings tipp típus – design spec v2

**Dátum:** 2026-05-29
**Story-jelölt:** US-945 (felülírja a v1 design draft-ot)
**Státusz:** Design draft v2 – approval pending
**Előzmény:** [v1 spec](./2026-05-29-group-standings-prediction-design.md) — v2 felülírja az 4. (UX flow) és 6. (komponens-struktúra) szekciókat.

## 0. Mi változik a v1-hez képest?

| # | Változás | Hatás |
|---|----------|-------|
| 1 | **Fordított dropdown irány.** A v1-ben minden csapat mellett 1–4 helyezés-dropdown volt (csapat-first). A v2-ben minden helyezés (1., 2., 3., 4.) mellett **csapat-dropdown** áll (pozíció-first); a dropdown a csoport 4 csapatából **csak a még szabad csapatokat** listázza (smart filter). | UX flip; a dropdown opciók szűkülnek a már kiosztott csapatokkal. |
| 2 | **Csoportok közötti sorrendkényszer megerősített hiánya.** A v1 accordion-design már támogatta a tetszőleges sorrendben való csoport-szerkesztést, de a v2 ezt explicitté teszi a copy-ban és a UI hangsúlyozásban (pl. nincs "kövesd ezt a sorrendet" implikáció). | Tisztázás; UI copy és hint-üzenetek. |

**Nincs változás:** a Best 3rd szekció továbbra is **lockolva marad** mind a 12 csoport teljes (4/4) kitöltéséig — ahogy a v1-ben. Az adatmodell, validáció, auto-save, backend endpoint mind változatlan.

Minden más szekció (1–3., 5., 7–13.) **változatlan** a v1-hez képest.

## 4. UX flow (v2)

### 4.1 Mobile-first nézet

```
┌─────────────────────────────────┐
│  ← Csoport végeredmény    [?]   │
│                                 │
│  Tippeld meg a 12 csoport       │
│  sorrendjét + 4 továbbjutó      │
│  3. helyezettet.                │
│  Bármelyik csoporttal           │
│  kezdheted.                     │
│  Határidő: jún. 11. 18:00       │
│  Mentés automatikus.            │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  ▼ A csoport          ✓ Kész   │  ← collapsed (4/4)
│  1. MEX · 2. KOR ·              │
│  3. CZE · 4. RSA                │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  ▲ B csoport          2/4      │  ← expanded
├─────────────────────────────────┤
│   1.   [ 🇨🇦 Canada       ▾ ]  │  ← csapat-dropdown
│   2.   [ 🇨🇭 Switzerland  ▾ ]  │
│   3.   [ Válassz csapatot ▾ ]  │  ← még üres
│   4.   [ Válassz csapatot ▾ ]  │
│                       ⏎ Ürítés  │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│  ▶ C csoport          0/4      │
└─────────────────────────────────┘
       ⋮  (D–L, bármelyik nyitható)
┌─────────────────────────────────┐
│  ▶ Legjobb 4 harmadik 🔒       │  ← lockolt amíg !12/12 csoport
│  Töltsd ki előbb a csoportokat  │
└─────────────────────────────────┘
╔═════════════════════════════════╗  ← sticky bottom bar
║  ●●●●●○○○○○○○○                 ║
║  2 / 13 kész · ✓ Mentve         ║
╚═════════════════════════════════╝
```

**Helyezés-dropdown viselkedése (B csoport, 3. sor példa):**

```
   3.   [ Válassz csapatot ▾ ]
        ┌─────────────────────┐
        │ 🇧🇦 Bosnia-Herc.    │  ← még nincs kiosztva
        │ 🇶🇦 Qatar           │  ← még nincs kiosztva
        └─────────────────────┘
```

A dropdown **csak a még szabad csapatokat** listázza a csoport 4 csapatából (smart filter). A többi pozícióban már szereplő csapatok **nem jelennek meg** az opciók közt.

**Egy adott pozíció módosítása:**

- Ha a felhasználó újra megnyitja egy már kitöltött pozíció dropdownját, a saját jelenlegi csapata **látszik** kiválasztott állapotban, és a többi szabad csapat is választható (váltáshoz). A szabad csapat választása felülírja a pozíciót — az addigi csapat szabaddá válik a többi pozíciónak.
- Ha mind a 4 pozíció ki van töltve és a felhasználó egy pozíciót cserélni szeretne, a sorrend újrarendezéséhez a **csoport szintű "↺ Csoport ürítése"** gombot kell használnia (lásd a kártya alján). Per-pozíció ürítés inline nem jelenik meg.

### 4.2 Best 3rd szekció (változatlan a v1-hez képest)

A 12 csoport után automatikusan kinyílik (lockolt amíg !12/12 csoport). A chip-szerű multi-toggle viselkedés, a max 4 select, a dinamikus szinkronizáció a `groups[X][2]`-vel mind a v1 spec szerint maradnak.

### 4.3 Desktop nézet

4×3 grid; csoport-kártyákban 4 sor (1.–4.) team-dropdownnal. A Best 3rd szekció a grid alatt **lockoltan jelenik meg**, amíg !12/12 — ahogy a v1-ben.

### 4.4 Read-only nézet (deadline után)

**Változatlan a v1-hez képest** — a megjelenítés `pozíció + csapat` formátumú, ami irány-független. A zöld/piros visszajelzés ugyanúgy működik.

### 4.5 Csoportkártyák szerkesztési sorrend-mentessége (v2 hangsúly)

Minden csoportkártya **egyenrangú** és független — az accordion-fejléceken sincs "kövesd ezt a sorrendet" jelzés (számozás A→L csak abc-rendben jelenik meg, nem progresszióként). A bevezető copy ("Bármelyik csoporttal kezdheted") és a sticky progress bar X / 13 számláló kihangsúlyozza, hogy a kitöltés tetszőleges sorrendben mehet. A részleges csoportok pirossal/sárgával nincsenek megjelölve, csak a "0 / 4" / "2 / 4" badge mutatja a státuszt — semmi sem készteti a felhasználót egy implicit haladási útvonalra.

## 6. Komponens-struktúra (v2)

A v1 komponens-fa **egy ponton** módosul:

```
GroupStandingsPredictionView.vue
 ├─ ProgressBar.vue                         # változatlan
 ├─ GroupStandingCard.vue (×12)             # tartalma változik (lásd lent)
 │    ├─ PositionTeamDropdown.vue (×4)      # ÚJ — helyezés (1./2./3./4.) → csapat dropdown
 │    └─ ClearGroupButton.vue               # változatlan
 └─ Best3rdPicker.vue                       # változatlan (lockolt 12/12-ig)
```

A korábbi `TeamPositionDropdown.vue` (csapat-soros 1–4 select) **megszűnik**; helyette `PositionTeamDropdown.vue`.

### 6.1 PositionTeamDropdown — props és viselkedés

```ts
interface Props {
  position: 1 | 2 | 3 | 4
  groupCode: string                  // 'A' .. 'L'
  groupTeams: readonly Team[]        // 4 csapat (a torna group seedjéből)
  currentAssignments: GroupState     // [Team|null, Team|null, Team|null, Team|null]
}

interface Emits {
  'update:position': (team: Team | null, fromPosition: number | null) => void
  // fromPosition: ha auto-swap volt, melyik pozíció ürült meg / lett swap-elve
}
```

Logika:
- Az opciók: **csak a még szabad csapatok** a `groupTeams` 4 csapatából (smart filter).
- Ha az adott pozícióban már van csapat, a saját csapata is választható lehetőségként látszik (a kiválasztott állapotban) — más szabad csapatra váltáskor a régi felszabadul.
- **Nincs auto-swap és nincs inline "Pozíció ürítése" opció**: pozíció-csere csak szabad csapaton keresztül lehetséges, vagy a csoport-szintű "↺ Csoport ürítése" gombbal.

### 6.2 Best3rdPicker (változatlan)

Megmarad a v1 szerinti `disabled` prop és lockolt overlay viselkedés. Csak akkor engedélyezett, ha mind a 12 csoport 4/4 kitöltött (`is12of12 === true`).

### 6.3 Pinia store (változatlan)

A store sémája és getter-ei a v1 szerintiek (`is12of12`, `isFullySubmitted`, stb.). Csak a `TeamPositionDropdown` action-jainak oldala változik (most a `PositionTeamDropdown` hívja `setPosition(group, team, position)` szignatúrával — a store API stabil, csak a UI komponens cserélődik).

## 8. Edge case-ek (v2 deltái)

A v1 edge case-ek érvényben maradnak. Az alábbiak újak vagy módosultak a pozíció-first dropdown miatt:

| Helyzet | Elvárt viselkedés (v2) |
|---------|------------------------|
| User kiválasztja MEX-et az 1. helyre B csoportban (de MEX A-csoportos) | Soha nem fordulhat elő — a B csoport dropdownja csak a B csoport 4 csapatát listázza. A v1-ben szereplő backend 400 + rollback edge case így a v2-ben **csak rosszindulatú API hívásra** vonatkozik. |
| User az 1. helyre szeretne tenni egy olyan csapatot, aki már 2. | A 2.-ben lévő csapat **nem jelenik meg** az 1. dropdown opciói között (smart filter). Ha cserélni akar, először a 2. dropdownjából kell másik csapatot választania, vagy a "Csoport ürítése" gombbal újrakezdeni. |
| User egy már kitöltött pozíció dropdownját megnyitja | A saját csapata kiválasztott állapotban látszik; mellette a többi szabad csapat választható (váltáshoz). Külön "Pozíció ürítése" inline opció **nincs**. |
| User mind a 4 pozíciót kitöltötte, és egyet cserélni szeretne, de nincs szabad csapat | Csak a "↺ Csoport ürítése" gomb (kártya alja) tudja felszabadítani a pozíciókat — a teljes csoport újrakezdődik. |

## 10. Tesztelés (v2 deltái)

A v1 teszt-szekciója nagyrészt érvényes. Cserélendő/új tesztek:

- **Frontend unit (`vitest`)**:
  - `PositionTeamDropdown` smart filter:
    - Először minden csapat szabadon választható.
    - Egy csapat 1.-re tétele után a másik 3 dropdown opciói között az adott csapat **nem szerepel**.
    - Egy már kitöltött pozíció dropdownja a saját csapatát kiválasztott állapotban mutatja, és a többi szabad csapat választható váltáshoz.
  - `Best3rdPicker`: változatlan v1 tesztek (lock + szűrés + max 4).

- **E2E (`playwright`)**:
  - Boldog út v2: csoportok kitöltése **nem-A→L sorrendben** (pl. F → C → A → ...) → 12/12 után Best 3rd unlockol → 4 chip kipipálás → reload → mentett állapot helyreáll.
  - Smart filter regressziója: B csoport 1. = Canada beállítása után a 2./3./4. dropdown opciói között Canada nincs.
  - "Csoport ürítése" workflow: 4/4 kitöltött csoport újrakezdéséhez a kártya alján lévő gomb használata.
  - Lock megmarad: a Best 3rd szekció `disabled`/lakat marad, amíg !12/12.

## 13. Nyitott kérdések (v2 deltái)

A v1 nyitott kérdései közül:

1. **Smart filter vs. auto-swap.** A v1-ben az A opció (smart filter, swap tilos) volt javasolt; a v2 ezt **megerősíti**: smart filter, **nincs auto-swap, nincs inline pozíció-ürítés**. Csere csak szabad csapaton keresztül vagy "Csoport ürítése" gombbal lehetséges. → **Lezárva.**
2. **Új: 4/4-es csoport pozíció-cseréjének UX-e.** A jelenlegi modellben mind a 4 pozíció kitöltése után egy konkrét pozíció módosításához a teljes csoportot újra kell kezdeni. Elfogadható-e ez UAT-ban, vagy szükséges egy "csere" alternatíva (pl. egy konkrét pozíció ürítését lehetővé tevő külön gomb a sor mellett)? **Javaslat:** MVP-ben az aktuális modell (csak teljes csoport-ürítés); ha a UAT zavarónak találja, hozzáadunk egy diszkrét "× ürítés" ikont a kitöltött pozíció-sorok jobb oldalán.

A többi v1 nyitott kérdés (`inputType` neve, PATCH endpoint, pontozási story sürgőssége) változatlan.
