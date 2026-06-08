# SCORER-001 — Góllövő tipp: UX terv

> Cél: a felhasználó a meccs eredmény tippje **mellé** opcionálisan egy góllövő tippet is leadhasson – a meccs két csapatának keretéből választott egyetlen játékos. Ha a játékos a rendes játékidőben (vagy hosszabbításban) legalább 1 rendes gólt, fejes gólt vagy a játék közbeni büntetőt szerez, **+1 plusz pont** jár; **kedvenc csapat meccsén `× favoriteTeamMultiplier`** (alapértelmezetten 2 → +2). Öngól és büntetőpárbaj gólja **nem** számít. A góllövő tipp **csak teljes meccs tipp mellé** menthető (gólszámok kötelezőek).

Kapcsolódó dokumentumok: `SCORER-001-arch.md` (DB / backend), `SCORER-001-api-research.md`.

---

## 0. Tervezési alapelvek

- **Opcionális, kiegészítő**: a góllövő tipp soha nem kötelező — de **csak meccs eredménytipp mellé** menthető. A meccs eredménytipp leadható góllövő nélkül; csak góllövő tipp önmagában nem érvényes.
- **Ugyanaz a deadline**: lock a meccs `scheduledAt`-jére, megegyezik a meccs tippel – nincs külön határidő-szabály a UI-ban.
- **Felfedezhető, de visszafogott**: a list oldali kártyán nem domináló (a 0–9 közötti gólszám-input marad a fő interakció), de van vizuális hívószó (ikon + 1 sornyi placeholder).
- **Mobile-first**: 360px-en is olvashatónak és tap-elhetőnek kell lennie a kontroll (min. 32px magasság, mint a meglévő gólszám inputok).
- **Konzisztens a meglévő stílussal**: ugyanaz a `border-gray-300` / `focus:ring-blue-500/10` token-szett, ugyanaz az autosave debounce (2s), ugyanaz a `saveStatus` toast minta.

---

## 1. A meglévő stílus rövid összefoglalója

A vizsgált fájlok (`MatchesView.vue`, `MatchDetailView.vue`, `PlayerSelectCombobox.vue`, `predictions.store.ts`) alapján:

### Meccs kártya layout (list)

- Külső konténer: `bg-white rounded-lg shadow-sm border p-4 mb-3`
- Bal szegély szín a tipp státusz alapján (`cardBorderClass`):
  - lila/amber bg ha tippelhető és nincs tipp (`border-amber-300 bg-amber-50`)
  - kék border ha van tipp (`border-blue-200`)
  - bal szegély szín a kiértékelés után (zöld 5+, amber 1+, szürke 0)
- Fejléc sor: `stage` cimke balra (uppercase tracking-wide gray-500), státusz badge jobbra
- Középső csapat–eredmény–csapat sor (`flex items-center justify-center gap-4`)
- Tipp szekció `border-t border-gray-100 pt-3 mt-3` separátorral, középre rendezve

### Meccs tipp UI (gólszám input)

- Két `w-[2.6rem] h-8` szám input, közéjük `–` jel
- `border-[1.5px] border-gray-300 rounded-md`, focus-on `border-blue-500 focus:ring-3 focus:ring-blue-500/10`
- Dirty állapot: `border-blue-500 bg-indigo-50`
- Saving disabled: `disabled:bg-gray-100 disabled:text-gray-400`
- Autosave 2 másodperc inaktivitás után, `saveStatus` map: `saving | saved | error`
- Status sor: `text-green-600` ("Tipp elmentve"), `text-red-500` (hiba), `text-gray-400` (utolsó módosítás)
- Outcome selector (knockout, döntetlen tipp): kis `text-xs` border-elt buttonok, aktív állapot `bg-blue-600 text-white border-blue-600`

### Kiegészítő egyenes-kieséses kontrollok

- "Hosszabbítás", "Büntető" feliratok `text-xs text-gray-400 w-20 text-right` – a górlövő tipphez ugyanezt a hierarchiát követjük (lásd 5.3 tooltip).

### Player picker (`PlayerSelectCombobox.vue`)

- **Már létezik** és élőben használja a `GroupDetailView.vue` és `TournamentTipsView.vue`. Combobox: input + dropdown lista, focus után minden vagy szűrt playerek (`max-h-64 overflow-y-auto`), zászló ikon (`w-6 h-4 object-cover rounded-sm`), név, csapat rövidítés badge.
- Konténer: `border border-slate-300 rounded-md bg-white focus-within:ring-2 focus-within:ring-blue-300`.
- API: `api.players.list(token, leagueId?)` – Player típus tartalmaz `name`, `teamId`, `teamName`, `teamShortCode`, `teamFlagUrl`, `position`, `shirtNumber`.
- A jelenlegi komponens **NEM csapatonként grouppol** (egy lapos lista), és **NEM filterel meccs-csapatra** – ezt bővíteni kell (lásd 6. pont).

