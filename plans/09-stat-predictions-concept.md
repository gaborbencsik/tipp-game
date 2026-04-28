# Torna Tippek -- Termekkoncepcio

> Munkanev: **Torna Tippek**
> Datum: 2026-04-27
> Statusz: Elfogadott irany
> Alapja: UX designer review + marketing strategist review szintezise

---

## 1. Vizio

A Torna Tippek a VB-elmeny meghosszabbitasa a csoportokon belul. A tagok nem csak meccseket tippelnek, hanem a torna nagy kerdeseit is megvalaszoljak -- ki lesz a golkiraly, melyik csapat nyeri a VB-t, hany gol esik az elodontoben. Ez a feature az, ami a VB alatt fenntartja a beszedtemaket a csoportban akkor is, amikor eppen nincs meccs.

**A cel:** Minden csoporttagnak legyen napi oka visszaterni az appba -- akar megnezni masok tippjeit, akar latni, hogy az o golkiraly-tippje meg tartja-e magat.

**Hogyan kell ereznie magat a felhasznalonak:**
- **Tag:** "Gyorsan latom mit kell megtippelnem, mikor jar le, es mit tippeltek masok -- ez a napi adag szurkoloi vita az appban."
- **Admin:** "Ket kattintas es a csoportomban megjelenik minden fontos VB-tipp, nem kell kulonkodnom."

---

## 2. Jelenlegi allapot es diagnosztika

### Ami mar kesz (US-901-A..E, US-902-A..B, US-910, US-911, US-920, US-921, US-922, US-925, US-926, US-927)

A teljes backend pipeline mukodik: tipus CRUD, tipp bekuldese, kiertekeles, globalis tipusok, feliratkozas, csoport ranglista integracio. A frontend admin konfig UI es a tag tipp UI is kesz, beleertve a team_select es player_select input tipusokat.

### A fo problemak (prioritas szerint)

**P1 -- Nulla szocialis visibilitasa a tippeknek.** Ez a legnagyobb problema. A tagok leadjak a tippet es hetekig nem latnak semmit. Nincs "Gabor Mbappet valasztotta" pillanat. A stat tippek ereje a vitaban van, nem a pontszamitasban. Vita nelkul a feature holt.

**P2 -- A hataridok lathatatlanok.** Statikus datum string, semmi surgosseg. Minden fogados app visszaszamlalot hasznal. A felhasznalok lemaradnak a tipprol anelkul, hogy tudnak rola.

**P3 -- Az admin bottleneck.** Ha az admin elfelejt kiertekelesni, a feature meghal abban a csoportban. Ket megoldas van: auto-evaluate a globalis tipusokhoz (site admin egyszer kiertekeli, cascade mindenhova), es nudge az admin fele.

**P4 -- A tab passziv es lathatatlan.** Nincs badge, nincs szamlalo, a user nem tudja hogy van valami nyitott tipp. A "Stat tippek" tab nev nem mond semmit -- a "Torna tippek" sokkal jobb.

**P5 -- Az admin Beallitasok tab tulterhelt.** Pontrendszer, globalis feliratkozasok, es egyedi tipusok CRUD mind egy scrollozhato oldalon. Szet kell valasztani.

**P6 -- A "Platform" badge zsargon.** A tagok nem tudjak mit jelent. Ez admin-koncepcionak a tagokra valo kifolyasa. Megoldas: "Hivatalos" (Official).

### Ismert bug

A `correctAnswer` mezo nyers UUID-t mutat `team_select` es `player_select` tipusoknal a kiertekelt allapotban. Az `answerLabel` fix mar mukodik a tag valaszainal, de a helyes valasz megjelenitesre nem lett alkalmazva.

---

## 3. Elnevezesi dontes

| Jelenlegi | Uj | Indoklas |
|-----------|-----|---------|
| "Stat tippek" (tab nev) | **"Torna tippek"** | A "stat" technikai, a "torna" megfelelo kontextust ad. A felhasznalo a tornat tippeli meg, nem egy statisztikat. |
| "Platform" (badge a tipuson) | **"Hivatalos"** | A "Platform" admin-zsargon. A "Hivatalos" ertheto es tekintelt ad a tipusnak. |
| `special_prediction_types` (DB tabla) | **Valtozatlan** | DB-szinten nincs felhasznalo -- a technikai nev maradhat. |
| Tab sorrend | Ranglista > **Torna tippek** > Tagok > Beallitasok | A torna tippek a ranglista utan a legfontosabb tag-elmenyt nyujtja. |

