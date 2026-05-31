# Onboarding újraterv – minden főbb funkció bemutatása

> Készítette: Product Expert + UX Expert · 2026-05-31
> Státusz: TERV (megvalósítás előtt elfogadás szükséges)
> Kapcsolódó story: [`UX-019`](./stories/UX-019.md) – ezt a tervet a story bővítéseként/frissítéseként javasoljuk

---

## 1. Cél és felhatalmazás

**A user kérése:**
- Jelenjen meg az **összes főbb funkció**
- Nem kell rövidnek lennie, **tömören felhívni a figyelmet mindenre**
- **Lehet a mostaninál nagyobb méretű**, ha az segíti a megértést
- Először **markdown terv** legyen

**Mit tudunk a jelenlegiről** (`OnboardingOverlay.vue`): 3 lépés, `max-w-md` kártya, slide animáció, focus trap, Esc=skip, "Bemutató újranézése" nav link már létezik (`onboardingCompletedAt` alapján egyszer fut).

---

## 2. Vezérelvek (mit szolgál minden döntés)

1. **Value-first edukáció.** Minden lépés címe egy **felhasználói előnyt** kommunikál ("Szerezz dupla pontot"), nem a feature nevét.
2. **Self-discovery elsőbbség.** Ami UI-ból magától érthető (DayNavigator, liga szűrő, odds blur), azt **ne** tanítsuk lépésen — említsük csak a hub-ban vagy hagyjuk ki.
3. **Pontszerzés > navigáció > szociális > extra.** A lépések sorrendje a felhasználói érték szerint.
4. **Skipelhetőség minden ponton.** A user soha ne érezze magát csapdában — minden lépésen "Kihagyom" + minden action CTA-nak "Később" párja.
5. **Konkrét számok absztrakt ígéretek helyett.** "+50 pont" jobb mint "sok pont".

---

## 3. Funkció-priorizálás (Product oldal)

| Funkció | Prio | Onboarding helye | Indok |
|---|---|---|---|
| Meccs tippek (1X2 / pontos / gólarány) | **P1** | 2. lépés | Core loop. |
| Pontrendszer alapja (mit ér mit) | **P1** | 2. lépés | Stratégia + motiváció. |
| Speciális tippek (gólkirály / csoportgyőztes / döntős) | **P1** | 3. lépés | Magas pontérték, könnyen elveszik. |
| Kedvenc csapat × dupla pont | **P1** | 4. lépés | Erős motivátor + személyre szabás. |
| Csoportok (csoport létrehozás, csatlakozás meghívó kóddal) | **P2** | jelenleg **nem** szerepel külön lépésen — későbbi iterációban visszahozható |
| Mások tippjei (kickoff után reveal) | **P2** | 5. hub kártya | UI önmagát tanítja. |
| Statisztikáim / Tippjeim + ÉLŐ badge | **P2** | 5. hub kártya | Retention driver, de nem blokkoló. |
| Ranglista | **P2** | 5. hub kártya | Csoporton belül magától látható. |
| Mérkőzések (DayNavigator + liga szűrő) | **P3** | 5. hub kártya | Self-discovery elég. |
| Torna tippek 3-tabos view | **P3** | 5. hub kártya | Speciális tippeknél link. |
| Match detail (odds blur/reveal) | **P3** | 5. hub kártya | UI önmagát tanítja. |
| Pending tipp banner | **P3** | 5. hub kártya | Magától megjelenik. |
| Profil (kedvenc csapaton kívül) | **P3** | — | Self-discovery. |
| Egyedi csoport pontrendszer | **P3** | — | Csak admin, group-create flow. |
| Több csoport támogatása | **P3** | — | Power user feature. |
| HU/EN locale | **P3** | — | Settings, browser auto-detect. |
| Adományozás | **P3** | 5. hub kártya (diszkrét) | Első sessionben fizetés ne tolakodjon. |
| "Bemutató újranézése" nav link | **P3** | 5. hub lépésen 1 mondat | "Bármikor visszanézheted." |
| Match Pulse / AI insight | **DEFER** | — | US-1302–1307 fejlesztés. |
| Notification bell | **DEFER** | — | UX-013 függőben. |