### Színpaletta

- Primer: `blue-600` / `blue-500` (CTA, focus, fókuszgyűrű)
- Dirty: `indigo-50` háttér + `blue-500` border
- Pozitív kiértékelés: `green-50 / green-700 / green-200` (zöld badge), nagy pontnál `green-500` bal szegély
- Részleges/figyelmeztetés: `amber-50 / amber-300 / amber-700`
- Negatív/inaktív: `gray-100 / gray-400 / gray-500`
- Élő: `red-500` pulse pötty
- Bónusz pont vizuális kód: a +1 góllövő bónuszt **kék** badge-dzsel (mint a "3-4 pont"), ne keverjük a meccs tipp pontszín-skálájával, mert vizuálisan jól elkülönül.

---

## 2. List oldal mockup – `MatchesView.vue` meccs kártya

### Cél állapot

Helytakarékos: max **1 új sor** a tipp szekcióban, a gólszám inputok alá, vékony separátor nélkül (vizuálisan ugyanaz a tipp blokk).

### Empty (nincs góllövő tipp, tippelhető meccs)

```
┌─────────────────────────────────────────────────────┐
│ CSOPORT – B csoport                  [SCHEDULED]    │
│                                                     │
│       🇭🇺 Magyarország   18:00   Ausztria 🇦🇹       │
│                       Bécs                          │
│ ─────────────────────────────────────────────────── │
│  ⏳   [ 2 ]  –  [ 1 ]                               │
│                                                     │
│  ⚽ Góllövő:  ▾ Válassz játékost… (opcionális)      │
│                                                     │
│           Tipp elmentve · 12:34                     │
└─────────────────────────────────────────────────────┘
```

- A "Góllövő" sor a gólszám inputok **alatt**, ugyanabban a `mt-3 pt-3 border-t` blokkban, de **belső** kis `mt-2` paddinggel (nem új separátor – vizuálisan egységes tipp-egység).
- Trigger: `flex items-center gap-2`, balra `⚽` emoji + `text-xs text-gray-500 font-medium` "Góllövő:" cimke; jobbra a select trigger `flex-1`.
- Select trigger empty: `text-sm text-slate-400 italic` "Válassz játékost… (opcionális)".
- Az "(opcionális)" csak az első renderelésig, vagy ha még nincs meccs tipp se – ha már van meccs tipp, csak "Válassz játékost…" elég.
- Magasság: `h-8` (mint a gólszám inputok), padding `px-2.5 py-1.5`, `border-[1.5px] border-gray-300 rounded-md`.

### Kitöltött (van góllövő tipp, tippelhető meccs)

```
│  ⚽ Góllövő:  🇭🇺 Szoboszlai Dominik    [ × ]       │
```

- Választott állapot: a select triggeren belül `flex items-center gap-2`, bal oldalt zászló (`w-5 h-3.5 rounded-sm`), név `text-sm text-slate-800 truncate`, jobbra `×` gomb a törléshez (`text-slate-400 hover:text-slate-600`, `aria-label="Góllövő tipp törlése"`).
- Dirty állapot (nem mentett változás): border `border-blue-500 bg-indigo-50` ugyanúgy mint a gólszám inputnál.
- A teljes komponens kattintásra megnyitja a dropdownt; az `×` gomb `event.stopPropagation()`.

### Locked (lezárult deadline / élő / lejátszott meccs)

```
│ 🔒 Tipp 2 – 1   ⚽ Szoboszlai D.    [+1] · +4 pont  │
```

- A `<template v-else>` ágon (locked) jelenleg egy soros összefoglaló van. Kibővítjük:
  - Ha van góllövő tipp: a meccs tipp után `gap-2` szeparátorral (`text-gray-300 ·`), `⚽` ikon + a játékos rövid neve (`Vezetéknév I.` formátumban, `truncate`, max 14 karakter).
  - Ha értékelt és talált: `[+1]` zöld badge (`bg-green-50 text-green-700 border-green-200`).
  - Ha értékelt és nem talált: a játékos név `text-gray-400` + halvány áthúzás (`line-through decoration-gray-300`).
  - Ha még nincs eredmény: `[+1]` helyett semleges szürke badge `[?]` vagy a badge elmarad – az értékelést a meccs lefújása után kapja meg.