**Dontott:** "Torna tippek" tab, "Hivatalos" badge. Semmi mast nem kell atnevezni.

---

## 4. Hullamok (Waves)

### Wave 1 -- Indulas elott (most --> junius kozepe, ~5 het)

A cel: a feature legyen hasznalhato, latogatott, es szocialis. Ezek a minimum elvarasok ahhoz, hogy a torna tippek ne legyenek holt feature a VB indulaskor.

### Wave 2 -- Torna kozben (junius-julius)

A cel: engagement novelese a tornaban, adminok terhenek csokkentese. Ezek a dolgok, amik a torna kozben kellenek, de nem blokkolok az indulashoz.

### Wave 3 -- Post-torna (augusztus+)

A cel: Challenge mechanikak, deep analytics, ujrafelhasznalhato feature a kovetkezo ligasezonra.

---

## 5. Epice-ek es story-k

### Wave 1 -- Must Ship Before Launch

---

#### US-930: Atnevezes: "Torna tippek" tab + "Hivatalos" badge

**Leiras:** A GroupDetailView-ban a "Stat tippek" tab szoveg lecserelese "Torna tippek"-re. A stat prediction kártyákon a "Platform" badge lecserelese "Hivatalos"-ra.

**Miert fontos:** A "stat" es "platform" szavak technikai zsargonak, amik zavarjak a felhasznalokat. Ez 15 perces munka, azonnali hatasa van a felhasznaloi elvezetre.

**Scope:** INCLUDED: tab label, badge szoveg, `predictionStatusLabel` ha releváns. EXCLUDED: DB-szintu atnevezes, URL-ek, API endpoint nevek.

**Effort:** XS (15 perc)
**Priority:** Must Have (Wave 1)
**Addresses:** UX #4, Marketing #5

---

#### US-931: Hataridő surgossegi jelzes (countdown + szinezés)

**Leiras:** A torna tipp kartyakon a hataridot relativ idoben kell megjelenitenni ("3 nap mulva", "5 ora mulva") szinkodolassal: szurke >48h, amber <24h, piros+pulsing <2h, lakat ikon amikor lezarult.

**Miert fontos:** A hataridok a stat tippek legfontosabb interakcios eleme. Ha a user nem erzi a surgosseget, lemarad. Minden fogados app visszaszamlalot hasznal -- ennek az alapveto elvarasnak meg kell felelni.

**Scope:** INCLUDED: relativ ido kiiras, szinkodolas (4 szint), lakat ikon lezart statuszban. EXCLUDED: push notification, email emlekeztetok, real-time countdown timer (perces frissites eleg, setInterval 60s).

**Effort:** S
**Priority:** Must Have (Wave 1)
**Addresses:** UX #2, Marketing extras (#4 countdown)

---

#### US-932: Uj csoportok automatikus feliratkozasa minden Hivatalos tipusra

**Leiras:** Csoport letrehozasakor automatikusan feliratkozik az osszes letező globalis stat tipp tipusra. Az admin manuálisan leiratkozhat a Beallitasok tabon.

**Miert fontos:** Jelenleg az uj csoportok uresen indulnak -- az admin kézzel kell feliratkoztassa a tipusokat egyenkent. A legtobb admin ezt nem fogja megcsinalni, a tagok soha nem latjak a torna tippeket. Az auto-subscribe radikalisan noveli az aktivaciot.

**Scope:** INCLUDED: backend logika a `createGroup` service-ben, meglevo `groups.service.ts` modositasa. EXCLUDED: retroaktiv feliratkozas a mar letreho csoportokra (manualis admin muvelet marad), uj UI elem.

**Effort:** S (1 ora backend, nincs frontend valtozas)
**Priority:** Must Have (Wave 1)
**Addresses:** Marketing #1

---

#### US-933: Badge counter a "Torna tippek" tabon

**Leiras:** A GroupDetailView tab baren a "Torna tippek" tab szoveg melle egy szamlalo badge kerul, ami mutatja a nyitott (meg nem leadott, hataridő nem járt le) tippek szamat.

