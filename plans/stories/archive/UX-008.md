# UX-008: Regisztracio utani onboarding flow

## Story

Mint **uj felhasznalo, aki eloszor lep be a VB Tippjatekba**, szeretnek **egy rovid, 3 lepeses bevezeto folyamatot latni**, hogy **megértsem hogyan mukodik a tippeles, tudjam hogy hataridore kell tippelnem, es azonnal csatlakozhassak egy csoporthoz vagy letrehozhassak egyet**.

## Kontextus

Jelenleg az elso belepes utan a felhasznalo kozvetlenul a meccslistara kerul (MatchesView), kontextus es utmutatas nelkul. Az uj felhasznalo nem tudja:
- Hogyan kell tippelni (hova kattintson)
- Hogy a tipp csak a meccs ELOTT adhato le (hataridő)
- Hogy leteznek csoportok es miert erdemes csatlakozni

Ez a story egy 3 lepeses onboarding overlayt vezet be, amely kizarolag az elso belepeskor jelenik meg. Az onboarding allapot a DB-ben tarolodik (user-specifikus, eszközfuggetlen), es a felhasznalo barmikor ujra elorhivhatja a menubol.

## UX Terv (a ux-design-expert ajanlasa alapjan)

### 1. lepes: Udvozles + Tippeles bemutatasa
- Headline: "Udvozlunk a VB Tippjatekban!"
- Rovid magyarazat: tippeld meg a meccsek eredmenyet, merd ossze magad a barataiddal
- Illusztracio: egyszerusitett meccskartya a ket szambeviteli mezovel kiemelve
- CTA: "Tovabb" gomb + "Kihagy" link

### 2. lepes: Hataridő figyelmeztetés
- Headline: "A tippelesi hataridet ne feledd!"
- Vizualis idovonal: "Tipp nyitva" -> "Kezdes" -> "Zarva" (zold-piros gradiens)
- Uzenet: minden meccsre a kezdes ELOTT kell leadni a tippet, utana nem modosithato
- CTA: "Tovabb" gomb + "Kihagy" link

### 3. lepes: Csoportok
- Headline: "Jatssz egyutt a barataiddal!"
- Ket CTA gomb egymas mellett: "Csoport letrehozasa" | "Van meghivo kodom"
- Halvany "Kesobb" link: egyenesen a meccslistara navigal
- CTA-k: a `/app/groups` oldalra navigalnak (create vagy join moddal)

### Altalanos UX szabalyok
- Full-screen overlay (z-index AppLayout folott)
- Progress indikator: 3 pont (kitoltott = jelenlegi/elmult, ures = jovobeli)
- Mobil: teljes kepernyo, fuggoleges kozepigazitas, 24px padding
- Desktop: kozepre igazitott kartya (max-width 480px), backdrop blur
- Lepesek kozott balrol-jobbra csuszas animacio (swipeable mobilon)
- Kihagy/Kesobb barmikor elerheto — nem blokkolo
- Escape billentyu bezarja (megegyezik a "Kihagy" muvelettel)

## Elfogadasi kriteriumok

### 1. Adatbazis migracio

- [ ] A `users` tablara uj mezo: `onboarding_completed_at TIMESTAMPTZ` (nullable, default NULL)
- [ ] Drizzle schema frissitese: `onboardingCompletedAt: timestamp('onboarding_completed_at', { withTimezone: true })`
- [ ] Drizzle migracio generalva (pl. `0008_onboarding_flag.sql`)
- [ ] NULL = meg nem latta / resetelte, nem-NULL = befejezve (mikor)

### 2. Backend

- [ ] `PUT /api/users/me/onboarding` — `authMiddleware`
  - Nem kell request body — a hivas beallitja `onboardingCompletedAt = now()`
  - Response: 200 + frissitett user objektum
- [ ] A `POST /api/auth/me` (vagy `GET /api/users/me`) valaszban az `onboardingCompletedAt` mezo megjelenik
- [ ] `user.service.ts` bovitese: `completeOnboarding(userId)`

### 3. Frontend — auth store

- [ ] A `User` tipus bovitese: `onboardingCompletedAt: string | null`
- [ ] `auth.store.ts`: a `handleSession()` / `restoreSession()` utan az `onboardingCompletedAt` ertek elerheto a `user` ref-bol
- [ ] `auth.store.ts`: `completeOnboarding()` action — `PUT /api/users/me/onboarding`, frissiti a `user.value`-t
- [ ] `auth.store.ts`: `resetOnboarding()` action — csak memoriaban allitja `user.value.onboardingCompletedAt = null`-ra (nincs API hivas, nem irodik DB-be)

### 4. Frontend — OnboardingOverlay komponens

- [ ] `OnboardingOverlay.vue` komponens letrehozva — full-screen overlay, 3 lepes
- [ ] `currentStep` ref (0, 1, 2) vezerli a lepeseket
- [ ] Progress indikator (3 pont) a tetején, vizualisan jelzi a haladast
- [ ] Minden lepesnek van "Tovabb" (vagy CTA) es "Kihagy"/"Kesobb" gombja
- [ ] Az overlay felett semmilyen mas elem nem kattinthato (focus trap)
- [ ] Befejezeskor (utolso lepes CTA vagy "Kihagy"): meghivja `authStore.completeOnboarding()`-t

### 5. Lepesek tartalma

**1. lepes: Udvozles**
- [ ] Headline: "Udvozlunk a VB Tippjatekban!"
- [ ] Rovid szoveg a tippeles lenyegerol (1-2 mondat)
- [ ] Illusztracio (SVG/inline): meccskartya szambeviteli mezokkel
- [ ] "Tovabb" gomb es "Kihagy" link

