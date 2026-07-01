import { test, expect } from '@playwright/test'
import { injectSession } from './helpers/auth.js'
import { ensureUser } from './helpers/api.js'

// UX-045: kiértékelt bracket_progression view.
// Route-mock szinten fed le: a picker az admin által beállított `correctAnswer`
// alapján kirajzolja az "Kiértékelt tipp" összegző csíkot, a round-kártyák pont-pirulát
// mutatnak, és a chip-ek zöld/piros színt kapnak aszerint, hogy a csapat benne van-e
// az adott kör tényleges résztvevő-halmazában.
//
// A backend-oldali seed-elést szándékosan kerüljük — a `bracket_progression` inputType
// jelenleg globálisan egy migration-seed-ből érkezik, ezért a stack-en végigvitt E2E
// costos lenne. Itt csak a render-wire-t igazoljuk: a TournamentTipsView leszármazottja
// helyesen köti át a `correctAnswer` JSON-t a BracketProgressionPicker → BracketRoundCard
// → BracketMatchCard → TeamSlotChip láncba.

const TOURNAMENT_TIPS_TYPE = 'bracket_progression'
const GROUP_STANDINGS_TYPE = 'all_groups_standing'

// Toy csapatok — 4 db, ezek töltik a two-way last_32 kiindulást és a következő köröket.
const TEAM_A = { id: 'team-A', name: 'Alpha', shortCode: 'ALP', flagUrl: null, group: 'A', teamType: 'national', countryCode: 'AL' }
const TEAM_B = { id: 'team-B', name: 'Beta', shortCode: 'BET', flagUrl: null, group: 'B', teamType: 'national', countryCode: 'BE' }
const TEAM_C = { id: 'team-C', name: 'Gamma', shortCode: 'GAM', flagUrl: null, group: 'C', teamType: 'national', countryCode: 'GA' }
const TEAM_D = { id: 'team-D', name: 'Delta', shortCode: 'DEL', flagUrl: null, group: 'D', teamType: 'national', countryCode: 'DE' }

const TEAMS = [TEAM_A, TEAM_B, TEAM_C, TEAM_D]

// Minimál toy templátum: 2× last_32 → 1× last_16 → 1× final (+ egy bronze meccs a döntőhöz).
const TOY_TEMPLATE = {
  matches: [
    { id: 'l32_m1', round: 'last_32', slotA: 'W_A1', slotB: 'W_B1', winnerTo: 'l16_m1' },
    { id: 'l32_m2', round: 'last_32', slotA: 'W_C1', slotB: 'W_D1', winnerTo: 'l16_m1' },
    { id: 'l16_m1', round: 'last_16', slotA: '<l32_m1>', slotB: '<l32_m2>', winnerTo: 'final' },
    { id: 'sf_m1', round: 'sf', slotA: '<l16_m1>', slotB: '<l16_m1>', winnerTo: 'final' },
    { id: 'final', round: 'final', slotA: '<sf_m1>', slotB: '<sf_m1>', winnerTo: null },
    { id: 'bronze', round: 'bronze', slotA: '<sf_m1_loser>', slotB: '<sf_m1_loser>', winnerTo: null },
  ],
} as const

// Kell egy group_standings tipp, hogy a picker ne a lock-gate-en álljon meg.
const GROUP_STANDINGS_ANSWER = {
  groups: {
    A: ['team-A', null, null, null],
    B: ['team-B', null, null, null],
    C: ['team-C', null, null, null],
    D: ['team-D', null, null, null],
  },
  best3rds: [] as string[],
}

// User tippje: A, C, A (a bracket-en végig A megy).
const USER_BRACKET_ANSWER = {
  winners: {
    l32_m1: 'team-A',
    l32_m2: 'team-C',
    l16_m1: 'team-A',
    sf_m1: 'team-A',
    final: 'team-A',
    bronze: 'team-C',
  },
}

// Admin által beállított tényleges résztvevők: last_32-ben A és D (B és C kiestek);
// last_16-ban A jutott csak tovább; final-be A és D. A user az l32_m1-nél A-ra tippelt
// (bejutott) és l32_m2-nél C-re (nem jutott be) → last_32-ben matched = 1 team.
const CORRECT_ANSWER = {
  participants: {
    last_32: ['team-A', 'team-D'],
    last_16: ['team-A'],
    qf: [] as string[],
    sf: [] as string[],
    final: ['team-A', 'team-D'],
  },
  champion: 'team-A',
  bronzeWinner: null,
}

