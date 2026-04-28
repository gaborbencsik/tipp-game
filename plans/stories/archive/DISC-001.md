# DISC-001: Landing oldal discovery (design + marketing + social stratégia)

> Epic: E13 – Landing & Marketing

**Story:**
Mint **projekt tulajdonos**, szeretném, hogy **legyen egy átgondolt landing oldal terv** — design struktúrával, szövegekkel, social stratégiával és a megvalósításhoz szükséges erőforrások listájával —, hogy **a VB 2026 előtt hatékonyan tudjuk bevezetni az appot barátok, munkahelyi közösségek és általános focifanok körében**.

> Ez egy **thinking/discovery story**: az output egy részletes terv, nem kód. Az implementáció külön story-kban kerül majd lebontásra.

---

**Elfogadási kritériumok:**

- [ ] **Design terv** elkészül (oldaltérkép + szekciók)
- [ ] **Marketingszöveg** minden szekcióhoz megvan (headline, subheadline, CTA szöveg)
- [ ] **Social stratégia** leírva (platformok, poszt típusok, ütemezés)
- [ ] **Gerilla marketing ötletek** dokumentálva
- [ ] **Szükséges erőforrások** listázva (design assets, domain, email tool, stb.)
- [ ] **Waitlist / értesítési megoldás** kiválasztva

---

**1. Design terv – oldalstruktúra**

Javasolt szekciók (egy hosszú scrollolható oldal, opcionális anchor-alapú almenüvel):

| # | Szekció | Funkció |
|---|---------|---------|
| 1 | **Hero** | Fő headline + subheadline + email waitlist CTA |
| 2 | **Hogyan működik?** | 3 lépéses vizuális flow (regisztrálj → tippelj → nyerj) |
| 3 | **Funkciók** | Feature kártyák: csoportok, ranglista, autosave tipp, pontrendszer |
| 4 | **Kinek szól?** | Két persona kártya: barátok / munkahely |
| 5 | **Screenshots / preview** | App mockup képernyőképek vagy animált demo |
| 6 | **Közösség** | Social proof: „X ember már feliratkozott / vár" |
| 7 | **FAQ** | 4-5 leggyakoribb kérdés (ingyenes-e? mobilon működik? stb.) |
| 8 | **Footer CTA** | Ismételt email waitlist + social linkek + donation link |

Opcionális sticky nav anchor linkekkel: `Funkciók | Hogyan működik? | FAQ | Értesítés`

**Vizuális irány:**
- Sportos, de modern — nem „foci fan shop" hangulat, hanem tech + focilabda ⚽
- Sötétzöld + fehér + sárga akcentus (VB szín asszociáció)
- Hero háttér: subtilis pályaminta vagy stadion blur fotó
- Responsive first — mobilon barátok körében terjed

---

**2. Marketingszövegek**

**Hero szekció:**
> **Headline:** Tippelj. Vezess. Győzz a barátaid között.
> **Subheadline:** A VB 2026 legjobb tippjátéka — csoportok, ranglista, automatikus pontozás. Értesítünk, amikor elindul.
> **CTA gomb:** Értesíts a megjelenéskor →
> **Microcopy:** Ingyenes. Spam nélkül. Leiratkozhatsz egy kattintással.

**Hogyan működik?**
> 1. **Hozz létre egy csoportot** — hívd meg a barátaidat vagy kollégáidat meghívó kóddal
> 2. **Tippeld meg a meccseket** — eredmény, hosszabbítás, tizenegyes — minden mérkőzés előtt
> 3. **Kövesd a ranglista** — pontok automatikusan számolódnak, te csak élvezed

**Feature kártyák:**
> ⚽ **Csoportok** — Privát vagy publikus csoportot hozhatsz létre, a ranglista csak a tagoknak látszik
> 📊 **Automatikus pontozás** — Pontos tipp, helyes győztes, gólkülönbség — minden pontot ér
> 🔔 **Meccs előtti figyelmeztetés** — Nem maradsz le egy tippről sem
> 🏆 **Globális ranglista** — Mérd össze magad nemcsak a barátaiddal, hanem mindenkivel

**Kinek szól? – Két persona:**
> **👨‍👩‍👧‍👦 Baráti társaságok**
> „Minden VB-n van egy WhatsApp-csoport és egy Excel. Most legyen egy igazi app."
>
> **🏢 Munkahelyek**
> „A legjobb csapatépítő, amit a főnök is megenged."