**Miert fontos:** A user nem tudja, hogy van-e tennivaloja a tab mogott. A badge FOMO-t es cselekvesi kesztettet kelt. A legtobb mobil alkalmazas erre epit.

**Scope:** INCLUDED: badge a tabon, count szamitas a store-ban (nyitott tipusok - leadott tippek), piros szin ha >0. EXCLUDED: push notification, sidebar-szintu badge, app-szintu ertesites.

**Effort:** S (30 perc)
**Priority:** Must Have (Wave 1)
**Addresses:** Marketing #2

---

#### US-934: Masok tippjeinek megjelenitese hataridő utan (aggregalt)

**Leiras:** A "Torna tippek" tabon minden lezart (hataridő lejart) tipusnal megjelenik egy aggregalt bontas a csoporttagok valaszaibol: "Mbappe (5), Vinicius (3), Haaland (2)". Egyeni felhasznalonev nelkul, csak valasz + count. Ha kevesebb mint 3 kulonbozo valasz van, a nevek is megjelenhetnek.

**Miert fontos:** Ez a feature szocialis magja. A stat tippek ereje abban van, hogy latod masok velemenyeit es osszehasonlitod a sajatoddal. Enelkul a feature egy ures ulapra valo tippeles. A marketing strategist jol azonositotta: a "Gabor Mbappet valasztotta" momentum az engagement kulcsa.

**Scope:** INCLUDED: uj backend endpoint `GET /api/groups/:groupId/special-predictions/summary` (aggregalt valaszok tipusonkent, deadline utan), frontend megjelenites a kartyakon. EXCLUDED: egyeni nevek hozzarendelese valaszokhoz (GDPR/fair play; a tagok nem latjak ki mit tippelt egyenileg), real-time frissites, vizualis chart.

**Effort:** M
**Priority:** Must Have (Wave 1)
**Addresses:** Marketing #3 (ez a legnagyobb engagement unlock)

---

#### BUG-002: correctAnswer nyers UUID megjelenites javitasa

**Leiras:** A kiertekelt torna tipp kartyakon a helyes valasz mezoben (`sp.correctAnswer`) nyers UUID jelenik meg `team_select` es `player_select` tipusoknal. A megoldas: a backend valaszban a `correctAnswer` melle kuldjuk a `correctAnswerLabel`-t is (mint ahogy az `answerLabel` mar mukodik a tagok valaszainal).

**Miert fontos:** A kiertekelt allapot az egyetlen pont ahol a user pozitiv visszajelzest kap. Ha a "helyes valasz" egy UUID, az a feature legitimaciot rontja.

**Scope:** INCLUDED: backend response bovites `correctAnswerLabel` mezovel, frontend hasznalata. EXCLUDED: frontend-only cache megoldas (a backend az autorimatas forras).

**Effort:** S
**Priority:** Must Have (Wave 1)
**Addresses:** UX bug

---

#### US-935: Kartya allapot-alapu vizualis redesign (3 allapot)

**Leiras:** A torna tipp kartyak jelenleg flat -- minden elemnek (cim, badge, metadata, input, gomb, statusz) egyforman nagy a vizualis sulya. 3 distinct allapot-layout kell:

1. **Nyitott:** A beviteli mezo es a hataridő dominansan latszik, a metaadat masodlagos
2. **Leadva:** A valasz hero-szeruen jelenik meg kozepen, az input osszecsukva, "Modosit" link
3. **Kiertekelt:** Eredmeny osszehasonlitas (a te tipped vs helyes valasz), pont kiemelese, masok valaszai (US-934)

**Miert fontos:** A flat kartya nem kozli a prioritast. A user nem tudja hova nezzen. A 3 allapot vizualisan vezeti a felhasznalot vegig az elmenyen: nyitott = cselekedj, leadva = varakozz, kiertekelt = nézd meg az eredmenyt.

**Scope:** INCLUDED: kartya layout 3 allapotra, vizualis hierarchia (tipografia, spacing, szin). EXCLUDED: animaciok, confetti, transitions.

**Effort:** M
**Priority:** Should Have (Wave 1)
**Addresses:** UX #1

---

#### US-936: Bővitett sablonok (Best Young Player, First Goal, Final Matchup, Total Goals)