---

## 4. Lépés-architektúra: 4 lineáris + 1 hub = **5 lépés**

A "lineáris 12 lépés" túl sok, a "minden egy lapon" zaj. **Hibrid modell**: a P1 funkciók saját lépést kapnak, a P2/P3-asok egy **hub-ban** card grid formában.

**CTA-elv:** **csak továbbléptető CTA-k** vannak, hogy a user **végignézze az összes lépést**. Action CTA (kedvenc csapat beállítás, csoport létrehozás stb.) **nincs** a flow-ban — a user később, saját kezdeményezésre éri el ezeket. Skip a header-ben mindig elérhető.

| # | Lépés | Cél | Tartalom (rövid) | CTA |
|---|---|---|---|---|
| **1** | Üdvözlés + value prop | "Mi ez?" 5 mp-ben | Trófea + tippkártyák, 1 mondat: "Tippelj. Gyűjts. Nyerj." Név használata: "Szia, {név}! 👋" ha van. | Primary: **Mehet →** · Tertiary: Kihagyom |
| **2** | Hogyan tippelsz (alappontok) | Core loop tanítása | Meccskártya + odds bar mini illusztráció. Idővonal (zöld→sárga→piros). 3 bullet: "1X2 / pontos eredmény / gólarány — mind ér pontot." Konkrét példa: "Eltalált végeredmény: +5 pont." | Primary: **Tovább →** · Secondary: Vissza · Tertiary: Kihagyom |
| **3** | Speciális tippek (long-game) | Pontszerzési stratégia 1 | 3 chip illusztráció: ⚽ Gólkirály · 🥇 Csoportgyőztes · 🏁 Döntős csapatok. Konkrét számok ("+50 / +30 / +40 pont"). Mondat: "Egyszer választasz, hetekig fizet." Pending banner említés: "ha lemaradnál, figyelmeztetünk." | Primary: **Tovább →** · Secondary: Vissza · Tertiary: Kihagyom |
| **4** | Kedvenc csapat × dupla pont | Pontszerzési stratégia 2 | Szív + csapatcímer + nagy "×2" badge. "Ligánként választhatsz egy csapatot a profilodban. Az ő meccseiken **dupla pontot** kapsz a csoport ranglistán." Konkrét: "5 jó tipp = 100 pont 50 helyett." | Primary: **Tovább →** · Secondary: Vissza · Tertiary: Kihagyom |
| **5** | **HUB + indítás** – Fedezz fel többet | Optional discovery + záró akció | 2×3 (mobile) / 3×2 (desktop) card grid: P2/P3 feature-ök (Mérkőzések · Torna tippek · Statisztikáim · Mások tippjei · Profil · Adományozás). Minden kártya: mini-ikon + cím + 1 mondat. Lent: "Bemutatót bármikor visszanézheted a menüből." | Primary: **Mehet a játék →** (→ `/app/matches`) · Secondary: Vissza · Tertiary: Kihagyom |

> **Megjegyzés:** A csoportok / szociális élmény (mások tippjei, ranglista, meghívó kód) most **nem kap saját lépést** — egy későbbi iterációban kerülhet vissza a flow-ba, ha a metrikák indokolják.

### A hub kártyái (5. lépés)

| Kártya | Ikon | 1 mondat |
|---|---|---|
| Mérkőzések | 📅 | "Nap, liga és csapat szerint szűrhetsz." |
| Torna tippek | 🏆 | "Csapat, játékos és egyéb torna tippek egy helyen." |
| Statisztikáim | 📊 | "Saját tippjeid, élő szekció ÉLŐ badge-el." |
| Csoportok | 👥 | "Hozz létre csoportot vagy csatlakozz meghívó kóddal." |
| Profil | ⚙️ | "Kedvenc csapat, megjelenítendő név." |
| Adományozás | ☕ | "A játék ingyenes — ha tetszik, vegyél egy kávét." |