**2. lepes: Hataridő**
- [ ] Headline: "A tippelesi hataridet ne feledd!"
- [ ] Vizualis idovonal: tipp nyitva -> meccs kezdes -> zarva (szines gradiens)
- [ ] 1-2 mondat: a tippet a meccs elott kell leadni
- [ ] "Tovabb" gomb es "Kihagy" link

**3. lepes: Csoportok**
- [ ] Headline: "Jatssz egyutt a barataiddal!"
- [ ] 1-2 mondat: csoport letrehozas, meghivo kod, sajat ranglista
- [ ] Ket CTA gomb egymas mellett: "Csoport letrehozasa" es "Van meghivo kodom"
- [ ] "Kesobb" link lathato (halvany)
- [ ] "Csoport letrehozasa" -> `/app/groups?action=create` navigacio
- [ ] "Van meghivo kodom" -> `/app/groups?action=join` navigacio
- [ ] "Kesobb" -> `/app/matches` navigacio (alapertelmezett fooldal)

### 6. Trigger logika

- [ ] Az overlay megjelenik ha: user authenticated ES `user.onboardingCompletedAt === null`
- [ ] Az overlay NEM jelenik meg ha: `onboardingCompletedAt` nem null (mar vegigment)
- [ ] Az overlay az `AppLayout` szintjen renderelodik, a router guard utan
- [ ] Dev bypass modban: a mock user `onboardingCompletedAt: null` alapbol → az onboarding megjelenik egyszer

### 7. Ujra elohivas a menubol

- [ ] A `UserMenuButton` dropdownban (a profil link alatt) megjelenik: "Bemutatot ujranezese" link
- [ ] Kattintasra meghivja `authStore.resetOnboarding()`-t (csak memoriaban nullazza a flaget, nincs API hivas), majd az overlay azonnal megjelenik
- [ ] Az ujranezett onboarding befejezese (CTA vagy Kihagy) ismet meghivja `completeOnboarding()`-t (ez irja a DB-t)

### 8. Responsivity

- [ ] Mobil (< 768px): full-screen, fuggoleges kozepigazitas, 24px padding
- [ ] Desktop (>= 768px): kozepre igazitott kartya (max-width 480px), backdrop blur hatter
- [ ] Illusztraciok SVG/inline (nincs kulon kep betoltes)
- [ ] Atmeneti animaciok: lepesek kozt balrol-jobbra csuszas (200ms ease-in)

### 9. Accessibility

- [ ] Focus trap az overlay-en belul (Tab/Shift+Tab nem lep ki)
- [ ] Escape billentyu bezarja az overlayt (megegyezik "Kihagy"-gyal)
- [ ] Minden gomb rendelkezik `aria-label`-lel
- [ ] `aria-live` region jelzi a lepesvaltast screen readereknek

### 10. Integracio

- [ ] A `GroupsView` kezeli a `?action=create` es `?action=join` query parametereket (a megfelelo form automatikusan megnyilik)

### 11. Tesztek

- [ ] **Backend unit teszt:** `completeOnboarding(userId)` beallitja a timestampet
- [ ] **Backend unit teszt:** `PUT /api/users/me/onboarding` — 200 valasz + frissitett user
- [ ] **Frontend unit teszt:** `OnboardingOverlay` rendereles ha `onboardingCompletedAt === null`
- [ ] **Frontend unit teszt:** NEM renderelodik ha `onboardingCompletedAt` nem null
- [ ] **Frontend unit teszt:** lepesvaltas (0 -> 1 -> 2)
- [ ] **Frontend unit teszt:** "Kihagy" meghivja `completeOnboarding()`-t es bezar
- [ ] **Frontend unit teszt:** 3. lepes CTA-k helyes navigaciot triggerelnek
- [ ] **Frontend unit teszt:** Escape billentyu bezarasa
- [ ] **Frontend unit teszt:** "Bemutatot ujranezese" meghivja `resetOnboarding()`-t (memoriaban nullazza) es megnyitja az overlayt
- [ ] Typecheck CLEAN mindket package-ben

## Technikai megjegyzesek

- A `POST /api/auth/me` response-ban az `onboardingCompletedAt` mezo part of the user objektum — a frontend az auth store-bol olvassa
- Dev bypass modban a mock user `onboardingCompletedAt: null` → az onboarding megjelenik. A `completeOnboarding()` dev bypass modban a `sessionStorage`-ban frissiti a mock usert (hasonloan a `updateProfile`-hoz)
- A `GroupsView`-ban mar van create es join form — a query parameter csupan auto-nyitja a megfelelo formot
- Az illusztraciok lehetnek egyszeru SVG ikonok vagy stilizalt Tailwind komponensek — nem kell kulon designer asset

## Amit NEM tartalmaz ez a story

- Profil szerkesztes lepes (US-303 mar kezeli, displayName Google OAuth-bol jon)
- Push notification keres (nincs push notification feature meg)
- Tutorial tooltip-ek a meccslistán (kulon story lenne)
- Gamification (achievement/badge) — out of scope

## Fuggesegek

- Nincs mas story-tol valo fuggeseg — onalloan implementalhato
- A `GroupsView` `?action=create` / `?action=join` query param kezeles minor bovites (az onboardinggal egyutt implementalhato)

## Komplexitas: S-M
## Prioritas: Should Have
## Epic: E10 – UX / Polish