**Leiras:** A jelenlegi sablon listat bovitjuk 4 uj elemmel: "Legjobb fiatal jatekos" (player_select), "Az elso gol szerzoje" (player_select), "VB donto parositasa" (text), "Osszes gol a tornán" (number). Ezek a preset_templates tabla INSERT-jei.

**Miert fontos:** A sablonok csokkentik az admin terhet es gazdagitjak az elmenyt. A jelenlegi 3-4 sablon keves -- a felhasznalok tobb kerdesre akarnak tippelni.

**Scope:** INCLUDED: 4 uj sablon a backend seeds/preset-ben, megjelenes az admin template picker-ben. EXCLUDED: uj input tipusok, UI valtozas.

**Effort:** XS (30 perc, csak DB seed)
**Priority:** Should Have (Wave 1)
**Addresses:** Marketing #4

---

### Wave 2 -- Torna kozben

---

#### US-937: Globalis stat tipp kaszkad kiertekeles

**Leiras:** Amikor a site admin kiertekeli egy globalis stat tipp tipust (helyes valasz beallitasa), az automatikusan kaszkadol az osszes feliratkozott csoportra -- a csoporton beluli pontszamitas automatikusan lefut minden tag tippjere.

**Miert fontos:** Jelenleg az admin bottleneck duplalt: a site admin megadja a helyes valaszt, DE utana minden egyes csoport admin kulon meg kell csinalja a sajat csoportjabol. Ha 50 csoport iratkozott fel a "VB bajnok" tipusra, 50 adminnak kell manuálisan kiertekelesni. Ez nem fog megtortenni. A kaszkad eliminalja ezt: egy kattintas a site admintol = mindenhol kiertekelt.

**Scope:** INCLUDED: a `setCorrectAnswer` a globalis tipuson triggeli a pontszamitast minden feliratkozott csoportban, backend-only logika. EXCLUDED: UI valtozas (a meglevo admin UI marad), csoport-szintu override lehetoseg (az egesz lenyege pont az, hogy nincs override).

**Effort:** M
**Priority:** Should Have (Wave 2)
**Addresses:** Marketing bigger idea #2

---

#### US-938: Social proof: "X-en talaltak el" kiertekeles utan

**Leiras:** A kiertekelt torna tipp kartyan megjelenik egy sor: "3/12 tag talalte el" (vagy szazalekos bontas). Ez a meglevo aggregalt adat (US-934) egy egyszerű kiegeszitese.

**Miert fontos:** Engagementet general -- latni, hogy a csoportbol hanyan gondolkodtak hasonloan. Erositi a kozossegi elmenyt.

**Scope:** INCLUDED: count szamitas a backend summary endpoint-bol, megjelenites a kartyan. EXCLUDED: nev szerinti bontas, chart.

**Effort:** S
**Priority:** Should Have (Wave 2)
**Addresses:** Marketing bigger idea #4

---

#### US-939: Admin Beallitasok tab szetszedesese (scoring / Hivatalos tipusok / egyedi tipusok)

**Leiras:** A jelenlegi Beallitasok tab harom vizualisan elkulonitett szekciora bomlik accordion/card layouttal: (1) Pontrendszer, (2) Hivatalos torna tippek (globalis feliratkozasok), (3) Egyedi torna tippek (CRUD). Minden szekció osszecsukhato.

**Miert fontos:** Jelenleg a harom funkcio egy scrollozhato oldalon van, ami atkutathatatlanna vali ahogy nő a tartalom. A szetvalasztas csokkenti az admin kognitiv terhet.

**Scope:** INCLUDED: vizualis szetvalasztas (accordion vagy card layout), osszecsukas. EXCLUDED: kulon route-ok, tab-ok.

**Effort:** S
**Priority:** Should Have (Wave 2)
**Addresses:** UX #3

---

### Wave 3 -- Post-torna

---

#### US-940: Challenge mechanika (hívd ki a haverod)

**Leiras:** Egy tag kihivhat egy masik tagot a csoportjaban, hogy adja le a tippjet egy adott torna tipp tipusra. A kihivas pushon/bell notification-on ertesit.

**Miert fontos:** A szocialis engagement legeroteljesebb formaja. De fugg az ertesitesi rendszertol (UX-013) es tul bonyolult a lanch elott.