---

## 5. Layout, méret, responsive (UX oldal)

| Breakpoint | Konténer | Viselkedés |
|---|---|---|
| **< 640px** (mobile) | **Full-screen sheet** (`inset-0`, safe-area aware) | Sticky header (skip + progress) + sticky footer (CTA-k) + scrollolható tartalom |
| **640–1024px** (tablet) | Centered modal `max-w-lg` (~512px), `max-h-[90vh]` | `rounded-2xl shadow-xl`, internal scroll |
| **≥ 1024px** (desktop) | Centered modal `max-w-2xl` (~672px) | Több breathing room, hub grid 3×2, opcionálisan 2-oszlopos lépés layout (illusztráció bal, szöveg+CTA jobb) |

### Belső struktúra (lépésen belül)

```
┌─────────────────────────────────────┐
│  [Kihagyom]      ●●●○○  3/5         │ ← sticky header
├─────────────────────────────────────┤
│                                     │
│      [vizuális illusztráció]        │
│                                     │
│   Címsor (max 6 szó)                │
│   1 mondat leírás                   │
│                                     │
│   ✓ kulcspont 1                     │
│   ✓ kulcspont 2                     │
│   ✓ kulcspont 3                     │
│                                     │
├─────────────────────────────────────┤
│  [← Vissza]            [Tovább →]   │ ← sticky footer
└─────────────────────────────────────┘
```

---

## 6. Vizuális minták (illusztrációk lépésenként)

Stilizált, **Tailwind-del rajzolt** illusztrációk (nem screenshot), így gyorsabban scannable és nyelvfüggetlen.

### Lépés 1 – Üdvözlés
```
       🏆
   ┌──┐┌──┐┌──┐
   │ 2││ 1││ X│   ← kártyák stagger 80ms-mal pattanva
   └──┘└──┘└──┘
```

### Lépés 2 – Meccs tippek + odds
```
┌─────────────────────────────┐
│  🇭🇺 Magyarország   [2:1]   │
│  🇩🇪 Németország             │
│  ─────────────────────────  │
│  H ████████░░  D ██░░  V ██ │ ← odds bar (width 0→target 600ms)
│  62%           18%      20% │
└─────────────────────────────┘
   🟢 Tipp nyitva · 🟡 Kezdés · 🔴 Zárva
```

### Lépés 3 – Speciális tippek
```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│ ⚽ Gólkirály │ │ 🥇 Csoport   │ │ 🏁 Döntős    │
│  +50 pont    │ │  +30 pont    │ │  +40 pont    │
└──────────────┘ └──────────────┘ └──────────────┘
```

### Lépés 4 – Kedvenc csapat
```
       🇭🇺
       ❤️
      ┌────┐
      │ ×2 │   ← scale-pop animáció a végén (0.5→1.1→1)
      └────┘
   "Kedvenced meccsén dupla pont jár."
```

### Lépés 5 – Hub + indítás
```
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ 📅       │ │ 🏆       │ │ 📊       │
   │ Mérk.    │ │ Torna t. │ │ Statszt. │
   └──────────┘ └──────────┘ └──────────┘
   ┌──────────┐ ┌──────────┐ ┌──────────┐
   │ 👥       │ │ ⚙️        │ │ ☕       │
   │ Csoport. │ │ Profil   │ │ Adomány  │
   └──────────┘ └──────────┘ └──────────┘
   "Bemutatót bármikor visszanézheted."
   [Mehet a játék →]
```

---

## 7. Tipográfia és scannable-ség

| Elem | Méret | Tailwind | Szabály |
|---|---|---|---|
| Címsor | ~24–28px | `text-2xl font-bold` | Max 6 szó |
| Leírás | ~16px | `text-base text-zinc-600` | 1 mondat, ≤100 karakter |
| Bullet | ~14–15px | `text-sm` | Max 3 db, kulcsszó alapú (nem mondat) |
| Számok kiemelve | — | `font-bold tabular-nums` | "×2 pont", "+50 pont", "#14" |

