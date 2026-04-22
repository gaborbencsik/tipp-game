# Meccsek nezet redesign -- User Story-k

> Forras: `/Users/I525584/Downloads/meccsek-interaktiv.html` interaktiv mockup
> UX elemzes: `plans/06-matches-redesign-ux-review.md`
> Datum: 2026-04-21

---

## UX-009: Match card vizualis redesign

**Story:**
Mint **bejelentkezett felhaszo**, szeretnem, hogy **a meccs kartyak vizualisan gazdagabban jelezzek a tipp allapotot, a kapott pontokat es a meccs statuszt**, hogy **egy pillanatnyi raezesssel lassam, hol allok es hol kell meg tippelnem**.

**Kontextus:**
A jelenlegi `MatchesView` kartyak egyforman neznek ki statusztol fuggetlenul. Az uj design (lasd `meccsek-interaktiv.html` mockup) szinkoddal, szeli csikkal, badge-ekkel es figyelmezteto allapotokkal kulonbozteti meg a kartyakat. Ez a story a `MatchesView.vue` vizualis upgrade-jet vegzi el backend valtozas nelkul.

**Design referencia:** `/Users/I525584/Downloads/meccsek-interaktiv.html`

**Elfogadasi kriteriumok:**

*Kartya allapotok (bal szeli szines csik):*
- [ ] Befejezett + pontos tipp (`pointsGlobal === config.exactMatch`): zold bal szeli csik (`border-l-4 border-green-500`)
- [ ] Befejezett + reszleges pont (1-4 pont): sarga/amber bal szeli csik (`border-l-4 border-amber-500`)
- [ ] Befejezett + 0 pont: szurke bal szeli csik (`border-l-4 border-gray-300`)
- [ ] Tippelt nyitott meccs: kek szegely (`border-blue-200`)
- [ ] Nem tippelt nyitott meccs: sarga szegely (`border-amber-300`) + amber hatter
- [ ] Elo meccs: piros szegely + piros bal szeli csik (`border-red-300 border-l-4 border-l-red-500`)

*Pont badge-ek szinkod szerint:*
- [ ] +5 pont: zold badge (`bg-green-50 text-green-700 border-green-200`)
- [ ] +3 pont: kek badge (`bg-blue-50 text-blue-700 border-blue-200`)
- [ ] +2 pont: amber badge (`bg-amber-50 text-amber-700 border-amber-200`)
- [ ] +1 pont: amber badge (ugyanaz)
- [ ] 0 pont: szurke badge (`bg-gray-100 text-gray-500 border-gray-200`)
- [ ] A badge szovege: `+N pont` (jelenlegi "N pont" helyett)

*Datum fejlec redesign:*
- [ ] A datum fejlec utan vizszintes vonal huzodik (nem a jelenlegi `border-b`, hanem a mockup szerinti `::after` pseudo-element vagy `<hr>`)
- [ ] Ha a datum a mai nap: egy "Ma" chip jelenik meg a datum szoveg mellett (kek hatter, kis meretu, uppercase)
- [ ] A datum formatuma valtozatlan: `hu-HU` lokalizalt (pl. "2026. junius 11., csutortok")

*"Nem tippelt" figyelmeztetes (no-tip state):*
- [ ] Ha a meccs tippelheto es nincs tipp: a kartya labtejlece tartalmazza: "Meg nem tippeltel erre a meccsre" szoveg + "Tippelj ->" gomb (amber szin)
- [ ] A "Tippelj ->" gomb fokuszalja az elso tipp input mezot az adott meccsnel
- [ ] A kartya szinezes: sarga/amber szegely + halvany amber hatter (a jelenlegi `border-amber-300 bg-amber-50` megmarad, de a labtejlec is kiemelt)

*Alert banner:*
- [ ] Ha vannak ma nem tippelt, nyitott meccsek: a lista tetejen figyelmezteto banner jelenik meg
- [ ] Banner szoveg: "N merkozesen meg nem tippeltel ma -- a hataridot hamarosan lejar!"
- [ ] A banner dismissible (X gombbal bezarhato, sessionStorage-ban tarolva)
- [ ] Ha nincs nem tippelt nyitott meccs ma: a banner nem jelenik meg

*Elo meccs vizualis frissites:*
- [ ] Az "ELOBEN" badge mellett pulsing piros pont animacio (`animate-pulse` vagy custom CSS)
- [ ] Az elo meccs pontszama piros szinben jelenik meg (ne fekete)

*Tipp megjelenitese lezart meccsen:*
- [ ] A "Tippem: X -- Y" szoveg elott lakat emoji jelenik meg
- [ ] A tipp es a pontszam badge egymas mellett, a kartya labtejlecben (jelenlegi elkuldites marad, de a badge formatum valtozik)