- Ha van góllövő tipp, de a meccs tipp pont kalkulációs sora már zsúfolt (kis kijelző), 2 sorba törjük: a góllövő külön sorban a meccs tipp sora alatt:

```
│ 🔒 Tipp 2 – 1                                +4 pont │
│    ⚽ Szoboszlai D.                            [+1]  │
```

- Ezt felső 360px-nél `flex-col` opcióval kapcsoljuk, deszktopon `md:flex-row md:gap-2`.

### A select pozíciója

- A meccs tipp blokkon **belül**, az gólszám inputok és outcome selector **után**, a status sor (`Tipp elmentve…`) **előtt**.
- Indok: a kiértékelés szempontjából egy logikai egység, és a user a meccs tipp leadás után természetesen megy lefelé a kártyán.

### Csapat szerinti grouping a dropdownban

A `PlayerSelectCombobox` jelenleg flat. A list oldali kompakt selectnél a dropdownt **két szekcióra** bontjuk natív `<optgroup>` mintára (de saját markup, a meglévő combobox-ot bővítjük – lásd 6. pont):

```
┌── ⚽ Góllövő tipp ──────────────┐
│ 🇭🇺 Magyarország (HUN)         │  ← csoport fejléc, kis caps
│   • Szoboszlai Dominik   #10   │
│   • Varga Barnabás        #19  │
│   • Gulácsi Péter         #1   │
│   …                            │
│ 🇦🇹 Ausztria (AUT)             │  ← csoport fejléc
│   • Marko Arnautović      #7   │
│   • David Alaba           #8   │
│   …                            │
│ ─────────────────────────────  │
│ ⊘ Töröl (nincs góllövő tipp)   │  ← clear gomb a dropdown alján
└────────────────────────────────┘
```

- Csoport fejléc: `text-xs font-semibold uppercase tracking-wide text-slate-500 px-2.5 py-1 bg-slate-50 sticky top-0`, zászló (`w-5 h-3.5`) + csapatnév + rövidítés.
- Játékos sor: `px-2.5 py-2 text-sm`, név balra, `text-xs text-slate-400` mezszám / poszt jobbra.
- Filter / kereső: ugyanaz mint a meglévő comboboxban (`onInput` szűr a 2 csapat összesített listáján).
- Lista magasság: `max-h-64 overflow-y-auto` (mint most), 23 fős keretnél 2 csapat = max ~46 player – elfér.

### Loading / disabled (még nincs lekérdezve a keret)

```
│ ⚽ Góllövő:  ⟳ Játékosok betöltése…                 │
```

- Kapcsoljuk `disabled`-re a triggert, halvány szöveg `text-slate-400 italic`. Részletek: 5.1.

---

## 3. Details oldal mockup – `MatchDetailView.vue`

### Cél állapot

Részletesebb, kétszer akkora padding, **saját kártya** vagy a meccs tipp kártya **bővítése** egy alszekcióval. Választás: **bővítés** (egy kártyán belüli sub-section), így nincs vizuális szigetelés a meccs tipp és a góllövő tipp között, ami megerősíti, hogy egyetlen "tipp egység" – csak két opcionális komponenssel.

### Layout

```
╔══════════════════════════════════════════════════════════╗
║  Tippem ⓘ                                                ║
║                                                          ║
║   [ 2 ]   –   [ 1 ]                                      ║
║                                                          ║
║   ───────────────────────────────────────────────────    ║
║                                                          ║
║  ⚽ Góllövő tipp                       Opcionális · ⓘ    ║
║                                                          ║
║   ┌─────────────────────────────────────────────────┐   ║
║   │ 🇭🇺 Keresés vagy válassz a listából…   [ × ]    │   ║
║   └─────────────────────────────────────────────────┘   ║
║                                                          ║
║   • A büntetőpárbaj gólok nem számítanak.                ║
║                                                          ║
║   Tipp elmentve · 12:34                                  ║
╚══════════════════════════════════════════════════════════╝
```