**5–7 mp scan target szabály:** egy lépés = egy fő gondolat. Ha kettőt akarsz → két lépés.

---

## 8. CTA hierarchia

| Szint | Stílus | Pozíció | Mikor |
|---|---|---|---|
| **Primary** | `bg-blue-600 text-white` | Footer jobb | Mindig (Tovább / Mehet a játék) |
| **Secondary** | `border border-zinc-300 text-zinc-700` | Footer bal | 2. lépéstől (Vissza) |
| **Tertiary (ghost)** | `text-zinc-500 text-sm underline-offset-2` | Header jobb | Minden lépésen (Kihagyom) |

**Csak továbbléptető CTA-k** — minden lépésen a primary gomb előrevisz, hogy a user végignézze az összes funkciót. Action-CTA (kedvenc csapat beállítás, csoport létrehozás) **nincs az onboardingban** — ezeket a user később saját maga éri el a navigációból; a skipelt funkciókhoz pedig a meglévő pending nudge-ok (banner a Mérkőzések view-n, pending speciális tipp banner) emlékeztetnek. Ez **nagyobb completion rate**-et és teljes feature awareness-t céloz, az aktiváció költsége: első csoport / kedvenc csapat beállítás 1-2 kattintás később.

---

## 9. Progress vizualizáció

```
●●●○○   3/5
```

- **Dot + számozás kombó** — 5 dot bőven elfér 360px-en is
- Az 5. (hub) dot **kicsit nagyobb** — vizuálisan jelzi az utolsó/elágazási lépést
- Dot **nem kattintható** első futásnál (csak vizuális); replay módban **kattintható** (jump to step)

---

## 10. Animáció

| Animáció | Részletek |
|---|---|
| Lépésközti váltás | Slide + fade kombó, 250–300ms `ease-out` |
| Hub → részlet | Scale + fade (`scale-95 → 100`) — más mint fő flow |
| Belső stagger | Ikonok 60–80ms egymás után |
| Számok | Count-up 800ms (csak ha értelmes adat van) |
| Badge-ek | Scale pop a végén (×2, +50) |
| Odds bar | Width 0 → target 600ms |
| Záró CTA | Mikro-konfetti 200ms (8–12 részecske) |

**`prefers-reduced-motion`**: minden transition `duration-0` vagy ≤100ms opacity fade. Count-up → azonnali végérték. Konfetti → kihagyni.

---

## 11. A11y (akadálymentesség)

| Terület | Követelmény |
|---|---|
| `role="dialog"` + `aria-modal="true"` | Megvan, marad |
| `aria-labelledby` / `aria-describedby` | Címsor + leírás ID-jaira mutasson |
| `aria-live="polite"` régió | Lépésváltáskor: "3. lépés a 6-ból: Speciális tippek" |
| Focus management | Lépésváltáskor a fókusz a **címsorra** (`tabindex="-1"` + `.focus()`) — screen reader újra felolvassa a kontextust |
| Esc | Megerősítő mini-prompt: "Biztos kihagyod? Bármikor visszanézheted a Profilban." |
| Skip gomb | Mindig elérhető Tab-bal (első tab-stop) |
| Kontraszt | Min. WCAG AA 4.5:1 |
| Tap target | Min. 44×44px minden gombon |
| Keyboard | ← / → nyilakkal lépésnavigáció (Tab elsődleges) |
| Reduced-motion | Lásd 10. pont |

---

## 12. Új user vs existing user vs replay

| Kontextus | Viselkedés |
|---|---|
| **Új user** (regisztráció után) | Teljes 6 lépéses flow, automatikusan indul. `onboardingCompletedAt = null`. |
| **Existing user, app frissítés után** | "Mi újság" mód: csak az új/változott lépések jelennek meg. Tracking: `lastSeenOnboardingVersion` (új mező, lásd 14.). Header badge: "✨ Új a játékban". |
| **Replay** (nav menüből explicit) | Teljes újranézés. **Dot navigáció kattintható** (jump to step). Header: "🔁 Bemutató újra". Üdvözlő copy ("Szia, {név}!") elhagyva. Hub kártyákon ✓ jel, hogy melyiket látta már. |
| **Egyedi feature replay** (jövő, opcionális) | Mini-link a feature mellett ("❓ Hogyan működik?") → csak az adott lépést nyitja meg modal-szerűen. |