// Backend `SpecialPredictionWithType` shape-nek megfelelő két tipp sor.
function buildTipsPayload(): unknown[] {
  const nowIso = new Date().toISOString()
  return [
    {
      id: 'sp-groupstandings',
      typeId: 'type-groupstandings',
      typeName: 'Csoportkör állás',
      typeDescription: null,
      inputType: GROUP_STANDINGS_TYPE,
      options: {
        groups: ['A', 'B', 'C', 'D'],
        teamsPerGroup: 4,
        best3rdPicks: 0,
      },
      deadline: '2099-01-01T00:00:00.000Z',
      maxPoints: 100,
      answer: JSON.stringify(GROUP_STANDINGS_ANSWER),
      answerLabel: null,
      points: null,
      correctAnswer: null,
      correctAnswerLabel: null,
      isGlobal: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'sp-bracket',
      typeId: 'type-bracket',
      typeName: 'Bracket haladás',
      typeDescription: null,
      inputType: TOURNAMENT_TIPS_TYPE,
      options: { bracketTemplate: TOY_TEMPLATE },
      deadline: '2099-01-01T00:00:00.000Z',
      maxPoints: 100,
      answer: JSON.stringify(USER_BRACKET_ANSWER),
      answerLabel: null,
      // `points !== null` a kiértékelt ág feltétele a view-ban.
      points: 12,
      correctAnswer: JSON.stringify(CORRECT_ANSWER),
      correctAnswerLabel: null,
      isGlobal: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ]
}

test.describe('UX-045: evaluated bracket_progression view', () => {
  test.beforeAll(async () => {
    await ensureUser()
  })

  test('renders evaluated summary, points pill, and green/red chips', async ({ page }) => {
    // Mock: az összes /api/tournament-tips és /api/teams választ a saját payload-unk adja.
    await page.route('**/api/tournament-tips/access', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ hasAccess: true }) }),
    )
    await page.route('**/api/tournament-tips', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(buildTipsPayload()) }),
    )
    await page.route('**/api/teams', route =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TEAMS) }),
    )

    await injectSession(page)
    await page.goto('/app/tournament-tips')

    const bracketCard = page.getByTestId('tournament-tip-type-bracket')
    await expect(bracketCard).toBeVisible({ timeout: 5000 })

    // 1) Evaluated summary strip a kék "info card" helyett.
    const evaluatedSummary = bracketCard.getByTestId('bracket-evaluated-summary')
    await expect(evaluatedSummary).toBeVisible()
    // Az összpont a breakdown-ból (userSetForRound: last_32 = slotA∪slotB az összes l32
    // meccsen a group standings alapján = {A,B,C,D}; magasabb körökben pedig a felhasználó
    // előző kör-beli winner-halmaza):
    //   last_32:  {A,B,C,D} ∩ {A,D} = 2  × 2p = 4
    //   last_16:  {A,C} (l32 winners) ∩ {A} = 1 × 3p = 3
    //   qf/sf:    pending → 0
    //   final:    {A} (sf winners) ∩ {A,D} = 1 × 8p = 8
    //   champion: A === A → +10
    //   total: 4 + 3 + 8 + 10 = 25
    const totalPill = bracketCard.getByTestId('bracket-evaluated-total-points')
    await expect(totalPill).toBeVisible()
    await expect(totalPill).toContainText('25')

    // A régi tipp info-csík ne jelenjen meg kiértékelt módban.
    await expect(bracketCard.locator('text=💡')).toHaveCount(0)

    // 2) Round-kártyák pont-pirulái.
    // last_32: 2 matched × 2p → amber pill "+4 p"
    const l32Points = bracketCard.getByTestId('bracket-round-points-last_32')
    await expect(l32Points).toBeVisible()
    await expect(l32Points).toContainText('+4')
    // last_16: 1/1 matched (target-limitre a picker 16-tal számol, tehát részleges) → "+3 p"
    const l16Points = bracketCard.getByTestId('bracket-round-points-last_16')
    await expect(l16Points).toBeVisible()
    await expect(l16Points).toContainText('+3')
    // qf/sf: pending (correct.participants üres) → nincs pill.
    await expect(bracketCard.getByTestId('bracket-round-points-qf')).toHaveCount(0)
    await expect(bracketCard.getByTestId('bracket-round-points-sf')).toHaveCount(0)

    // 3) Final/bronze fejléc: bajnok-pirula "+10" (eltalálta) és bronze "0 p".
    const finalsCard = bracketCard.getByTestId('bracket-finals-bronze')
    const championPill = finalsCard.getByTestId('bracket-final-champion-pill')
    await expect(championPill).toBeVisible()
    await expect(championPill).toContainText('+10')
    const bronzePill = finalsCard.getByTestId('bracket-final-bronze-pill')
    await expect(bronzePill).toBeVisible()
    await expect(bronzePill).toContainText('0 p')

    // 4) Chip színek a nyitott last_32 körben.
    // Alapból `last_32` van kinyitva (BracketProgressionPicker default).
    // team-A benne van a last_32 résztvevőkben → chip zöld (border-emerald-500).
    // team-B nincs → piros. team-C nincs → piros. team-D benne van → zöld.
    const l32M1 = bracketCard.getByTestId('bracket-match-l32_m1')
    await expect(l32M1).toBeVisible()
    // A slot-code a picker `slotLabelFor` helper alapján generálódik — 'W_A1' → 'W A1' stb.
    // Ehelyett stabilabb a színt jelző border class-ra ellenőrizni.
    const chipA = l32M1.locator('[data-testid^="team-slot-"]').first()
    const chipB = l32M1.locator('[data-testid^="team-slot-"]').nth(1)
    await expect(chipA).toHaveClass(/border-emerald-500/)
    await expect(chipB).toHaveClass(/border-red-500/)

    const l32M2 = bracketCard.getByTestId('bracket-match-l32_m2')
    const chipC = l32M2.locator('[data-testid^="team-slot-"]').first()
    const chipD = l32M2.locator('[data-testid^="team-slot-"]').nth(1)
    await expect(chipC).toHaveClass(/border-red-500/)
    await expect(chipD).toHaveClass(/border-emerald-500/)

    // 5) A sticky save-status bar ne jelenjen meg kiértékelt módban.
    await expect(bracketCard.getByTestId('bracket-progression-sticky')).toHaveCount(0)
  })
})