- A "Góllövő tipp" alszekció elválasztó: `border-t border-gray-100 mt-4 pt-4`.
- Cím: `text-sm font-semibold text-gray-700` + ⚽ ikon balra; jobbra `text-xs text-gray-400` "Opcionális" felirat + `ⓘ` info tooltip trigger (5.3).
- Nagyobb input magasság: `h-10` (vs. `h-8` a list oldalon), `text-base`, kényelmesebb scrollozás telefonon.
- Kereső `placeholder`: "Keresés vagy válassz a listából…" (a fókuszra azonnal kinyílik a két csapat groupolt listája, ahogy a `PlayerSelectCombobox.onFocus` is teszi).
- Dropdown ugyanaz a 2-csoportos struktúra, mint a list oldalon, **plusz**:
  - **Poszt cimke a játékos sorban**: `text-xs text-slate-400` jobbra (pl. `FW · #10`).
  - Lista magasság: `max-h-80` (kicsit nagyobb, mert van hely).
- "A büntetőpárbaj gólok nem számítanak" mini-help sor csak knockout meccsen jelenik meg (`KNOCKOUT_STAGES.includes(match.stage)`), `text-xs text-gray-500`.

### Kapcsolat a meccs tipp UI-hoz

- Egy `<form>` szemszögéből: ugyanaz a `savePrediction()` autosave hívás. A meglévő `upsertPrediction` payload-ot egészítjük ki:
  - `PredictionInput` új mező: `scorerPickPlayerId: string | null` (null = nincs tipp / törlés).
  - Backend: `SCORER-001-arch.md` szerint a `predictions.scorer_pick_player_id` oszlop tartja, plusz `scorer_player_name_snapshot` text mezőt a backend tölti ki a leadáskor.
- **Csak teljes tipp mellé**: a góllövő mező **csak akkor mentődik**, ha a meccs gólszámai ki vannak töltve. A `savePrediction` őr feltétel: `if (homeGoals == null || awayGoals == null) return` — scorer-only payload nem kerül elküldésre. A backend safety-net: 400 Bad Request, ha mégis csak `scorerPickPlayerId` érkezne gólszámok nélkül.
- Ezt a részletet az implementációs story (SCORER-001 backend / frontend impl) rögzíti, az UX szintjén a lényeg: **a góllövő select egy meccs-tipp kiegészítője**, az eredménytipp a gating.

### Lezárt / kiértékelt állapot Details oldalon

```
║  Tippem                                                  ║
║                                                          ║
║   2 – 1                                          +4 pont ║
║                                                          ║
║   ⚽ Góllövőm: 🇭🇺 Szoboszlai Dominik    [✓ +1 pont]    ║
║                                                          ║
║   Találat: a játékos 1 gólt szerzett a 32. percben.     ║
╚══════════════════════════════════════════════════════════╝
```

- Sikeres: zöld pipa + `+1 pont` zöld badge (`bg-green-50 text-green-700 border-green-200`).
- Sikertelen: `[× 0 pont]` szürke badge, név `text-gray-500 line-through decoration-gray-300`.
- Pending (még nem értékelt, pl. élő): `[? várható]` semleges blue badge.
- A "Találat:" magyarázó sor **opcionális, MVP-n túl** – a backend ad-e perc / asszisztens / öngól adatot, nyitott; ha nem, csak a badge marad.

---

## 4. Kiértékelés utáni állapotok – részletes mátrix

| Állapot | List kártya | Details |
|---|---|---|
| Nincs tipp, lezárt | "Nincs góllövő tipp" csak ha akarjuk hangsúlyozni – javaslat: **ne mutassuk** (zaj). | "Nincs góllövő tipp" `text-gray-400 italic`, nincs badge. |
| Tipp van, élő/folyamatban | `⚽ Szoboszlai D.` semleges szürke badge `[?]`. | `⚽ Góllövőm: Szoboszlai D.  [? várható]` blue. |
| Tipp van, lefújva, talált | `⚽ Szoboszlai D. [+1]` zöld pipa badge. | `[✓ +1 pont]` zöld badge, név normál. |
| Tipp van, lefújva, nem talált | `⚽ ~~Szoboszlai D.~~` szürke + line-through, badge nélkül vagy `[× 0]`. | `[× 0 pont]` szürke badge, név line-through `text-gray-500`. |
| Tipp van, meccs cancelled | `⚽ Szoboszlai D.` `text-gray-400`, "törölt" cimke a meccs status-szal együtt. | "A meccs törölve – góllövő tipp nem értékelhető" `text-xs text-gray-400`. |

### Vizuális tokenek

- **Sikeres badge**: `inline-flex items-center gap-1 text-[0.68rem] font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-700 border border-green-200`, tartalom: `✓ +1`.
- **Sikertelen badge**: ugyanaz `bg-gray-100 text-gray-500 border-gray-200`, tartalom: `× 0`. (A badge elhagyható is, ha túlzsúfolt – a name line-through-ja önmagában is jelez.)
- **Semleges (még nem értékelt)**: `bg-blue-50 text-blue-700 border-blue-200`, tartalom: `?`.