---

## 13. Drop-off mitigáció

5 lépés ~20–35% drop-off iparági átlag. Mitigáció:

| Eszköz | Hatás |
|---|---|
| Skip per step (header "Kihagyom") | Magas |
| Progress indikátor (3/5) | Közepes |
| Csak továbbléptető CTA-k (action friction nincs a flow-ban) | **Magas** — minden gomb előrevisz, nincs döntés-pánik |
| Pending nudges a meg nem nyitott feature-ökhöz (kedvenc csapat banner Mérkőzések view-n, pending speciális tipp banner) | Magas |
| Value-first messaging (header az értékről, nem a feature-ről) | Közepes |
| Mobile-first sheet layout | Magas |
| Resume mechanizmus (ha a user X-eli, nyitható "Folytasd a bemutatót" CTA az első session végéig) | Közepes |

---

## 14. Sikermetrikák

| Metrika | Cél | Forrás |
|---|---|---|
| Onboarding completion rate | >65% (új user) | analytics event |
| Per-step drop-off | egyik lépésen se >20% | analytics funnel |
| Time to first prediction (TTFP) | <5 perc median | regisztráció → első tipp |
| First-session prediction count | >3 | analytics |
| Group join rate (D1) | >40% | csoport-tagság a 24h-ban |
| Favourite team set rate (D1) | >50% | profil setup a 24h-ban |
| D7 retention | összehasonlítás előtt/után | session log |
| Special prediction submission rate | >30% | speciális tipp deadline előtt |
| "Bemutató újranézése" használat | >0 (felmérni) | nav link click |

**Eseménykövetés:** minden lépésre `viewed`, `next_clicked`, `back_clicked`, `skipped`, `cta_clicked`, `dismissed`. Ezekből pontos drop-off funnel.

**A/B teszt javaslat (ha forgalom enged):** 4 vs 5 lépéses verzió. Hipotézis: 5 lépés magasabb feature awareness, kevés különbség TTFP-ben — méréssel eldönthető.

---

## 15. Technikai vázlat (megvalósításhoz)

> Részletes implementáció a következő fázisban; itt csak a kontúr.

- **Komponens:** `OnboardingOverlay.vue` átdolgozás — `currentStep < 4` (volt: `< 2`), progress dots `v-for="i in 5"`.
- **Új sub-komponens:** `OnboardingHub.vue` (5. lépés card grid).
- **Új i18n kulcsok** (HU + EN): `onboarding.step1*` … `onboarding.step5*`, `onboarding.hub.*`, `onboarding.skip.confirm*`, `onboarding.replay.*`, `onboarding.whatsNew.*`.
- **Új DB mező** (existing user kezeléshez): `users.last_seen_onboarding_version INT DEFAULT 0` — migration kell. Onboarding minor verziószám konstans a frontend-ben (pl. `ONBOARDING_VERSION = 2`).
- **Router handler-ek:** `goToMatches()` a záró CTA-hoz; hub kártyák saját routerlinket nyitnak (overlay close + navigate).
- **Animáció:** Tailwind `transition-*` + Vue `<Transition>` + `@media (prefers-reduced-motion: reduce)`.
- **Layout:** mobile-on full-screen sheet (Tailwind `inset-0` + safe-area utilities), tablet/desktop centered modal.
- **Tracking:** új analytics events (`onboarding_step_viewed`, `onboarding_step_skipped`, `onboarding_hub_card_clicked`, `onboarding_completed`, `onboarding_dismissed`).

---

## 16. Kihagyások indoklása (mi NEM kerül onboardingba)

