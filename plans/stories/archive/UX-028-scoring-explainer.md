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
- [x] Új backend endpoint `GET /api/scoring/explainer` (`authMiddleware` mögött) visszaadja a default configot + a user csoportjainak effektív configját, frozen időbélyegeket, kedvenc-csapat dupla pont flag-et, és a special tipp típusokat (`group-owned` + `subscribed-global` source-szal)
- [x] Soft-deletált csoportok kihagyva
- [x] `ScoringExplainerModal.vue` 4 belépési pontról nyílik: főmenü "Pontozás", ranglista "Hogyan kapok pontot?" link, csoport oldal név melletti (i) ikon, meccs + special tipp form fejléc (i) ikon
- [x] **1 csoportos** user fejléce: "[Csoportnév] pontozása", csak az adott csoport configját mutatja
- [x] Lazy load: fetch csak az első nyitáskor, session végéig cache-elve a Pinia store-ban
- [x] Hiba esetén (MVP): toast jelenik meg, modal nem nyílik meg (polished error state külön: `UX-029`)
- [x] A11y: ESC zár, `role="dialog"` + `aria-modal="true"` (focus trap nem implementálva — lásd `UX-029`)
- [x] i18n: minden user-facing string `hu.json` és `en.json` alatt, `scoringExplainer.*` namespace
- [x] Telemetria: `scoring_explainer_opened` (props: `source`, `groupCount`, `userId`) és `scoring_explainer_closed` (props: `durationMs`)
- [x] Vitest backend: service unit teszt (1/2+ csoport, special types source, frozen propagálás, soft-delete kihagyás), route 200/401
- [x] Vitest frontend: store (lazy fetch, cache, hiba-kezelés, telemetria), modal (1/2+ render, ESC)
- [x] Playwright E2E: 2 happy path (ranglistáról nyitás + bezárás, főmenüből nyitás + ESC zárás)

**Megjegyzés a végleges scope-hoz (eltérés az eredeti spec-től):**
A modal tartalma az `2026-06-01-scoring-explainer-mockup.html`-hez igazodva újraírva, csoport-specifikus diff badge és frozen ikon kikerült:
- **Meccs-pontozás** (4 sor, stackelhető szabályok): Helyes kimenetel (1p), Pontos eredmény bónusz (+1p), Hosszabbítás/tizenegyes kimenetel bónusz egyenes kiesésben (+1p), Kedvenc csapat meccse (×2 multiplier — a "Bónusz blokk" külön szekció helyett ide integrálva, csoportcímkével ha aktív)
- **Torna tippek** (7 sor, csapatonkénti pontok): Helyes csoport (3p, csoportonként, nincs részpont), 32-be jutott csapat (2p), 16-ba jutott csapat (3p), 8-ba jutott csapat (4p), 4-be jutott csapat (6p), Eltalált döntős csapat (8p), Eltalált világbajnok (10p)
- **Speciális statisztikai tippek** (5 sor): Legtöbb/legkevesebb gól és kapott gól csoportkörben (4×3p), Torna gólkirálya (5p)
- "2+ csoportos diff badge", a frozen lakat-ikon és a per-csoport special types alszekciók kikerültek a végleges MVP scope-ból; ezek a `UX-029` polished verzióhoz tartoznak

**Komplexitás:** M
**Prioritás:** Should Have
**Függőség:** —

**Megjegyzés:**
A `UX-029` (polished error state) ennek az MVP-nek a Nice-to-Have folytatása, és külön story-ként kerül implementálásra.