**Scope:** EXCLUDED a kozvetlen roadmap-bol. Majd ha az ertesitesi rendszer kesz.

**Effort:** L
**Priority:** Nice to Have (Wave 3)
**Addresses:** Marketing bigger idea #1

---

#### US-941: Pozitiv visszajelzes kiertekeles utan (helyes valasz celebration)

**Leiras:** Ha a kiertekeles utan a user tippje helyes volt, a kartya vizualisan jelez (zold hatter, pipa ikon, opcionalisan konfetti). Helytelen eseten is tiszta vizualis visszajelzes (szurke, X ikon).

**Miert fontos:** A kiertekeles a feature erzelmi csucspontja. Jelenleg nincs semmi emocio -- csak egy szam. De ez a VB kozben masodlagos a szocialis funkciokhoz kepest, es a kartya redesign (US-935) sokat javit mar onmagaban.

**Effort:** S
**Priority:** Nice to Have (Wave 3)
**Addresses:** UX #5

---

## 6. Prioritas osszefoglalo

### Must Have (Wave 1 -- indulas elott)

| ID | Nev | Effort | Indoklas |
|----|-----|--------|----------|
| US-930 | Atnevezes: "Torna tippek" + "Hivatalos" | XS | Zsargon elttavolitasa, 15 perc |
| US-931 | Hataridő surgossegi jelzes | S | Alapveto UX elvárás, lemaradás megakadalyozasa |
| US-932 | Uj csoportok auto-feliratkozas | S | Aktivacio maximalizalasa, 1 ora |
| US-933 | Badge counter a tabon | S | Discovery/FOMO, 30 perc |
| US-934 | Masok tippjei (aggregalt) | M | A szocialis mag -- enelkul a feature holt |
| BUG-002 | correctAnswer UUID bug | S | Kiertekelt allapot hasznalhatatlansaga |

**Becsult ossz effort:** ~2-3 fejlesztoi nap

### Should Have (Wave 1 + Wave 2)

| ID | Nev | Effort | Wave |
|----|-----|--------|------|
| US-935 | Kartya allapot-alapu redesign | M | 1 |
| US-936 | Bovitett sablonok | XS | 1 |
| US-937 | Globalis kaszkad kiertekeles | M | 2 |
| US-938 | Social proof ("X-en talaltak el") | S | 2 |
| US-939 | Admin Beallitasok tab szetszedesese | S | 2 |

### Nice to Have (Wave 3)

| ID | Nev | Effort |
|----|-----|--------|
| US-940 | Challenge mechanika | L |
| US-941 | Celebration animacio | S |

---

## 7. MVP definicio

A legkisebb verzio ami erdemes szallitani a VB elott:

**BENNE VAN:**
1. US-930 (atnevezes)
2. US-931 (hataridő jelzes)
3. US-932 (auto-subscribe)
4. US-933 (badge counter)
5. US-934 (masok tippjei aggregaltan)
6. BUG-002 (correctAnswer fix)

**NINCS BENNE:**
- Kartya redesign (US-935) -- javit, de nem blokkoló
- Challenge mechanika -- tul komplex
- Celebration animacio -- finom reteg, nem urgensen kell
- PlayerSelectCombobox csapatonkenti csoportositasa -- UX javitas, de a jelenlegi mukodik
- Admin beallitasok szetvalasztasa -- admin-oldali kenyelem, nem tag-erintett

Ez a 6 elem ~2-3 nap effort, es a feature szocialis magja es hasznalhatosaga radikalisan javul.

---

## 8. Sikerkritériumok

1. **Stat tipp kitoltesi arany**: A csoporttagok legalabb 60%-a lead le legalabb egy torna tippet (jelenleg nincs baseline -- ez lesz az). Meres: `count(distinct userId WHERE specialPredictions.answer IS NOT NULL) / count(groupMembers)` csoportonkent.

2. **Torna tippek tab latogatottsaga**: A csoportoldal latogatok legalabb 30%-a megnyitja a "Torna tippek" tabot. Meres: frontend event tracking (tab click count / groupDetail page view).

3. **Hataridő lemaradasi rata**: A nyitott tippek kevesebb mint 25%-a marad tippeletlen a hataridő lejaratakor. Meres: `count(WHERE answer IS NULL AND deadline < now()) / count(WHERE deadline < now())`.

