# VB Tippjatek -- AI Insights Feature Terv

> High-level terv | Datum: 2026-04-22
> Perspektivak: Product Strategy + UX Design + System Architecture

---

## Tartalom

1. [Feature overview](#1-feature-overview)
2. [Insight tipusok (prioritassal)](#2-insight-tipusok)
3. [UX megjelenes](#3-ux-megjelenes)
4. [Technikai architektura](#4-technikai-architektura)
5. [Fazisok (MVP, v2, v3)](#5-fazisok)
6. [Koltsegbecsles es kockazatok](#6-koltsegbecsles-es-kockazatok)

---

## 1. Feature overview

### Mi ez?

Meccsenként 1-3 **pre-computed insight** jelenik meg a felhasznaloknak a tippeles elott, segitve a donteshozatalban. Az insight-ok nem real-time AI generalt szovegek, hanem **elore kiszamitott, DB-ben tarolt adatpontok**, amelyek a kulso futball API adataibol es a sajat platformunk belso adataibol szarmaznak.

### Miert jo?

| Stakeholder | Ertek |
|-------------|-------|
| **Felhasznalo** | Informaltabb tippeles, tobb fun, tobb engagement -- akkor is erdekes, ha nem kiserik a foballt naponta |
| **Platform** | Magasabb visszatero latogato-arany, hosszabb session-ok, differencialas a sima "beirom a szamokat" tippjatekoktol |
| **Csoport-verseny** | Insight-ok kozos beszelgetesi temak a csoportokban -- "lattad, hogy a Brazilia statistika szerint..." |
| **Retention** | Okot ad naponta visszaterniuk, meg ha eppen nem is tippelnenek |

### Alapelv

> Az insight-ok **segitseget** adnak, nem **predikciokat**. A cel nem "megmondani az eredmenyt", hanem erdekes adatpontokkal gazdagitani a tippeles elmenyet. A felhasznalo donti el, mit kezd vele.

---

## 2. Insight tipusok

6 insight tipus, prioritas sorrendben:

### P1 -- Crowd Wisdom (sajat adat, MVP)

**Forras:** Sajat `predictions` tabla
**Pelda:** "A tippelok 62%-a hazai gyozelmet var. Atlagos tipp: 2-1."
**Megjelenitett adatok:**
- Hazai gyozelem / dontetlen / vendeg gyozelem arany (%)
- Legtobbet tippelt eredmeny (modus)
- Atlagos tippelt golszam (hazai/vendeg kulon)
- Tippelok szama (N)

**Miert P1:**
- Zero kulso API koltseg -- kizarolag a sajat DB-bol szamolhato
- Kozossegi hatas -- a felhasznalo latja masok velemenyet anelkul, hogy a pontos tippeket ismerné
- A meccs elott 24 oraval mar relevans adat all rendelkezesre (elegendo tipp gyulik ossze)
- Egyszeru implementacio: egyetlen SQL aggregacio

**Szabaly:** Csak akkor jelenik meg, ha legalabb N (pl. 10) tipp erkezett a meccsre. Ez megelozi, hogy 2 tippbol "100% hazai" insight szulessen.

**Adat-vedelmi szempont:** Nem fedhetjuk fel egyedi tippeket -- csak aggregalt adatot mutatunk. A meccs lezarasa elott individu tippes nem lathato (ez a jelenlegi rendszerben is igy mukodik).

---

### P2 -- Head-to-Head & Forma (kulso API, MVP)

**Forras:** api-football.com `GET /fixtures/headtohead` + `GET /fixtures?team={id}&last=5`
**Pelda:** "Brazilia vs Argentinia: utolso 5 talalkozasbol 3 braziliai gyozelem. Brazilia forma: GGYWD."
**Megjelenitett adatok:**
- H2H utolso 5 meccs osszesites (gyozelem/dontetlen/vereseg mindket csapatraes)
- H2H utolso 3 eredmeny (1-0, 2-2, 0-3)
- Mindket csapat jelenlegi "forma" (utolso 5 meccs eredmenye: G/D/V betukkel)
- Forma-golszam: utolso 5 meccsben atlag szerzett/kapott golok

**Miert P2:**
- api-football.com `GET /fixtures/headtohead` endpointja kozvetlen valasz -- 1 API hivas meccsenként
- A H2H univerzalis erdekes adat, meg a nem foci-experteknek is
- A "forma" (GGYWD sorozat) vizualisan erosen kommunikal

---

### P3 -- Betting Odds / Eselyek (kulso API, MVP)

**Forras:** The Odds API (`https://the-odds-api.com`) -- `GET /v4/sports/soccer_fifa_world_cup/odds`
**Pelda:** "Fogadasok szerint: Brazilia 52% | Dontetlen 24% | Argentinia 24% -- atlagos total gol: 2.4"
**Megjelenitett adatok:**
- **Meccs-specifikus** gyozelmi eselyek (home / draw / away) szazalekban -- a fogadoirodak oddsaibol szamolva
- Atlagos implied probability tobb bookmaker alapjan (pl. Bet365, Pinnacle, Unibet)
- Over/Under 2.5 gol esely (ha elerheto)
- Opcionalis: odds mozgas jelzese ("Az eselyek az elmaradurak fele mozdultak el az utolso 24 oraban")

**Odds → valoszinuseg konverzio:**
```
implied_probability = 1 / decimal_odds
// Pl.: decimal odds 2.10 → 1/2.10 = 47.6%
// Overround eltavolitasa: normalizalas 100%-ra (harom kimenetel osszege)
```

**Miert P3:**
- A fogadasi eselyek a piac "konszenzusat" turokozik -- szazmilliok altal allando a becslés
- A Crowd Wisdom (P1) a sajat kozosseg tippjeit mutatja, a P3 a **piaci elvaarst** -- a ketto osszehasonlitasa onmagaban erdekes insight
- A felhasznalok nagy resze legalabb hallott fogadasi esleykrol -- az adat azonnal ertheto
- Zero LLM koltseg -- strukturalt adat, nincs szoveg generalas

**The Odds API reszletek:**
- **Ingyenes tier:** 500 request/ho -- VB 64 meccsre elegendo (napi 1-2 lekerdezes osszesen ~120-200 req/ho)
- **Formatum:** JSON, regionalis bookmaker-ek szurhetok (`regions=eu` a europai oddsokhoz)
- **Markets:** `h2h` (1X2 odds), `totals` (over/under), `spreads` (handicap)
- **Keszitseg:** Production-ready, 30+ bookmaker, real-time odds
- **API kulcs:** ingyenes regisztracioval

**Alternativ forrasok (ha The Odds API nem elegendo):**
- **api-football.com `GET /odds?fixture={id}`** -- a Pro tier ($19/ho) tartalmazza, de kevesebb bookmaker
- **api-football.com `GET /predictions?fixture={id}`** -- API-Football sajat AI predikcioja (win %, goals, advice) -- 1 request/meccs
- Kombinalhatoak: The Odds API a piaci oddsokhoz, api-football `/predictions` az AI-vezerelt eselyekhez

**Szabaly:** Csak akkor jelenik meg, ha legalabb 3 bookmaker odds elerheto az adott meccsre. A VB meccsekre ez szinte mindig teljesul.

**Jogi szempont:** Oddsokat *informaciokent* megjeleníteni legalis -- nem fogadasi platform. Tegyunk hozza disclamert: "Forras: piaci eselyek, nem fogadasi ajanlat."

---

### P4 -- Team Statistics (kulso API, v2)

**Forras:** api-football.com `GET /teams/statistics?team={id}&league={id}&season={year}`
**Pelda:** "Nemetorszag: atlag 2.1 szerzett gol/meccs (csoportkorben), 47% hazai gyozelmi arany a VB-n."
**Megjelenitett adatok:**
- Atlagos szerzett golok / kapott golok (liga/torna szinten)
- Hazai vs vendeg teljesitmeny kulonbseg
- Clean sheet arany
- Sarokrugasok atlag (ha van relevancia)
- Legnagyobb gyozelem / vereseg (utolso N meccs)

**Miert P4:**
- Gazdagabb statisztikai melymerules
- A `teams/statistics` endpoint atfogobb adatot ad, de a feldolgozas komplexebb
- Nem minden torna szezonban van eleg adat (VB csoportkorben keves meccs)

---

### P5 -- Injuries & Suspensions (kulso API, v2)

**Forras:** api-football.com `GET /injuries?fixture={id}` vagy `GET /injuries?team={id}&season={year}`
**Pelda:** "Kylian Mbappe (Franciaorszag) -- serult (tedserlules), ketes a jateka."
**Megjelenitett adatok:**
- Serult/eltiltott kulcsjatekosok listaja (max 3-5 fo)
- Serulesek tipusa es sulyossaga (ha elerheto)
- Opcionalis: "X jatekos hianya az utolso Y meccsben Z% pontcsokkenest eredmenyezett" (amennyiben az adat lehetove teszi)

**Miert P5:**
- Magas informacios ertek a tippelok szamara
- A `GET /injuries` endpoint elerheto a Pro tier-en ($19/ho)
- **De:** az adat minosege valtozo -- VB-n jobb, kisebb ligakban hianyos; a relevancia szurest igenyel (ki a "kulcsjatekos"?)

---

### P6 -- Media Insights (cikkek / Medium / sportujsagok, MVP + v2)

**Forras:** RSS feedek, Medium API, sportujsag-oldalak (pl. The Athletic, Goal.com, NSO.hu, nb1.hu)
**Pelda:** "Elemzok szerint Franciaorszag vedelmere kihat Hernandez hianya -- harom cikkbol 2 vendeg gyozelmet var."

#### MVP valtozat (P6a -- "Relevans cikkek + LLM osszefoglalas")

A Media Insights MVP-ben RSS/Medium feedekbol kulcsszavas szures, releváns cikkek cime + link megjelenik a meccsnel, **plusz egy 1-2 mondatos LLM-generalt osszefoglalas** a talalt cikkek **teljes szovege** alapjan.

**Megjelenitett adatok (MVP):**
- 1-3 relevans cikk cime + forras + link (kattinthato, uj tabban nyilik)
- 1-2 mondatos LLM osszefoglalas a cikkek teljes szovegebol (pl. "Az elemzok tobbsege szoros meccset var, de kiemelik Nemetorszag erősebb kozeppalyajat es Mbappe formajat.")
- Kis "AI osszefoglalas" cimke spark ikonnal + disclamer: "Automatikusan generalt"

**Mukodes (MVP):**
- Hardcoded RSS feed lista (5-10 forras): Goal.com, ESPN FC, NSO.hu, nb1.hu, Medium `world-cup-2026` tag
- Cron job: naponta 1-2x lekerdezi a feedeket
- Egyszerü kulcsszavas match: a cikk cimeben vagy leirasaban szerepel valamelyik csapat neve (angol VAGY magyar nev)
- Ha tobb mint 3 talalat: a legfrissebbek jelennek meg
- **Cikk full text begyujtes:** RSS `content:encoded` mezo, vagy ha csonkitott → egyszerű web fetch + HTML-bol szoveg kinyeres (readability-szeru parser)
- **LLM hivas (GPT-4o-mini / Claude Haiku):** a talalt cikkek teljes szovegebol 1-2 mondatos osszefoglalast general meccsenként
- Eredmeny: `match_insights` tablaba iras (`type: 'media'`)

**Koltseg (MVP):**
- RSS: $0 (publikus feedek)
- LLM: ~$0.001/meccs (3 cikk × ~2000 token + 100 token output, GPT-4o-mini) -- VB 64 meccsre ~$0.07 osszesen, napi frissitessel ~$0.60/ho
- **A teljes cikk olvasas gyakorlatilag ugyanannyiba kerul mint a cim-only valtozat** -- GPT-4o-mini input ara elhanyagolhato

**Miert kerul az MVP-be:**
- A felhasznalok tobbsege nem olvas sportcikkeket naponta -- ez azonnali erteket ad
- A teljes szoveg olvasas <$1/ho -- nincs ok a cim-only kompromisszumra
- A teljes cikkbol pontosabb es gazdagabb osszefoglalas keszul, mint pusztan cimekbol
- Az implementacio egyszerű: RSS parse + kulcsszavas filter + web fetch + egy LLM hivas meccsenként + DB insert

#### v2 bovites (P6b -- "Sajtotukro + cikkenkenti kivonat")

**Megjelenitett adatok (v2 bovites):**
- "Sajtotukro": hany cikk var hazai/vendeg/dontetlent (sentiment kategorizalas LLM-mel)
- Cikkenkenti 1 mondatos kivonat (nem csak osszesitett)
- Tobb forras: Twitter/X sportelemzok, podcast transzkripciok

**Lehetseges forrasok (MVP + v2):**
- Medium: tag-alapu kereses (`world-cup-2026`, `football-predictions`)
- RSS: Goal.com, The Athletic, ESPN FC, NSO.hu, nb1.hu
- X/Twitter API: relevans sportelemzok tweetjei (draga, bonyolult -- v2+ only)

**Verifikalt RSS feed lista (MVP -- 5 forras):**

| # | Forras | RSS URL | Tipus | Megjegyzes |
|---|--------|---------|-------|------------|
| 1 | BBC Sport Football | `https://feeds.bbci.co.uk/sport/football/rss.xml` | Hirek, meccs reportok, serulesek | ~60 item, napi frissites, truncated |
| 2 | BBC Sport World Cup | `https://feeds.bbci.co.uk/sport/football/world-cup/rss.xml` | VB 2026 specifikus hirek | Dedikalt WC feed |
| 3 | ESPN FC | `https://www.espn.com/espn/rss/soccer/news` | PL, atigazolasok, VB, elemzesek | ~20 item |
| 4 | FourFourTwo | `https://www.fourfourtwo.com/feeds.xml` | Hirek, elemzesek, elozetesek | ~30 item, full content |
| 5 | The Analyst (Opta) | `https://theanalyst.com/feed` | Adat-vezerelt elemzesek, statisztikak | Full content CDATA, legjobb analitikus |

**Megjegyzes:** Az osszes feed 2026-04-22-en verifikalt es mukodo. A truncated feedeknel (BBC, ESPN) web fetch szukseges a teljes szoveghez. A FourFourTwo es The Analyst full content-et ad az RSS-ben.

---

### P7 -- AI-Generated Match Preview (generativ, v3)

**Forras:** Az osszes elobbi insight + LLM (pl. OpenAI GPT-4o-mini / Claude Haiku)
**Pelda:** "Brazilia nagy favorit a tortenelmi merleg es a jelenlegi forma alapjan. A serulesek Argentiniat sulyosabban erintik. A tippelok tobbsege szoros meccset var."
**Megjelenitett adatok:**
- 2-3 mondatos termeszetes nyelvu osszefoglalas
- Az osszefoglalas a P1-P6 insight-okbol szintetizalodik
- Hangnem: szelid, nem kategorikus ("az adatok alapjan...", nem "biztosan nyer")

**Miert P7:**
- Ez a "premium" feature -- mas tippjatekoknal nem jellemzo
- **De:** LLM API koltseg ($), latencia, es a generalt szoveg minosegellenorzese kihivas
- Csak akkor van ertelme, ha P1-P6 mar mukodik es van eleg input adat
- Token koltseg: GPT-4o-mini-vel ~$0.0001-0.0005 / meccs -- VB 64 meccsre elfogadhato

---

### Osszefoglalo prioritas-matrix

| # | Insight tipus | Forras | API koltseg | Komplexitas | Fazis |
|---|--------------|--------|-------------|-------------|-------|
| P1 | Crowd Wisdom | Sajat DB | $0 | Alacsony | MVP |
| P2 | H2H & Forma | api-football.com | Benne a $19/ho-ban | Kozepes | MVP |
| P3 | Betting Odds / Eselyek | The Odds API | $0 (ingyenes tier) | Alacsony-Kozepes | MVP |
| P6a | Media Insights (cikkek + LLM kivonat) | RSS + LLM (full text) | ~$0.60/ho | Kozepes | MVP |
| P4 | Team Statistics | api-football.com | Benne a $19/ho-ban | Kozepes | v2 |
| P5 | Injuries | api-football.com | Benne a $19/ho-ban | Magas* | v2 |
| P6b | Media Insights (sajtotukro + per-cikk) | RSS + LLM | ~$0.50/ho | Kozepes | v2 |
| P7 | AI Preview | LLM API | ~$0.01-0.05/ho (64 meccs) | Magas | v3 |

*P5 komplexitasa magas a relevancia-szures miatt (ki a "kulcsjatekos"?)

---

## 3. UX megjelenes

### 3.1 Elhelyezes -- hol jelennek meg az insight-ok?

Az insight-ok **ket helyen** jelenhetnek meg:

#### A) Meccs kartya (MatchesView) -- tomoritett, "teaser" mod

A meccskartyak aljan (a tipp input-ok felett) egy **egysoros insight strip** jelenik meg:

```
+-----------------------------------------------+
| [HUN] Magyarorszag   vs   Nemetorszag [GER]  |
| 2026. jun. 15. 18:00 -- A csoport             |
|                                                |
| [bulb] Tippelok 58%-a vendeg gyozelmet var     |
|                                                |
| [ 0 ] - [ 0 ]            [Mentes]             |
+-----------------------------------------------+
```

**Szabalyok:**
- Maximum 1 insight a kartyam (a legfontosabb -- P1 ha van eleg tipp, kulonben P2 H2H)
- Nem terhelhetjuk tul a listazast -- minimalis hely
- Ha nincs insight (keves adat), a strip nem jelenik meg (nincs "ures" allapot)
- Szoveg max ~60 karakter, egy sorban
- A strip kattinthato: megnyitja a meccs reszletes nezetet ahol az osszes insight lathato

#### B) Meccs reszletek (MatchDetailView) -- teljes insight panel

A meccs reszletes nezetben egy **dedikalt "Insights" szekció** jelenik meg az alap info es a tipp form kozott:

```
+-----------------------------------------------+
| <- Vissza                                      |
|                                                |
| [HUN] Magyarorszag  2 - 1  Nemetorszag [GER] |
| 2026. jun. 15. 18:00 | SoFi Stadium, LA      |
| A csoport -- 1. fordulo                        |
|                                                |
| ============================================== |
| [bulb] INSIGHT-OK                              |
| ---------------------------------------------- |
|                                                |
| [chart] Tippeloi konszenzus                    |
|   Hazai: 23%  |  Dontetlen: 19%  |  Vendeg: 58%|
|   Legtobb tipp: 1-2 (14 fo)                   |
|   Tippelok szama: 47                           |
|                                                |
| [history] Elozmeny (H2H)                      |
|   Utolso 5: HUN 1G, 1D, 3V                    |
|   Legutolso: HUN 0-3 GER (2024.10.14)         |
|   GER forma: G G G D G                         |
|   HUN forma: V G D V G                         |
|                                                |
| [odds] Piaci eselyek                           |
|   HUN: 18% (5.50) | Dont: 22% (4.50) | GER: 60% (1.67)|
|   Over 2.5: 58%  |  Under 2.5: 42%            |
|   Forras: 8 fogadoiroda atlaga                 |
|                                                |
| ============================================== |
|                                                |
| [ 0 ] - [ 0 ]            [Mentes]             |
+-----------------------------------------------+
```

### 3.2 Vizualis design irany

**Altalanos stilus:**
- Halvany hatterszin (pl. `bg-blue-50` vagy `bg-amber-50`) -- vizualisan elkulonul a kartya tobbi resetol
- Kicsi ikon (bulb/lightbulb) a szekciocim elott
- A szoveg tomor, adatvezerelt -- nincs "marketinges" hangnem
- Tailwind utility osztalyok, semmilyen kulso charting konyvtar az MVP-ben

**Crowd Wisdom vizualizacio (P1):**
- Harom szazalekos sor egyszeru CSS bar-okkal (hazai / dontetlen / vendeg)
- A legmagasabb ertek felkover kiemelesevel
- Szovegesen: "Legtobb tipp: 2-1 (14 fo)"

**H2H & Forma vizualizacio (P2):**
- Forma szoveg betukkel: `G G V D G` -- szinezett (zold G, piros V, sarga D)
- H2H osszesites: "Utolso 5: 3G 1D 1V"
- Utolso 3 eredmeny egyszeru listaval

**Betting Odds vizualizacio (P3):**
- Harom szazalekos sor (hasonlo a P1-hez, de mas szinnel -- pl. narancs/arany arnyalat)
- A szazalekok melltt a decimal odds zarojelben: "Brazilia 52% (1.92)"
- Over/Under 2.5 gol egy kulon sor: "Over 2.5: 58% | Under 2.5: 42%"
- Kis "Piaci eselyek" cimke + disclamer: "Fogadoirodak konszenzusa, nem tanacs"
- Opcionalis: ha P1 (Crowd Wisdom) is elerheto, osszehasonlito kijelzes: "Kozosseg: 62% | Piac: 52%"

**Injuries vizualizacio (P5, v2):**
- Piros figyelmezteto ikon (serulesekhez)
- Jatekos neve + serules tipusa + "ketes" / "biztosan kimarad" statuszbadge
- Max 3 jatekos -- "es X tovabbi" link ha tobb van

**AI Preview vizualizacio (P7, v3):**
- Szurke/kek hatter kartyaban, kurziv vagy mas megkulonbozteto tipografia
- "AI osszefoglalas" cimke egy kis robot/spark ikonnal
- Kis disclamer: "Az insight automatikusan generalt, nem tanacs."

### 3.3 Interakcio es allapotok

| Allapot | Viselkedes |
|---------|-----------|
| **Insight elerheto** | Megjelenik a strip/panel |
| **Nincs eleg adat** (pl. < 10 tipp) | Nem jelenik meg semmi -- tiszta, ures |
| **Betoltes alatt** | Kicsi skeleton placeholder (nem blokkolo -- a meccs info es tipp form azonnal betolt) |
| **API hiba** | Csendben elnyeli -- nincs hiba uzenet a felhasznalonak; az insight nem jelenik meg |
| **Meccs lezarult** | Az insight-ok megmaradnak (archiv mod) -- "Igy latta a kozosseg a meccs elott" |

### 3.4 Mobil UX

- A meccs kartyan az insight strip max 1 sor, nem torik
- A detail nezetben az insight panel teljes szelessegu kartya, gorgethetoen
- A szazalekos bar-ok vizszintes, a szoveg balra igazitott
- Nem terheli a fold-above tartalmat -- a tipp form prioritasos

### 3.5 Accessibility

- Az insight szekciora ARIA `role="complementary"` -- kepernyoolvasok "extra informacio"-kent ertelmezik
- A szazalekos bar-oknal `aria-label` az ertekkel
- A szinezett forma betuk (G/V/D) mellett szoveges label is van -- ne csak szin hordozza a jelentest

---

## 4. Technikai architektura

### 4.1 Alapelv: Pre-Computation, nem Real-Time

Az insight-ok **nem a user keresere** szamitodnak ki, hanem **utemezetten, elore**. A user mindig **DB-bol olvas**, soha nem var kulso API hivasra.

```
                                          +------------------+
                                          |  api-football.com|
                                          +--------+---------+
                                                   |
                                          (utemezes: cron)
                                                   |
+------------------+    +-------------------+      |
|  Frontend (Vue)  |    |  Koa Backend      |      |
|                  |    |                   |      |
|  GET /api/       |    |  insight.service  |<-----+
|   matches/:id/   +--->|  (pre-compute)    |
|   insights       |    |                   |
|                  |    |  +-----------+    |
|  (csak DB-bol    |    |  | match_    |    |
|   olvas)         |    |  | insights  |    |
+------------------+    |  | tabla     |    |
                        |  +-----------+    |
                        +-------------------+
```

### 4.2 Adatbazis modell

Uj tabla: `match_insights`

```typescript
// Javasolt Drizzle schema irany (veglegesites kesobbi story-ban)

export const insightTypeEnum = pgEnum('insight_type', [
  'crowd_wisdom',      // P1
  'h2h',               // P2
  'betting_odds',      // P3
  'team_stats',        // P4
  'injuries',          // P5
  'media',             // P6
  'ai_preview',        // P7
])

export const matchInsights = pgTable('match_insights', {
  id:          uuid('id').primaryKey().defaultRandom(),
  matchId:     uuid('match_id').notNull().references(() => matches.id, { onDelete: 'cascade' }),
  type:        insightTypeEnum('type').notNull(),
  
  // Strukturalt adat -- insight-tipustol fuggoen mas-mas
  data:        jsonb('data').notNull(),
  
  // Tomoritett szoveges verzio a meccs-kartyara (max ~80 char)
  summary:     varchar('summary', { length: 200 }),
  
  // Mikor generaltuk (frissesseg track)
  generatedAt: timestamp('generated_at', { withTimezone: true }).notNull().defaultNow(),
  
  // Opcionalis: verziozas (ha ujraszamolunk)
  version:     smallint('version').notNull().default(1),

  createdAt:   timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  matchTypeUnique: uniqueIndex('match_insights_match_type_unique').on(t.matchId, t.type),
  matchIdx:        index('match_insights_match_idx').on(t.matchId),
}))
```

**A `data` JSONB mezo tartalma insight-tipusonkent:**

```typescript
// P1: Crowd Wisdom
interface CrowdWisdomData {
  totalPredictions: number
  homeWinPercent: number
  drawPercent: number
  awayWinPercent: number
  mostCommonScore: { home: number; away: number; count: number }
  avgHomeGoals: number
  avgAwayGoals: number
}

// P2: H2H & Forma
interface H2HData {
  h2h: {
    played: number
    homeWins: number
    draws: number
    awayWins: number
    lastMatches: Array<{
      date: string
      homeTeam: string
      awayTeam: string
      homeGoals: number
      awayGoals: number
    }>
  }
  homeTeamForm: string[]   // ['W', 'W', 'D', 'L', 'W']
  awayTeamForm: string[]   // ['L', 'W', 'W', 'W', 'D']
  homeTeamGoalsAvg: number // utolso 5 meccsben
  awayTeamGoalsAvg: number
}

// P3: Betting Odds / Eselyek
interface BettingOddsData {
  homeWinPercent: number         // implied probability, normalizalt
  drawPercent: number
  awayWinPercent: number
  homeWinOdds: number            // decimal odds (pl. 2.10)
  drawOdds: number
  awayWinOdds: number
  overUnder25?: {                // Over/Under 2.5 gol
    overPercent: number
    underPercent: number
  }
  bookmakerCount: number         // hany bookmaker-bol szamoltuk
  source: string                 // 'the-odds-api' | 'api-football'
  lastUpdated: string            // ISO timestamp -- odds mozgas koveteshez
}

// P4: Team Statistics
interface TeamStatsData {
  homeTeam: {
    goalsScored: number
    goalsConceded: number
    matchesPlayed: number
    cleanSheets: number
    homeWinRate: number
  }
  awayTeam: {
    goalsScored: number
    goalsConceded: number
    matchesPlayed: number
    cleanSheets: number
    awayWinRate: number
  }
}

// P5: Injuries
interface InjuriesData {
  homeTeam: Array<{
    player: string
    reason: string        // 'injury' | 'suspension' | 'doubtful'
    type: string          // 'Knee Injury', 'Red Card', etc.
  }>
  awayTeam: Array<{ /* ... */ }>
}

// P6: Media Insights
interface MediaInsightsData {
  articles: Array<{
    title: string
    source: string          // 'Medium', 'Goal.com', 'NSO.hu', stb.
    url: string
    publishedAt: string
    summary?: string        // LLM-generalt rovid kivonat
  }>
  sentimentSummary?: {      // ha kategorizalhato
    homeWinArticles: number
    drawArticles: number
    awayWinArticles: number
  }
}

// P7: AI Preview
interface AIPreviewData {
  text: string            // 2-3 mondat
  model: string           // 'gpt-4o-mini' | 'claude-3-haiku'
  inputInsightTypes: string[] // melyik insight-okbol szintetizalodott ['crowd_wisdom', 'h2h', 'betting_odds', 'media', ...]
}
```

### 4.3 Backend service-ek

```
src/
  services/
    insights/
      insight.service.ts           # orchestrator: melyik insight-ot kell ujraszamolni
      crowd-wisdom.service.ts      # P1: sajat DB aggregacio
      h2h.service.ts               # P2: api-football H2H + forma lekerdezes + DB iras
      betting-odds.service.ts      # P3: The Odds API / api-football odds lekerdezes
      team-stats.service.ts        # P4: api-football team stats
      injuries.service.ts          # P5: api-football injuries
      media.service.ts             # P6: RSS + LLM feldolgozas
      ai-preview.service.ts        # P7: LLM API hivas
  jobs/
    insight.job.ts                 # cron job: mikor, melyik insight-ot kell frissiteni
```

**`insight.service.ts` orchestrator logika:**

```typescript
async function computeInsightsForMatch(matchId: string): Promise<void> {
  const match = await getMatchById(matchId)
  if (match.status !== 'scheduled') return  // csak nyitott meccsekre

  // P1: Crowd Wisdom -- mindig frissit (sajat DB, olcso)
  await crowdWisdom.compute(matchId)

  // P2: H2H -- csak ha meg nincs, vagy > 24 oraja generaltuk
  await h2h.computeIfStale(matchId, { maxAgeHours: 24 })

  // P3: Betting Odds -- naponta 1-2x frissit (The Odds API ingyenes kvota)
  await bettingOdds.computeIfStale(matchId, { maxAgeHours: 12 })

  // P4-P6: fázistol fuggo, kesobbi implementacio
}
```

### 4.4 API endpoint

```
GET /api/matches/:matchId/insights
  -> authMiddleware
  -> Response: MatchInsight[] (az adott meccshez tartozo osszes insight)
```

Az endpoint **kizarolag DB-bol olvas** -- nincs kulso API hivas a keres soran. A valasz cachelheto (max-age: 300 = 5 perc).

Optimalisan a meccs listazo endpoint (`GET /api/matches`) bovitheto egy `includeSummary` query parameter-rel, ami a kartyakhoz szukseges tomoritett insight-ot is visszaadja a meccsekkel egyutt (elkerulve N+1 lekerdezest).

### 4.5 Pre-Computation utemezese (cron job)

Az `insight.job.ts` a meglevo `sync.job.ts` minta alapjan mukodik:

| Feltetel | Muvelet | Gyakorisag |
|----------|---------|-----------|
| Van `scheduled` meccs a kovetkezo 48 oraban | P1 (Crowd Wisdom) ujraszamitas | 30 percenkent |
| Van `scheduled` meccs a kovetkezo 7 napban, nincs H2H adat | P2 (H2H) lekerdezes | Naponta 1x |
| Van `scheduled` meccs a kovetkezo 7 napban, H2H > 24h regi | P2 frissites | 24 orankent |
| Van `scheduled` meccs a kovetkezo 3 napban | P3 (Betting Odds) frissites | 12 orankent |
| Meccs < 6 oraja scheduled | P3 (Betting Odds) frissites | 4 orankent |
| Meccs < 4 oraja scheduled | P5 (Injuries) frissites | 4 oránkent |
| Meccs < 2 oraja scheduled | Minden insight ujra | 2 orankent |
| Meccs `finished` allapotra valtott | P1 "vegso" snapshot mentes | 1x |

**API kvota hatas:**
- api-football.com Pro tier (7500 req/nap): VB 64 meccs eseten max ~64 H2H hivas/nap + ~64 injury hivas/nap = ~130 req/nap
- The Odds API (500 req/ho ingyenes): ~2 req/nap/meccs × kovetkezo 3 nap meccsek (~6-12 meccs) = ~12-24 req/nap → ~360-720 req/ho -- belefér
- Insight-ok egyreszt ritkan frissulnek, masreszt meccsnapokra koncentralodnak

### 4.6 Kulso API endpointok hasznalata

| Insight tipus | API | Endpoint | Req/meccs | Megj. |
|--------------|-----|---------|-----------|-------|
| P2: H2H | api-football.com | `GET /fixtures/headtohead?h2h={team1Id}-{team2Id}&last=5` | 1 | |
| P2: Forma | api-football.com | `GET /fixtures?team={id}&last=5` | 2 (ket csapat) | |
| P3: Odds | The Odds API | `GET /v4/sports/soccer_fifa_world_cup/odds?bookmakers=...&markets=h2h,totals` | 1 (osszes meccs egyben) | Ingyenes tier |
| P3: Odds (alt.) | api-football.com | `GET /odds?fixture={id}` | 1 | Pro tier, kevesebb bookmaker |
| P3: Predictions (alt.) | api-football.com | `GET /predictions?fixture={id}` | 1 | AI predikcio, win %, advice |
| P4: Stats | api-football.com | `GET /teams/statistics?team={id}&league={id}&season={year}` | 2 | |
| P5: Injuries | api-football.com | `GET /injuries?fixture={fixtureId}` | 1 | Pro tier |
| P7: AI Preview | (LLM API) | — | 0 | OpenAI/Claude API |

**The Odds API elony a P3-nal:** Egyetlen hivas az osszes kozelgo meccs oddsjait adja vissza (nem fixture-enkent kell hivni) -- kvota-hatekony.

**Fontos:** A `matches` tablat boviteni kell egy `externalId` (api-football fixture ID) oszloppal, ami a szinkron service (US-1202) mar tervez. Az insight service erre az external ID-ra epul a kulso API hivasoknal.

### 4.7 Caching es frissesseg

- **DB mint cache:** A `match_insights` tabla maga a cache. Az insight mindig DB-bol szervelheto.
- **Frissesseg:** A `generatedAt` mezo jelzi, mikor szamoltuk ki utoljara. A frontend opcionálisan megjelenitheti: "Frissitve: 2 oraja".
- **HTTP cache:** `GET /api/matches/:id/insights` valsza `Cache-Control: public, max-age=300` (5 perc). A CDN-en is cache-elheto.
- **Meccs lezarasa utan:** Az insight-ok megmaradnak archivkent. A Crowd Wisdom frissul egy utolso alkalommal a zaras pillanataban (vegso pillanatkep).

---

## 5. Fazisok

### MVP (Fazis 1) -- "Tippeloi konszenzus + Elozmeny + Eselyek + Media"

**Scope:**
- P1: Crowd Wisdom (sajat DB)
- P2: H2H & Forma (api-football.com)
- P3: Betting Odds / Eselyek (The Odds API -- ingyenes)
- P6a: Media Insights -- relevans cikkek + LLM osszefoglalas (RSS + LLM)

**Miert ez az MVP?**
- A Crowd Wisdom zero kulso koltseg es az implementacio 1-2 nap
- A H2H a legegyertelmubb "hasznos informacio" -- mindenki szamara erdekes
- A Betting Odds piaci konszenzust ad -- a P1 (kozosseg) es P3 (piac) osszehasonlitasa onmagaban ertékes insight; The Odds API ingyenes tier elegendo
- A Media linkek + LLM osszefoglalas azonnali erteket adnak: "na, mit irnak errol a meccsrol?"
- Negy egyutt mar atfogo kepet ad: kozosseg (P1), statisztika (P2), piac (P3), sajto (P6a)
- Az infrastruktura (match_insights tabla, cron job, API endpoint) egyszer epul ki -- kesobbi insight-ok mar erre epulnek

**Elofeltetelek:**
- US-1202 (Futball API szinkronizacios service) legalabb reszlegesen kesz -- a `teams` tabla `externalId` mezovel
- A meglevo cron infrastruktura (US-1203) mukodik
- The Odds API kulcs (ingyenes regisztracio)

**Becsult meret:** 6-8 story (DB migracio, P1 service + tesztek, P2 service + tesztek, P3 odds service + tesztek, P6a RSS + LLM service + tesztek, API endpoint, frontend komponens, cron job bovites)

---

### v2 (Fazis 2) -- "Melyebb statisztikak + Media LLM"

**Scope:**
- P4: Team Statistics
- P5: Injuries & Suspensions
- P6b: Media Insights bovites (sajtotukro + per-cikk kivonat)
- Admin feluleten: insight-ok allapot-attekintese (generalt / hianyzo / hiba)

**Miert v2?**
- A P4 es P5 a kulso API melyebb integrációjat igénylik
- Az injury adat minosege valtozo -- relevancia-szures kell (ki a fontos jatekos?)
- A P6b (sajtotukro) az MVP-s RSS + LLM infrastrukturan epul tovabb
- Admin monitoring hasznos, de nem blokkolja az MVP-t

**Becsult meret:** 3-5 story

---

### v3 (Fazis 3) -- "AI osszefoglalas"

**Scope:**
- P7: AI-Generated Match Preview (szintetizalja P1-P6 insight-okat termeszetes nyelven)
- Opcionalis: felhasznaloi preference beallitasa (melyik insight-okat latja)
- Opcionalis: insight-ok megjelenese a MyTipsView-ban is

**Miert v3?**
- LLM integracio kulon koltseg es komplexitas
- A szoveg minoseg-ellenorzese fontos -- nem akarunk ertelmetlenseget generalni
- Csak akkor van ertelme, ha P1-P6 mar mukodik es van eleg bemeneti adat

**Becsult meret:** 2-3 story

---

### Fazis osszefoglalo idovonal

```
               MVP (Fazis 1)                       v2 (Fazis 2)                   v3 (Fazis 3)
              P1 + P2 + P3 + P6a                   P4 + P5 + P6b                  P7
              |=================================|  |====================|         |========|
              Crowd   H2H &  Betting  Media     Team    Injuries  Media          AI
              Wisdom  Forma  Odds     LLM       Stats             sajtotukro    Preview
                                    
Elofeltetelek: US-1202 (sync svc)                MVP kesz                        v2 kesz
               US-1203 (cron job)                Insight admin UI                LLM API setup
               The Odds API kulcs                LLM API setup                   P1-P6 adat
               RSS feed lista
```

---

## 6. Koltsegbecsles es kockazatok

### Koltseg

| Tetel | MVP | v2 | v3 |
|-------|-----|----|----|
| api-football.com | $0 extra (mar benne a $19/ho Pro-ban) | $0 extra | $0 |
| The Odds API | $0 (ingyenes tier, 500 req/ho) | -- | -- |
| LLM API (OpenAI / Anthropic) | ~$0.60/ho (P6a media LLM) | ~$0.50/ho (P6b) | ~$0.01-0.05/ho (P7, 64 meccs) |
| Fejlesztesi ido | 6-8 story | 3-5 story | 2-3 story |

### Kockazatok

| Kockázat | Hatás | Mitigáció |
|----------|-------|-----------|
| api-football.com rate limit | H2H/injury adatok nem frissulnek idoben | Pre-compute napokkal elobb; cache agressziven; `final_only` sync mod |
| Keves tipp a Crowd Wisdom-hoz | "A tippelok 100%-a..." -- ertelmetlen | Minimum kuszob (N >= 10); ha nincs eleg, nem jelenik meg |
| H2H adat hiany (uj csapat vagy ritka parositás) | Ures H2H szekció | Graceful fallback: "Nincs elozmeny" uzenet, vagy a forma onmagaban megjelenik |
| The Odds API kvota (500 req/ho) | Odds nem frissulnek eleg gyakran | Batch lekerdezes (1 req = osszes meccs); ritkabb frissites tavolabbi meccsekre |
| The Odds API nem fed le VB meccset | Odds hianyoznak | Fallback: api-football.com `/odds` vagy `/predictions` endpoint; ha egyik sem ad adatot, P3 nem jelenik meg |
| Odds megjelenitese jogi aggaly | Felhasznalok fogadasnak ertelmezik | Disclamer: "Piaci eselyek, nem fogadasi ajanlat"; nem linkeljuk fogadoirodakhoz |
| Injury adat minoseg | Hibas/hianyos serules-lista | P5 csak v2-ben, amikor mar van tapasztalat az API adatminoseggel |
| LLM hallucinalas (P6) | Felrevezeto szoveg | Human review vagy template-alapu generalas; "AI generalt" cimke; v3-ban jo QA |
| Felhasznalok "vakon kovetik" az insight-ot | Csoportszintu eredmeny-konvergencia | A megjelenes nem szuggeszt -- "segitseg", nem "tanacs"; disclamer |

### Dontesre varo nyitott kerdesek

1. **P1 kuszob:** Hany tipp kell minimum a Crowd Wisdom megjeleniteshez? Javaslat: 10.
2. **Insight megjelenitesi sorrend:** Ha tobb insight van, melyik jelenjen meg a meccs-kartya strip-en? Javaslat: P1 (crowd) ha van eleg adat, kulonben P2 (H2H summary).
3. **Lezart meccsek insight-jai:** Megmaradjanak archivkent, vagy eltunonek? Javaslat: megmaradnak ("Igy latta a kozosseg").
4. **Csoport-specifikus crowd wisdom:** Csoporton beluli tippelok konszenzusa vs globalis? Kesobbi feature, de az architektura tamogassa.

---

> **Kovetkezo lepes:** Ha a terv elfogadott, a `story-writer` agent reszletes user story-kat ir az MVP fazishoz (P1 + P2 + P3 + P6a + infra).