**FAQ:**
> *Ingyenes?* Igen, teljesen ingyenes.
> *Kell regisztrálni?* Google-fiókkal egy kattintás.
> *Mobilon is működik?* Igen, böngészőből mobilon is elérhető.
> *Mikor indul?* A VB 2026 előtt. Iratkozz fel, értesítünk.
> *Kell-e focit érteni?* Nem — elég, ha szurkolsz.

---

**3. Social stratégia**

**Platformok és hangnem:**

| Platform | Hangnem | Tartalom típus | Frekvencia |
|----------|---------|----------------|-----------|
| **Facebook** | Közösségi, barátságos | Csoportok, megosztható képek, event | 3–4x/hét VB előtt |
| **Instagram** | Vizuális, sportos | Stories, Reels, mockup képek | 2–3x/hét |

**Tartalom pillérök (mindkét platformon):**
1. **Hype építés** — visszaszámláló a VB-ig, „X nap múlva kezdődik"
2. **Oktatás** — „Tudtad, hogy...?" poszt a pontrendszerről, hogyan működik a tipp
3. **Social proof** — „Már N-en feliratkoztak" milestone poszток
4. **UGC ösztönzés** — „Hívd meg a haverodat, aki mindig tudja a tippet" → megosztható kártya
5. **Meccs közbeni engagement** — „Megvan a tipped?" – live reminder poszт meccs napján

**Instagram Reels ötletek:**
- 15 mp-es „Hogyan működik" animált walkthrough
- „Barátod mindig megmondja előre az eredményt? Tedd próbára." hook
- Visszaszámláló stories sorozat (D-30 → D-1)

**Facebook specifikus:**
- Foci-témájú Magyar FB csoportokban organikus megosztás (pl. „Magyar szurkolók", VB-s csoportok)
- Facebook Event a VB indulásához kötve

---

**4. Gerilla marketing ötletek**

- **WhatsApp/Telegram forward bait:** Egy tömör, vicces szöveg ami természetesen terjed: „Megcsináltuk azt az appot amit mindenki hiányolt VB-n. Tippeljetek ti is: [link]"
- **Reddit / programozói fórumok:** r/hungary, r/webdev — „Megcsináltam egy VB tippjátékot, tesztelőket keresek" — autentikus, nem reklám hangvétel
- **QR-kód matricák** irodákban, kocsmákban VB idején: „Ki nyer a VB-n? Tippelj itt." → landing oldal
- **Meghívó kártyák**: PDF letölthető „csoportindító csomag" — formális és vicces változat — amit a szervező kinyomtathat és kioszthat
- **„Challenged":** barátok egymás között challange-elhetik a landing oldalon (waitlist mellé egy „Hívj meg valakit" flow)
- **Sportbárok / közvetítések:** VB meccsek alatt QR kód a pultosoknak kiosztva

---

**5. Szükséges erőforrások**

| Erőforrás | Leírás | Eszköz / Forrás |
|-----------|--------|-----------------|
| **Domain** | pl. `vbtipp.hu` vagy `tippjatek.hu` | domains.google, tarhely.eu |
| **Landing oldal** | Statikus HTML/Vue oldal VAGY no-code megoldás | Astro / Nuxt / Framer / Webflow |
| **Email waitlist** | Feliratkozók kezelése, értesítő kiküldés | Mailchimp free tier / Brevo / Resend |
| **OG image** | Social share preview kép (1200×630px) | Figma / Canva |
| **Hero fotó / illusztráció** | Pályakép, focilabda, stadion — jogmentes | Unsplash, Pexels, Freepik |
| **App screenshots** | Valódi vagy mockup képernyőképek | macOS Screenshot + Screely.com |
| **Analytics** | Látogatók és konverzió mérése | Plausible (privacy-first) / GA4 |
| **Social accounts** | Facebook oldal + Instagram profil | Létrehozandó, egységes arculattal |
| **Logo / brand** | Minimális: szöveges logo + ⚽ ikon | Figma / Canva |
| **Hosting** | Landing statikus deployja | Vercel (már megvan) / Netlify |

---

**Komplexitás:** L
**Prioritás:** Should Have