### Konzisztencia a meccs tipp pont badge-dzsel

- A meccs tipp `pointsBadgeClass(points)` függvényt **nem** keverjük – a góllövő bónusz **mindig +1** (vagy 0), a vizuális kódolás bináris (zöld / szürke). Ez segít a usernek elválasztani a két dimenziót.

---

## 5. Edge case-ek

### 5.1. Meccs csapat keret nincs lekérdezve / üres

A `players` tábla a `SCORER-001-arch.md` szerint létező, de bizonyos pillanatban (admin még nem szinkronizálta a kerettet) lehet 0 player a csapatra. Két szint:

1. **Loading (API hívás folyamatban)**: a select trigger `disabled`, szövege `⟳ Játékosok betöltése…`, animálás opcionális (light spinner balra). A meccs tipp gólszám inputot ez **nem érinti** – továbbra is leadható.
2. **Üres (mindkét csapatra 0 player)**: a select **el van rejtve**, helyette discrét `text-xs text-gray-400 italic` üzenet: "A keretek még nem érhetők el". A meccs tipp leadható. Ha csak az egyik csapat üres: a működő csapat játékosai választhatók, a másik csoportfejléc alatt `text-xs text-slate-400 italic px-2.5 py-2` "Keret még nem érhető el".
3. **Network hiba**: ugyanaz mint az üres állapot, "Játékoslista nem betölthető – próbáld újra" + retry link / kis ↻ ikon.

### 5.2. Already-existing tipp törlése

- **List oldali select**: a kitöltött triggeren belül `×` gomb (`aria-label="Góllövő tipp törlése"`). Kattintásra `scorerPickPlayerId = null` → autosave 2s után hívja a `upsertPrediction`-t.
- **Details oldali select**: ugyanaz az `×` ikon a triggerben **plusz** a dropdown legalján egy explicit `⊘ Töröl (nincs góllövő tipp)` sor (`text-sm text-slate-500 hover:bg-slate-50 border-t border-slate-100 px-2.5 py-2`). A dupla affordance segít: az `×` finom, a "Töröl" explicit screen reader friendly.
- A törlés azonnal **dirty** állapotot mutat (kék border) és a 2s autosave trigger alatt megjelenik a "Tipp elmentve" toast.
- **NEM** kell külön megerősítés (modal) – ugyanúgy módosítható mint a meccs tipp.

### 5.3. Knockout meccs – büntetőpárbaj NEM számít

- **Mindkét** oldalon (list + details) megjelenik egy **info ikon** (`ⓘ`, `text-slate-400 hover:text-slate-600`, `w-3.5 h-3.5`) a "Góllövő:" / "Góllövő tipp" cimke mellett **kizárólag knockout meccsen** (`KNOCKOUT_STAGES.includes(match.stage)`).
- Hover / tap tooltip (mobile-on `aria-label` + a Details oldalon külön `text-xs text-gray-500` 1 sor a select alatt):
  > "A büntetőpárbaj gólok nem számítanak. A rendes játékidőben (és hosszabbításban) szerzett gólok és büntetők igen. Öngólt nem fogadunk el."
- A list kártyán helytakarékosság miatt csak az `ⓘ` ikon van; tap-re ugyanaz a tooltip / popover (mobile-friendly: kis Teleport popover, tap outside zár). Reusable: `<TooltipIcon :label="…" />` (ha még nincs ilyen komponens, bővítés a meglévő `ScoringExplainerTrigger.vue` mintájára – lásd a Details oldalon már használt `<ScoringExplainerTrigger source="match-tip" variant="icon" />`-t).
- **Csoportkör meccsen** ne mutassuk az ikont – nincs büntetőpárbaj, felesleges noise.

### 5.4. Játékos átigazolt / kikerült a keretből a deadline után

- Ha a deadline után a játékos kikerül a keretből: a tipp marad, kiértékelése a tényleges meccsadat alapján történik (ha pályára lép és gólt szerez, +1; ha nem lép pályára, 0). UI nem mutat warningot – ez backend ténykérdés.
- Ha a deadline **előtt** kerül ki: a select frissül (a refetch hatására), a játékos eltűnik a listából, de a már mentett tipp `scorerPickPlayerId` érvényben marad (a backend a `scorer_player_name_snapshot` oszlopban tartja a leadáskori nevet, így a UI mindig tud nevet mutatni). **Discreet warning** a select alatt: `text-xs text-amber-600` "A választott játékos már nem szerepel a keretben — válassz másikat". Mentett érték az adatbázisban marad amíg a user át nem ír / nem törli.

