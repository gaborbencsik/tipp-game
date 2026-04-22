# UX-008: Regisztracio utani onboarding flow

## Story

Mint **uj felhasznalo, aki eloszor lep be a VB Tippjatekba**, szeretnek **egy rovid, 3 lepeses bevezeto folyamatot latni**, hogy **megértsem hogyan mukodik a tippeles, tudjam hogy hataridore kell tippelnem, es azonnal csatlakozhassak egy csoporthoz vagy letrehozhassak egyet**.

## Kontextus

Jelenleg az elso belepes utan a felhasznalo kozvetlenul a meccslistara kerul (MatchesView), kontextus es utmutatas nelkul. Az uj felhasznalo nem tudja:
- Hogyan kell tippelni (hova kattintson)
- Hogy a tipp csak a meccs ELOTT adhato le (hataridő)
- Hogy leteznek csoportok es miert erdemes csatlakozni

Ez a story egy 3 lepeses onboarding overlayt vezet be, amely kizarolag az elso belepeskor jelenik meg.

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

### Megjelenes es trigger
- [ ] Az onboarding KIZAROLAG az elso belepeskor jelenik meg (nem minden session-nel)
- [ ] Trigger: `localStorage`-ban nincs `onboarding_completed` kulcs ES a felhasznalo authenticated
- [ ] Az onboarding befejezese (utolso lepes CTA vagy barmely "Kihagy") utan: `localStorage.setItem('onboarding_completed', 'true')`
- [ ] Kovetkezo belepeskor az onboarding nem jelenik meg

### Komponens
- [ ] `OnboardingOverlay.vue` komponens letrehozva — full-screen overlay, 3 lepes
- [ ] `currentStep` ref (0, 1, 2) vezerli a lepeseket
- [ ] Progress indikator (3 pont) a tetején, vizualisan jelzi a haladast
- [ ] Minden lepesnek van "Tovabb" (vagy CTA) es "Kihagy"/"Kesobb" gombja
- [ ] Az overlay felett semmilyen mas elem nem kattinthato (focus trap)

### 1. lepes: Udvozles
- [ ] Headline: "Udvozlunk a VB Tippjatekban!"
- [ ] Rovid szoveg a tippeles lenyegerol (1-2 mondat)
- [ ] Illusztracio (SVG/inline): meccskartya szambeviteli mezokkel
- [ ] "Tovabb" gomb es "Kihagy" link

### 2. lepes: Hataridő
- [ ] Headline: "A tippelesi hataridet ne feledd!"
- [ ] Vizualis idovonal: tipp nyitva -> meccs kezdes -> zarva (szines gradiens)
- [ ] 1-2 mondat: a tippet a meccs elott kell leadni
- [ ] "Tovabb" gomb es "Kihagy" link

### 3. lepes: Csoportok
- [ ] Headline: "Jatssz egyutt a barataiddal!"
- [ ] 1-2 mondat: csoport letrehozas, meghivo kod, sajat ranglista
- [ ] Ket CTA gomb egymas mellett: "Csoport letrehozasa" es "Van meghivo kodom"
- [ ] "Kesobb" link lathato (halvany)
- [ ] "Csoport letrehozasa" -> `/app/groups?action=create` navigacio
- [ ] "Van meghivo kodom" -> `/app/groups?action=join` navigacio
- [ ] "Kesobb" -> `/app/matches` navigacio (alapertelmezett fooldal)

### Responsivity
- [ ] Mobil (< 768px): full-screen, fuggoleges kozepigazitas, 24px padding
- [ ] Desktop (>= 768px): kozepre igazitott kartya (max-width 480px), backdrop blur hatter
- [ ] Illusztraciok SVG/inline (nincs kulon kep betoltes)
- [ ] Atmeneti animaciok: lepesek kozt balrol-jobbra csuszas (200ms ease-in)

### Accessibility
- [ ] Focus trap az overlay-en belul (Tab/Shift+Tab nem lep ki)
- [ ] Escape billentyu bezarja az overlayt (megegyezik "Kihagy"-gyal)
- [ ] Minden gomb rendelkezik `aria-label`-lel
- [ ] `aria-live` region jelzi a lepesvaltast screen readereknek

### Integracio
- [ ] Az overlay a `MatchesView` (vagy az `AppLayout`) szintjen renderelodik, a router guard utan
- [ ] A `GroupsView` kezeli a `?action=create` es `?action=join` query parametereket (a megfelelo form automatikusan megnyilik)
- [ ] Az onboarding nem fugg backend valtozastol — kizarolag frontend implementacio

### Tesztek
- [ ] Unit tesztek: `OnboardingOverlay` rendereles, lepesvaltas, localStorage iras/olvasas
- [ ] Unit teszt: `onboarding_completed` flag jelenletekor az overlay nem jelenik meg
- [ ] Unit teszt: "Kihagy" es "Kesobb" beallitja a flaget es bezarja az overlayt
- [ ] Unit teszt: 3. lepes CTA-k helyes navigaciot triggerelnek
- [ ] Unit teszt: Escape billentyu bezarasa

## Technikai megjegyzesek

- Nincs backend valtozas — kizarolag frontend story
- Az `onboarding_completed` flag `localStorage`-ban tarolodik (nem sessionStorage — torolodne kijelentkezeskor)
- Ha a user mas eszkozon/bongeszőben lep be, ujra latja az onboardingot — ez elfogadhato, mert a flow rovid es kihaghato
- A `GroupsView`-ban mar van create es join form — a query parameter csupan auto-nyitja a megfelelo formot
- Az illusztraciok lehetnek egyszeru SVG ikonok vagy stilizalt Tailwind komponensek — nem kell kulon designer asset

## Amit NEM tartalmaz ez a story

- Profil szerkesztes lepes (US-303 mar kezeli, displayName Google OAuth-bol jon)
- Push notification keres (nincs push notification feature meg)
- Tutorial tooltip-ek a meccslistán (kulon story lenne)
- Gamification (achievement/badge) — out of scope

## Fuggesegek

- Nincs backend fuggeseg
- A `GroupsView` `?action=create` / `?action=join` query param kezeles minor bovites (nem kulon story, az onboardinggal egyutt implementalhato)

## Komplexitas: S
## Prioritas: Should Have
## Epic: E10 – UX / Polish
