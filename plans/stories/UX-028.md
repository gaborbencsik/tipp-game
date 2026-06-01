# UX-028: Pontozási szabályzat modal MVP

> Epic: E5 – Csoportok és ranglista (vagy E0 – UX general; final besorolás implementálás előtt)

**Háttér:**
A pontozási szabályok ma csak a backend kódjában (`scoring.service.ts`) és az admin felületen érhetők el. A játékosok nem értik, miért kaptak X pontot egy meccsre, és nem tudnak tudatosan stratégiázni. Csoportonként eltérhet a pontozás, ezt sehol nem látják.

**Story:**
Mint **bejelentkezett felhasználó**, szeretném **egy kattintással bárhonnan elérni a saját csoportom(aim) pontozási szabályait példákkal**, hogy értsem a kapott pontokat és tudatosan tippelhessek.

**Tervek:**
- Spec (MD): `docs/superpowers/specs/2026-06-01-scoring-explainer-design.md`
- Spec (HTML): `docs/superpowers/specs/2026-06-01-scoring-explainer-design.html`
- Mockup (HTML): `docs/superpowers/specs/2026-06-01-scoring-explainer-mockup.html`
- Implementation plan: `docs/superpowers/plans/2026-06-01-scoring-explainer.md`

**Elfogadási kritériumok:**
- [ ] Új backend endpoint `GET /api/scoring/explainer` (`authMiddleware` mögött) visszaadja a default configot + a user csoportjainak effektív configját, frozen időbélyegeket, kedvenc-csapat dupla pont flag-et, és a special tipp típusokat (`group-owned` + `subscribed-global` source-szal)
- [ ] Soft-deletált csoportok kihagyva
- [ ] `ScoringExplainerModal.vue` 4 belépési pontról nyílik: főmenü "Pontozás", ranglista "Hogyan kapok pontot?" link, csoport oldal név melletti (i) ikon, meccs + special tipp form fejléc (i) ikon
- [ ] **1 csoportos** user fejléce: "[Csoportnév] pontozása", csak az adott csoport configját mutatja
- [ ] **2+ csoportos** user fejléce: "Pontozási szabályzat" + default fő nézet, a defaulttól eltérő mezőkön "Eltérés a [Csoportnév]-ben" badge
- [ ] Frozen állapot: lakat-ikon a fejlécben + tooltip, ha bármelyik config `frozenAt != null`
- [ ] Bónusz blokk csak akkor látszik, ha legalább egy csoportban `favoriteTeamDoublePoints = true`
- [ ] Special tippek szekció a megfelelő csoport-bontással (2+ csoport esetén alszekciók)
- [ ] Lazy load: fetch csak az első nyitáskor, session végéig cache-elve a Pinia store-ban
- [ ] Hiba esetén (MVP): toast jelenik meg, modal nem nyílik meg (polished error state külön: `UX-029`)
- [ ] A11y: focus trap, ESC zár, `role="dialog"` + `aria-labelledby`, `aria-describedby`
- [ ] i18n: minden user-facing string `hu.json` és `en.json` alatt, `scoringExplainer.*` namespace
- [ ] Telemetria: `scoring_explainer_opened` (props: `source`, `groupCount`, `userId`) és `scoring_explainer_closed` (props: `durationMs`)
- [ ] Vitest backend: service unit teszt (1/2+ csoport, special types source, frozen propagálás, soft-delete kihagyás), route 200/401
- [ ] Vitest frontend: store (lazy fetch, cache, hiba-kezelés, telemetria), modal (1/2+ render, diff badge, frozen ikon, ESC)
- [ ] Playwright E2E: 2 happy path (ranglistáról nyitás + bezárás, főmenüből nyitás + ESC zárás)

**Komplexitás:** M
**Prioritás:** Should Have
**Függőség:** —

**Megjegyzés:**
A `UX-029` (polished error state) ennek az MVP-nek a Nice-to-Have folytatása, és külön story-ként kerül implementálásra.