### 5.5. Late prediction / meccs előtt 5 perccel

- Ugyanaz mint a meccs tipp – a deadline a `match.scheduledAt`. A `isTippable(match)` ugyanaz a feltétel mindkét tippnél; nincs külön szabály.
- A "tippelhetőből locked-be" váltás pillanatában a select read-only-vá válik. Részletesebb deadline-warning (pl. "1 perc múlva lock") a meccs tipp UI-jával együtt frissül – nem szükséges külön góllövő-specifikus üzenet.

### 5.6. Két azonos nevű játékos (pl. Müller / Müller)

- A combobox a meglévő logikát követi: név + csapat + mezszám együtt látszik a dropdown sorban (`Müller · DEU · #25` vs `Müller · NED · #14`). A trigger compact view-ban csak a név + csapat zászló látszik – ha ugyanaz a név mindkét csapatban, megkülönböztet a zászló. Edge eset, de a meglévő combobox ezt jól kezeli.

### 5.7. Mobile keyboard a list oldalon

- A két gólszám inputon `inputmode="numeric"` – a numerikus billentyűzet jön elő. A góllövő select tap-re a billentyűzetet **bezárja** (focus váltás), és egy `searchable` input + dropdown nyílik. Hogy ne ugráljon a layout: a dropdown `position: absolute z-30`, ahogy most is.
- iOS Safari: a select trigger `readOnly` ne legyen (külön kérdés a comboboxnál), különben gyors search nem működik. A meglévő `PlayerSelectCombobox` ezt már jól megoldja.

---

## 6. Komponens javaslat

### Döntés: a meglévő `PlayerSelectCombobox.vue`-t **bővítjük**, nem hozunk létre újat

Indok: a komponens már tudja a kereshetőséget, zászlót, dropdownt, free-text fallback-et, és más story-k (special predictions) is használják. Új feature-öket prop-okon keresztül kapcsolunk be.

### Új propok (additív, nem törő)

```ts
defineProps<{
  modelValue: string | null
  leagueId?: string | null
  answerLabel?: string | null

  // ÚJ – SCORER-001:
  /** Csak ezen csapatok játékosai jelenjenek meg, csapatonként groupolva */
  restrictToTeams?: ReadonlyArray<{ id: string; name: string; shortCode: string; flagUrl: string | null }>
  /** Mutassa a poszt + mezszám meta-adatot a sorban */
  showPlayerMeta?: boolean
  /** Sűrített trigger (h-8) vagy laza (h-10). Default: 'comfortable' */
  size?: 'compact' | 'comfortable'
  /** Dropdown alján expliciten megjelenik a "Töröl" sor */
  allowExplicitClear?: boolean
}>()
```

A render:

- ha `restrictToTeams` adott → a `playersList`-et `teamId` szerint csoportosítva renderelünk `<li>` szekciókkal (sticky csoportfejléc).
- `showPlayerMeta=true` → a sorban jobbra `text-xs text-slate-400` `position · #shirt` (csak ha van adat).
- `size='compact'` → trigger `h-8 text-sm`; `comfortable` → `h-10 text-base`.

### Direkt használat — nincs wrapper komponens

A `PlayerSelectCombobox`-ot **közvetlenül** beillesztjük a `MatchesView` és `MatchDetailView` template-jébe. Külön `MatchScorerPicker.vue` wrapper-t **nem hozunk létre** — felesleges absztrakciós réteg lenne, semmilyen logikát nem kapcsol össze, csak prop-átadást, a komponens teljes konfigurációja prop-okkal lefedhető:

```vue
<!-- MatchesView.vue (tippelhető meccs kártyán, gólszám inputok ALATT) -->
<PlayerSelectCombobox
  v-model="prediction.scorerPickPlayerId"
  :restrict-to-teams="[match.homeTeam, match.awayTeam]"
  :league-id="match.league?.id"
  size="compact"
  :allow-explicit-clear="true"
  :placeholder="$t('matches.scorer.placeholderCompact')"
  @update:model-value="onScorerChange"
/>
```