| Elem | Indok |
|---|---|
| Action CTA-k a flow közben (kedvenc csapat beállítás, csoport létrehozás) | A user explicit kérése: végignézze az **összes** lépést. Ezeket a funkciókat a flow után saját maga éri el; pending nudge-ok emlékeztetnek. |
| **Csoportok / szociális saját lépés** | Egyelőre kimarad a fő flow-ból (a user kérésére). A hub-ban kap kártyát. Későbbi iterációban visszahozható, ha a metrikák indokolják (pl. alacsony group join rate). |
| Adományozás (saját lépés) | Első sessionben pénzkérés rontja a trust-ot. Diszkrét hub kártyaként jelen, de nem fő flow-ban. |
| Egyedi csoport pontrendszer | Csak admin érinti. Group create flow kontextuális hely. |
| Több csoport támogatása | Power user feature, az első csoport megléte fontos. |
| HU/EN locale | Browser auto-detect + settings, triviális. |
| Match Pulse / AI insight | US-1302–1307 fejlesztés alatt — külön onboarding update később. |
| Notification bell | UX-013 függőben — kontextuális tooltip elég, ha kijön. |
| Match detail odds blur/reveal mechanika | UI önmagát tanítja (kattint → reveal), kioktatás kontraproduktív. |
| Mások tippjei kickoff után | Magától "aha" moment a UI-ban; nem kap saját lépést. |
| DayNavigator / liga szűrő részletek | Standard UI patternek, hub kártyán 1 mondat elég. |

---

## 17. Nyitott kérdések (validálandó implementáció előtt)

1. **Hub vs lineáris** — beletaláltunk-e a "minden főbb funkció" elvárásba az 5. hub-bal, vagy a user szeretné minden funkciót **saját teljes lépésen** látni?
2. **Hub kártyák kattintható-e** — a kártyák odanavigáljanak (overlay close + push), vagy csak vizuális összefoglalók legyenek és csak a primary "Mehet a játék" gomb zárja a flow-t?
3. **Existing user onboarding újranyitása frissítés után** — automatikus vagy csak passzív "✨ Új" badge a nav linken?
4. **Adományozás a hubban** — rendben van-e, vagy teljesen ki kell hagyni az onboardingból (csak Profil)?
5. **Replay mód jump-to-step** — minden user-nek engedélyezve, vagy csak admin / power user-eknek?
6. **Csoportok visszahozatala** — milyen metrika triggerelné a "csoportok saját lépés"-t a következő iterációban (pl. group join rate D1 < 30%)?

---

## 18. Következő lépések

1. **Terv elfogadás** (user review)
2. Esetleges módosítások a tervben → finalizálás
3. UX-019 story bővítése: új struktúra (4 lineáris + 1 hub = 5 lépés), illusztrációk és copy specifikáció
4. i18n kulcsok kibővítése HU + EN
5. DB migration: `users.last_seen_onboarding_version`
6. Komponens implementáció (TDD: `OnboardingOverlay.test.ts` frissítés első, majd implementáció)
7. E2E teszt: új lépéseken átkattintás, hub kártyák navigálnak, záró CTA → `/app/matches`
8. Analytics events bekötése
9. QA + a11y audit (axe, screen reader)
10. Release behind feature flag (opcionális) → A/B teszt 4 vs 5 lépés

---

**Összefoglaló döntés:**

> **5 lépéses adaptív onboarding** (4 lineáris + 1 hub-ban végződő záró lépés), mobile-on full-screen sheet, tablet/desktop nagyobb modal (`max-w-lg` / `max-w-2xl`). **Csak továbbléptető CTA-k** — a user végignézi az összes funkciót, action-t később saját maga indít. Csoportok / szociális saját lépés egyelőre **kimarad** (hub kártyaként jelen). Hub a P2/P3 funkciókhoz. Existing user "Mi újság" módban csak az új lépéseket látja. Replay módban dot kattintható. Sikert TTFP + D7 retention metrikákkal mérünk.