---

## 9. Kockazatok es vakvolttak

### Tevedheto feltetelezes: "A felhasznalok eleg onalloak egy uj tab felfedezéséhez"

Valoszinubb, hogy a felhasznalok soha nem kattintanak a torna tippek tabra, ha nem kapnak erre oket. A badge counter (US-933) elengedhetetlen -- ez nem nice-to-have, hanem az egesz feature discovery-je.

### Scope creep vektor: Az admin UI bonyolitasa

A UX designer review-bol kovetkezo admin settings tab szetvalasztas (US-939) egy realis javitas, de nem szabad elmenni abba az iranyba, hogy az admin UI-t ujratervezzuk. A tag elmenye 10x fontosabb a VB elott. Az admin UX-et a torna kozben, nyugodtabb utotemben lehet javitani.

### Alulbecslés: Masok tippjeinek backendje (US-934)

Az aggregalt tippek megjelenitese egyszerunek hangzik, de uj endpointot igenyel, auth + tagsag ellenorzest, es FONTOS: a hataridő elotti kiszivargast meg kell akadalyozni. A backend validacio a kritikus resz -- soha nem szabad a hataridő elott megmutatni masok tippjeit.

### Tevedheto feltetelezes: "Az adminok kiertekelik a tippeket"

A torna hosszu (1 honapos). A golkiraly tipp kiertekelesehez a torna vegeig kell varni. Ha az admin kozben inaktivva valik, a csoport soha nem kapja meg a pontokat. A globalis kaszkad kiertekeles (US-937) a Wave 2-ben pont erre a problemara valasz -- de ez nem blokkoloja az indulasnak, mert a torna elejen a kiertekeles meg nem aktualis.

### Nem csinalunk: Landing page stat tipp feature card

A marketing strategist javasolta, hogy a landing page-en kiemeljuk a stat tippeket mint differencialo feature. Nem ertunk egyet -- a landing page feladata a regisztracio, nem a feature-ok magyarazata. A stat tippek csoport-beluli feature, a landing page-en a "csoportok + ranglista + automatikus pontozas" a harom ertekhordozo uzenet, nem a stat tippek reszletei.

---

## 10. Fuggosegek a meglevo roadmap-pal

| Ez a story | Fugg ettol | Megjegyzes |
|------------|-----------|------------|
| US-934 (masok tippjei) | Nincs fuggoseg | Uj endpoint, fuggetlen a meglevo kodtol |
| US-937 (kaszkad eval) | US-925, US-927 | Kesz -- a globalis tipusok mar mukodnek |
| US-933 (badge) | US-902-B | Kesz -- a special predictions fetch mar letezik |
| US-935 (redesign) | US-902-B | Kesz -- a kartya komponens mar letezik |

A Wave 1 elemek mindegyike fuggetlen -- parhuzamosithatoak.

---

## 11. Nem csinalunk (es miert nem)

| Otlet | Indoklas a kizarasra |
|-------|---------------------|
| **PlayerSelectCombobox csapatonkenti csoportositas** | Hasznos UX javitas, de a jelenlegi mukodik. A 50 jatekos a fokuszkor nem idealis, de nem blokkoló. Post-launch. |
| **Landing page feature card a stat tippekhez** | Nem differencialo a landing-en. A regisztracio a cel, nem a feature-reszletek. |
| **Egyeni felhasznalonevvel ellátott tipp-megjelenites** | Fair play es GDPR-aggaly: ha latom, hogy Gabor Mbappet valasztotta, az befolyasolhatja a dontesem. Az aggregalt megjelenitest (US-934) hasznaljuk. |
| **Real-time countdown timer** | Tulzott bonyolitas. A relativ ido ("3 ora mulva") 60 masodperces setInterval-lal eleg. A percre pontos visszaszamlalo nem ad tobb erteket. |
| **Stat tipp alapu mini-ranglista a kartya mogott** | Tul korai. A fo ranglista mar tartalmazza a stat tipp pontokat. Kulon mini-ranglista tipusonkent elbonyolitja a UI-t. |
| **Admin nudge/emlekeztetok** | Jo otlet, de fugg az ertesitesi rendszertol (UX-013), ami Nice to Have. |