```vue
<!-- MatchDetailView.vue (tipp kártya alszekciójában) -->
<div class="match-scorer-section">
  <header class="flex items-center justify-between mb-2">
    <h3 class="text-sm font-semibold text-gray-700">⚽ {{ $t('matches.scorer.label') }}</h3>
    <span class="text-xs text-gray-400">{{ $t('matches.scorer.optional') }}</span>
    <KnockoutScorerInfoTooltip v-if="isKnockoutStage(match.stage)" />
  </header>
  <PlayerSelectCombobox
    v-model="prediction.scorerPickPlayerId"
    :restrict-to-teams="[match.homeTeam, match.awayTeam]"
    :league-id="match.league?.id"
    size="comfortable"
    :show-player-meta="true"
    :allow-explicit-clear="true"
    :placeholder="$t('matches.scorer.placeholderComfortable')"
    @update:model-value="onScorerChange"
  />
</div>
```

A knockout `ⓘ` tooltip apró egyedi komponens (`KnockoutScorerInfoTooltip`) — egyetlen szöveggel és a meglévő tooltip komponens body-jával. Nem fogja a combobox-ot, csak vizuálisan mellette áll.

**Tesztelhetőség:** a `MatchesView.test.ts` és `MatchDetailView.test.ts` mockolja a `PlayerSelectCombobox`-ot (ahogy a `TournamentTipsView.test.ts` is teszi), és a teszteket közvetlenül ezeken a view-kon írjuk — nem szükséges külön `MatchScorerPicker.spec.ts`. A `PlayerSelectCombobox.spec.ts` viszont bővül a 4 új prop tesztjével (`restrictToTeams`, `showPlayerMeta`, `size`, `allowExplicitClear`).

### Store

`predictions.store.ts` `upsertPrediction` payload-ja kibővül `scorerPickPlayerId` mezővel (a `PredictionInput` típus szintén). Külön action **nem szükséges** – a góllövő mentés ugyanaz a flow, ugyanaz a 2s debounce, ugyanaz a "Tipp elmentve" toast. A guard condition: csak akkor küld payloadot, ha a meccs gólszámai is be vannak töltve (a `scorerPickPlayerId` egyedül nem trigger-eli).

---

## 7. Accessibility

### Aria / szemantika

- A select trigger `role="combobox"` (a meglévő combobox-ban már implicit, mert input + lista – meg kell erősíteni explicit `role="combobox" aria-expanded="dropdownOpen" aria-controls="scorer-options-{matchId}"` attributumokkal).
- `aria-label="Góllövő tipp – válassz játékost a {homeTeamName} vagy {awayTeamName} csapatból"` – mobile-on a select trigger önmagában nem ad elég kontextust screen readernek.
- A dropdown `<ul role="listbox">`, opciók `role="option" aria-selected`.
- Csoport fejlécek: `role="presentation"` vagy `<li role="group" aria-label="Magyarország játékosai">`. Aria-friendly: minden `option` `aria-label` tartalmazza a csapat nevét is (pl. `Szoboszlai Dominik – Magyarország – 10-es mezszám`).
- A clear `×` gomb: `aria-label="Góllövő tipp törlése"`, `type="button"`.
- A `ⓘ` info ikon: `aria-label="Góllövő tipp szabályok"`, `role="button" tabindex="0"`. Tap / Enter / Space megnyitja a popovert. A popover `role="tooltip"` és `aria-describedby`-vel kötjük a triggerhez.

### Billentyűzet

- Tab-bal a dropdown trigger fókuszálható, Enter / Space megnyitja.
- Nyíl billentyűk: ↓ / ↑ a dropdown opciói között, csapatfejlécen átugorva (skippable, ne legyen fókuszolható). Home / End ugrás a lista elejére / végére.
- Esc bezárja a dropdownt és visszaad fókuszt a triggernek.
- Enter kiválasztja a fókuszált opciót → autosave indul.
- A `×` clear gomb külön Tab stop a triggeren belül.
- A list oldalon a billentyűzetes navigáció ne törje meg a meccs tipp gólszám-input "számjegy → következő input" automatát: a select **utána** kapja a Tab fókuszt (DOM order), és a gólszám-input keydown handler (`onGoalKeydown`) nem érinti.

### Screen reader üzenetek

- Save status: a "Tipp elmentve" sor `aria-live="polite"` (a meglévő minta már így működik a meccs tippnél – csak ráhúzzuk a góllövő mentésre is). Kiértékelés utáni badge: `aria-label="Góllövő tipp eltalálta, +1 pont"` / `"Góllövő tipp nem talált, 0 pont"`.
- Loading: `aria-busy="true"` a select trigger körül.
- Error: a hibasor `role="alert" aria-live="assertive"`.

### Kontraszt