**Technikai megjegyzesek:**
- Kizarolag frontend valtozas -- backend API nem modosul
- A `cardBorderClass()` fuggveny logikaja bovul az uj allapotokkal
- Uj computed: `pointsBadgeClass(points: number): string` -- a pont ertekhez rendeli a szint
- A `MatchesView.vue` template atstrukturalas: a kartya footer uj formatum kap
- A meglevo autosave / tipp input UX (UX-001) valtozatlan marad
- Alert banner: uj `AlertBanner.vue` komponens, vagy inline a `MatchesView`-ban
- A "Ma" chip: `isToday(dateStr)` helper fuggveny

**Nem tartalmazza:**
- Sidebar redesign (kulon story: UX-011)
- Filter tabs redesign (kulon story: UX-010)
- Notification bell/panel (kulon story: UX-013)
- Toast rendszer (kulon story: UX-012)
- Modal redesign (a meglevo MatchDetailView marad)

**Komplexitas:** M
**Prioritas:** Should Have

---

## UX-010: Filter tabs (segmented control) redesign

**Story:**
Mint **bejelentkezett felhasznalo**, szeretnem, hogy **a meccs szuro gombok egy modern, segmented control stilusban jelenjenek meg**, hogy **vizualisan egyertelmuen lassam, melyik szuro aktiv, es mobilon is hasznalhato legyen**.

**Design referencia:** `/Users/I525584/Downloads/meccsek-interaktiv.html` -- topbar filter tabs

**Elfogadasi kriteriumok:**

*Desktop:*
- [ ] A szuro gombok (Osszes / Csoportkor / Egyenes kieses) egyetlen `segmented control` konteneren belul jelennek meg
- [ ] A kontener: halvany szurke hatter, lekeritett sarok, belso padding
- [ ] Az aktiv tab: feher hatter, shadow, felkover font
- [ ] Inaktiv tab: athatos hatter, szurke szoveg
- [ ] Hover: szoveg soteted (nem a hatter valtozik)
- [ ] A segmented control a topbarban jelenik meg, a cim es a jobb oldali muveletek kozott

*Mobil (<768px):*
- [ ] A segmented control a topbar alatti sorba kerul (vagy a content teren belul marad a jelenlegi helyen)
- [ ] Alternativa: horizontalis scrollozhato pill-ek, ha nem fernek el
- [ ] A filter NEM tunik el mobilon (a mockup elrejti, de ez rossz UX -- a felhasznalo mobilon is szurni akar)

*Technikai:*
- [ ] Uj `SegmentedControl.vue` komponens (ujrahasznalhato): `options: { label, value }[]`, `modelValue`, `@update:modelValue`
- [ ] A jelenlegi `stageFilter` logika valtozatlan marad a Pinia store-ban
- [ ] A jelenlegi sima gombok lecserelodnek a SegmentedControl-ra

**Komplexitas:** S
**Prioritas:** Should Have

---

## UX-011: Sidebar redesign (szekciocimkek, admin nav, mini leaderboard)

**Story:**
Mint **bejelentkezett felhasznalo**, szeretnem, hogy **a sidebar strukturaltabban jelenitse meg a navigacios elemeket szekcio-cimkekkel, es admin szerepkornel az admin funkciok kulon szekcioban legyenek**, hogy **gyorsabban talaljam meg a keresett menupointot**.

Mint **csoport tag**, szeretnem, hogy **a sidebar-ban lassam az elso csoportom mini ranglistaját**, hogy **folyton lathatso legyen a versenyhely**zetem anelkul, hogy atnavigalnek a ranglista oldalra**.

**Design referencia:** `/Users/I525584/Downloads/meccsek-interaktiv.html` -- sidebar

**Elfogadasi kriteriumok:**

*Szekciocimkek:*
- [ ] "Jatek" szekciocimke a fo navigacios elemek felett (Meccsek, Tippjeim, Csoportok, Ranglista)
- [ ] "Admin" szekciocimke az admin navigacios elemek felett (csak admin felhasznalonak latszodik)
- [ ] A szekciocimkek stilus: kismeretu, uppercase, halvany szurke szoveg, `letter-spacing` 0.1em
- [ ] A szekciocimkek nem kattinthatoak

*Admin nav itemek a sidebar-ban:*
- [ ] Admin -- Merkozesek, Admin -- Csapatok, Admin -- Felhasznalok nav itemek a sidebar-ban jelennek meg (az "Admin" szekciocimke alatt)
- [ ] Ezek a linkek CSAK admin felhasznalonak lathatok (`authStore.isAdmin()`)
- [ ] Az admin linkek a `UserMenuButton` dropdown-bol kikerulnek (ott marad: Profil, Kijelentkezes)
- [ ] Az admin pill tab navigacio az admin nezeteken belul valtozatlan marad

*Nav badge (nem tippelt meccsek szama):*
- [ ] A "Meccsek" nav item mellett egy badge jelenik meg, ha vannak ma nem tippelt, nyitott meccsek
- [ ] A badge szama: a nem tippelt, tippelheto meccsek szama
- [ ] A badge szine: amber/sarga (figyelmezteto)
- [ ] Ha minden meccsre van tipp: a badge nem jelenik meg

*Mini leaderboard widget:*
- [ ] A sidebar also reszeben (az user profil felett) egy kis ranglista widget jelenik meg
- [ ] A widget cimet: a user elso csoportjanak neve (vagy "Csoportom" ha nincs nev)
- [ ] A widget 4 sort mutat: Top 3 + a user sajat helye (ha nem a top 3-ban van)
- [ ] Ha a user a top 3-ban van: 4 sort mutat (top 4)
- [ ] Soronkent: helyezes, nev, pontszam
- [ ] A user sajat sora kiemelt hatterrel (kek)
- [ ] "Valtas ->" link: kattintasra a csoportok oldalra navigal
- [ ] Ha a user nem tagja egyetlen csoportnak sem: a widget nem jelenik meg
- [ ] A widget adatait a meglevo `GET /api/groups/:groupId/leaderboard` endpoint adja (mar letezik)
- [ ] A widget csak desktop-on latszodik (collapsed sidebar-ban rejtett)

*User profil a sidebar aljan:*
- [ ] A sidebar aljan megjelenik: avatar + display name + email (csonkitva ha tul hosszu)
- [ ] Kattintasra: dropdown menu (Profil, Kijelentkezes)
- [ ] Mobilon (drawer mod) szinten megjelenik
- [ ] A topbar-bol az avatar megmarad (mobilon ez az egyetlen hozzaferes a user menuhoz), de a dropdown tartalma egyszerusodik

**Technikai megjegyzesek:**
- `AppLayout.vue` atstrukturlas: uj szekciocimkek, admin nav itemek
- `SidebarLeaderboard.vue` uj komponens: `groupId` prop, `leaderboard.store.ts`-bol (vagy kulon fetch) tolt adatot
- Az admin nav itemek a sidebar-ba koltoznek -- a `UserMenuButton` dropdown egyszerusodik
- A `nav badge` szamolasahoz a `matchesStore` es `predictionsStore` szukseges (mar importalhato)
- A sidebar szelessege novekszik: jelenlegi `w-56` megfelelo (240px a mockupban 240px)
- Collapsed allapotban a szekciocimkek es a mini LB widget rejtve marad

**Komplexitas:** M
**Prioritas:** Should Have

---

## UX-012: Toast notification rendszer

**Story:**
Mint **bejelentkezett felhasznalo**, szeretnem, hogy **a rendszer visszajelzesei (mentett tipp, hiba, info) animalt toast ertesiteskent jelenjenek meg a kepernyo also sarkaban**, hogy **ne zavajak a fo tartalmat, de egyertelmuen eszrevegyem oket**.

**Design referencia:** `/Users/I525584/Downloads/meccsek-interaktiv.html` -- toast-container

**Elfogadasi kriteriumok:**

*Toast megjelenes:*
- [ ] A toast a kepernyo jobb also sarkaban jelenik meg (desktop), also kozepen (mobil)
- [ ] Animalt slide-up beuszas + fade-in
- [ ] Automatikus eltunes 3 masodperc utan (fade-out + slide-down)
- [ ] Tobb toast egymas folott jelenhet meg (stack, 8px gap)
- [ ] Maximum 3 toast latszik egyszerre (a regi automatikusan eltavolitasra kerul)

*Toast tipusok:*
- [ ] **Success** (zold hatter): "Tipp elmentve: 2 -- 1"
- [ ] **Info** (sotet kek hatter): "3 tipp leadhato ma!"
- [ ] **Error** (piros hatter): "Hiba tortent. Probald ujra!"
- [ ] **Warning** (amber hatter): "Add meg mindket erteket!"

*Toast API:*
- [ ] `useToast()` composable: `showToast(message: string, type: 'success' | 'info' | 'error' | 'warning')`
- [ ] Globalis eleres: barmely komponensbol meghivhato
- [ ] A toastok egy Pinia store-ban vagy provide/inject-ben tarolodnak