- Minden a fent használt tailwind kombinációk WCAG AA-t teljesítenek a meglévő `MatchesView.vue` palettán (gray-500 on white, blue-600 on white, green-700 on green-50, stb.). Az `italic text-slate-400` placeholderek 4.5:1 alatt vannak, de **placeholder szövegre** ez konvenció szerint elfogadott; a tényleges üzenetek (pl. "A keretek még nem érhetők el") `text-gray-500` szintűek.

---

## 8. Nyitott kérdések (UX szinten)

1. **Tooltip komponens**: van-e már általános `TooltipIcon`? Ha nincs, az 5.3 ⓘ-hez új mini-komponens kell (~30 sor). A meglévő `ScoringExplainerTrigger.vue` mintát követhetjük.
2. **Vizuális badge a list kártyán a kiértékelés után**: a backend a `predictions.scorer_bonus_points` mezőben **nyers 0/1**-et tárol (audit / UI célból), míg a teljes meccs pont `points_global` mezője a multiplied végértéket (`(resultPoints + scorerBonus) * favoriteTeamMultiplier`). A UI tehát a nyers `scorerBonusPoints`-ot mutatja a játékos név melletti badge-en (`✓ +1` vagy ✗), és a kedvenc csapat × 2 szorzót **a meccs összpontján** vizualizálja (a meccs összpont badge `pointsGlobal` érték már tartalmazza a duplázást). Ha kedvenc csapat meccsén talált a góllövő, a badge `✓ +1 (×2 a meccsen)` szöveggel egészül ki — kis méretben (`text-[0.6rem]`).
3. **i18n kulcsok**: új namespace `matches.scorer.*` (pl. `label`, `placeholderCompact`, `placeholderComfortable`, `optional`, `delete`, `loadingPlayers`, `noRoster`, `penaltyDoesNotCount`, `hit`, `miss`, `pending`, `favoriteDoubled`). Magyar + angol fordítás story részeként.
4. **Empty / "nincs tipp" feirat a list kártyán**: a meccs tipp jelenleg "Még nem tippeltél erre a meccsre" amber sort ad. Adjunk hozzá egy hasonlót a góllövő hiányára? **Javaslat: NE** – túl zajos lenne. Az "(opcionális)" placeholder a select triggerben elég.
5. **Csak teljes tipp mellé** — UI affordance: a góllövő select disabled állapotban legyen, amíg a gólszámok üresek? **Javaslat: igen, halványítva** (`opacity-60 cursor-not-allowed`), tooltip: "Először add le a meccs eredménytippjét". Ez világosabb mint a backend 400 hiba.

---

## 9. Összefoglaló: a megvalósítás lépései (impl story-nak indokolás)

1. `PlayerSelectCombobox.vue` bővítés: `restrictToTeams`, `showPlayerMeta`, `size`, `allowExplicitClear` propok + groupolt render. Tesztek: 4 új propra a `PlayerSelectCombobox.spec.ts`-ben.
2. `MatchesView.vue` – tippelhető meccs tipp blokkjába közvetlenül `<PlayerSelectCombobox size="compact" :restrict-to-teams="…" :allow-explicit-clear="true" />`, gólszám inputok ALATT. Locked ágba a kompakt megjelenítés (név + csapat zászló + badge).
3. `MatchDetailView.vue` – tipp kártya alszekciója közvetlenül `<PlayerSelectCombobox size="comfortable" :show-player-meta="true" :restrict-to-teams="…" :allow-explicit-clear="true" />` + knockout `KnockoutScorerInfoTooltip` (apró egyedi komponens).
4. `predictions.store.ts` – `PredictionInput` bővítés `scorerPickPlayerId`-vel; `Prediction` bővítés `scorerPickPlayerId`, `scorerPlayerNameSnapshot`, `scorerBonusPoints` read-only mezőkkel. A `savePrediction` őr: csak akkor küld payloadot, ha gólszámok megvannak.
5. i18n kulcsok hozzáadása (`matches.scorer.*`).
6. Tesztek: `PlayerSelectCombobox.spec.ts` bővítés (4 új prop), `MatchesView.test.ts` és `MatchDetailView.test.ts` bővítés (autosave a gólszámokkal együtt, scorer-only nem trigger, törlés, knockout tooltip render).

**Nem készül** új `MatchScorerPicker.vue` wrapper komponens (felesleges absztrakció).

---

> Minden további részlet (DB, backend, scoring függvény) a `SCORER-001-arch.md` és `SCORER-001-api-research.md` dokumentumokban.