*Integraciok:*
- [ ] A tipp mentes sikeressege toast-kent jelenik meg (a jelenlegi inline "Tipp elmentve!" szoveg kikerul, vagy mindketto marad)
- [ ] Admin muveletek (torles, mentes) toast-kent jeleznek
- [ ] API hibak toast-kent jelennek meg

**Technikai megjegyzesek:**
- `ToastContainer.vue` komponens: az `App.vue`-ba (vagy `AppLayout.vue`-ba) kerul, a router-view folott
- `toast.store.ts` Pinia store: `toasts: Toast[]`, `addToast()`, `removeToast()`
- Vagy: `useToast.ts` composable provide/inject-tel
- CSS animacio: `transform: translateY(20px)` -> `translateY(0)`, `opacity: 0` -> `1`
- `setTimeout` a 3s eltunteteshez

**Komplexitas:** S
**Prioritas:** Should Have

---

## UX-013: Ertesitesi rendszer (notification bell + panel)

**Story:**
Mint **bejelentkezett felhasznalo**, szeretnem, hogy **a topbar-ban egy ertesitesi csengos ikon jelezze, ha van olvasatlan ertesitesem (pl. meccs hamarosan kezdodik, ranglistavaltozas)**, hogy **ne maradjak le fontos esemenyekrol**.

**Design referencia:** `/Users/I525584/Downloads/meccsek-interaktiv.html` -- notification bell + dropdown panel

**Kontextus:**
Ez egy uj rendszer, ami backend es frontend valtozast is igenyel. A jelenlegi app-ben nincs ertesitesi infrastruktura. Ez a story egy egyszerusitett elsokori (v1) implementaciot celoz: a backend generalt ertesiteseket a meccs adatok alapjan (nem push notification, hanem polling).

**Elfogadasi kriteriumok:**

*Backend:*
- [ ] `notifications` tabla: `id` (UUID PK), `userId` (FK), `type` (enum: `match_reminder` | `leaderboard_change` | `points_earned`), `title`, `body`, `isRead` (boolean, default false), `relatedMatchId` (nullable FK), `createdAt` (TIMESTAMPTZ)
- [ ] `GET /api/notifications` -- authMiddleware, sajat ertesitesek, legutolso 20, `isRead` filter opcio
- [ ] `PUT /api/notifications/:id/read` -- olvasottra allitas
- [ ] `PUT /api/notifications/read-all` -- osszes olvasottra allitas
- [ ] Ertesites generalas: `setResult()` meghivasakor `points_earned` ertesites letrejote minden tippelo user-nek
- [ ] Ertesites generalas: cron job (vagy startup check): `match_reminder` ertesites 2 oraval a meccs elott, ha a user nem tippelt

*Frontend:*
- [ ] Topbar-ban csengos ikon a jobb oldalon, az avatar melletti
- [ ] Ha van olvasatlan ertesites: piros pont a csengon
- [ ] Kattintasra dropdown panel nyilik (a mockup szerint)
- [ ] Panel tartalma: ertesitesek listaja (ikon + szoveg + ido)
- [ ] "Mind olvasva" gomb a panel fejlecben
- [ ] Ures allapot: "Nincs uj ertesites"
- [ ] `notifications.store.ts` Pinia store: `fetchNotifications()`, `markAsRead()`, `markAllRead()`, `unreadCount` computed

*Polling:*
- [ ] A frontend 60 masodpercenkent lekerdezi az olvasatlan ertesitesek szamat (`GET /api/notifications?isRead=false&limit=1` -- csak a szamot kell)
- [ ] Alternativa: a meglevo SSE (`/api/events`) csatorna bovitese ertesitesi esemennyel

**Technikai megjegyzesek:**
- Ez egy uj epic (E15 -- Ertesitesek) -- nem a meccsek redesign resze
- A backend `notifications` tabla Drizzle schema bovites + migracio
- A cron job az US-1203 (sync cron) mintajara epulhet
- Elso fazisban: csak `points_earned` ertesites (az admin result rogziteskor generalt)
- Masodik fazisban: `match_reminder` (2 oraval elotte)
- Harmadik fazisban: `leaderboard_change` (valaki megelozott)

**Komplexitas:** L
**Prioritas:** Nice to Have (az ertesitesi rendszer egy egesz uj epic)

---

## Implementacios sorrend (javasolt)

1. **UX-012** (Toast rendszer) -- S komplexitas, mert minden tovabbi story hasznalja
2. **UX-009** (Match card redesign) -- M komplexitas, a fo vizualis upgrade
3. **UX-010** (Filter tabs) -- S komplexitas, kisebb vizualis javitas
4. **UX-011** (Sidebar redesign) -- M komplexitas, strukturalis valtozas
5. **UX-013** (Notification rendszer) -- L komplexitas, teljesen uj rendszer, kulon epic-ben
