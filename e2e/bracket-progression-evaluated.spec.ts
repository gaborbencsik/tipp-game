import { test, expect } from '@playwright/test'
import { injectSession } from './helpers/auth.js'
import { ensureUser } from './helpers/api.js'

// UX-045: evaluated bracket_progression view.
// Covered at the route-mock level: based on the `correctAnswer` set by the admin,
// the picker renders the "Evaluated tip" summary strip, the round cards show a
// points pill, and the chips get green/red colors according to whether the team
// is in the actual participant set of the given round.
//
// We deliberately avoid backend-side seeding — the `bracket_progression` inputType
// currently comes from a global migration seed, so a full-stack E2E would be
// costly. Here we only verify the render wiring: the TournamentTipsView subtree
// correctly threads the `correctAnswer` JSON through the BracketProgressionPicker
// → BracketRoundCard → BracketMatchCard → TeamSlotChip chain.

const TOURNAMENT_TIPS_TYPE = 'bracket_progression'
const GROUP_STANDINGS_TYPE = 'all_groups_standing'

// Toy teams — 4 of them; they populate the two-way last_32 starting lineup and the next rounds.
const TEAM_A = { id: 'team-A', name: 'Alpha', shortCode: 'ALP', flagUrl: null, group: 'A', teamType: 'national', countryCode: 'AL' }
const TEAM_B = { id: 'team-B', name: 'Beta', shortCode: 'BET', flagUrl: null, group: 'B', teamType: 'national', countryCode: 'BE' }
const TEAM_C = { id: 'team-C', name: 'Gamma', shortCode: 'GAM', flagUrl: null, group: 'C', teamType: 'national', countryCode: 'GA' }
const TEAM_D = { id: 'team-D', name: 'Delta', shortCode: 'DEL', flagUrl: null, group: 'D', teamType: 'national', countryCode: 'DE' }

const TEAMS = [TEAM_A, TEAM_B, TEAM_C, TEAM_D]

// Minimal toy template: 2× last_32 → 1× last_16 → 1× final (+ a bronze match for the final).
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

// A group_standings tip is needed so that the picker doesn't stop at the lock gate.
const GROUP_STANDINGS_ANSWER = {
  groups: {
    A: ['team-A', null, null, null],
    B: ['team-B', null, null, null],
    C: ['team-C', null, null, null],
    D: ['team-D', null, null, null],
  },
  best3rds: [] as string[],
}

// User's tip: A, C, A (A goes through the whole bracket).
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

// Actual participants set by the admin: in last_32, A and D (B and C were eliminated);
// only A advanced to last_16; A and D are in the final. The user tipped A at l32_m1
// (advanced) and C at l32_m2 (did not advance) → in last_32, matched = 1 team.
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

// Two tip rows matching the backend `SpecialPredictionWithType` shape.
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
      // `points !== null` is the condition for the evaluated branch in the view.
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
    // Mock: all /api/tournament-tips and /api/teams responses come from our own payload.
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

    // 1) Evaluated summary strip instead of the blue "info card".
    const evaluatedSummary = bracketCard.getByTestId('bracket-evaluated-summary')
    await expect(evaluatedSummary).toBeVisible()
    // Total points from the breakdown (userSetForRound: last_32 = slotA∪slotB across all
    // l32 matches based on group standings = {A,B,C,D}; in higher rounds it's the user's
    // previous-round winner set):
    //   last_32:  {A,B,C,D} ∩ {A,D} = 2  × 2p = 4
    //   last_16:  {A,C} (l32 winners) ∩ {A} = 1 × 3p = 3
    //   qf/sf:    pending → 0
    //   final:    {A} (sf winners) ∩ {A,D} = 1 × 8p = 8
    //   champion: A === A → +10
    //   total: 4 + 3 + 8 + 10 = 25
    const totalPill = bracketCard.getByTestId('bracket-evaluated-total-points')
    await expect(totalPill).toBeVisible()
    await expect(totalPill).toContainText('25')

    // The old tip info strip should not appear in evaluated mode.
    await expect(bracketCard.locator('text=💡')).toHaveCount(0)

    // 2) Points pills on the round cards.
    // last_32: 2 matched × 2p → amber pill "+4 p"
    const l32Points = bracketCard.getByTestId('bracket-round-points-last_32')
    await expect(l32Points).toBeVisible()
    await expect(l32Points).toContainText('+4')
    // last_16: 1/1 matched (the picker uses target-limit 16 so it's partial) → "+3 p"
    const l16Points = bracketCard.getByTestId('bracket-round-points-last_16')
    await expect(l16Points).toBeVisible()
    await expect(l16Points).toContainText('+3')
    // qf/sf: pending (correct.participants is empty) → no pill.
    await expect(bracketCard.getByTestId('bracket-round-points-qf')).toHaveCount(0)
    await expect(bracketCard.getByTestId('bracket-round-points-sf')).toHaveCount(0)

    // 3) Final/bronze header: champion pill "+10" (correct) and bronze "0 p".
    const finalsCard = bracketCard.getByTestId('bracket-finals-bronze')
    const championPill = finalsCard.getByTestId('bracket-final-champion-pill')
    await expect(championPill).toBeVisible()
    await expect(championPill).toContainText('+10')
    const bronzePill = finalsCard.getByTestId('bracket-final-bronze-pill')
    await expect(bronzePill).toBeVisible()
    await expect(bronzePill).toContainText('0 p')

    // 4) Chip colors in the currently-open last_32 round.
    // By default `last_32` is expanded (BracketProgressionPicker default).
    // team-A is in the last_32 participants → green chip (border-emerald-500).
    // team-B is not → red. team-C is not → red. team-D is in → green.
    const l32M1 = bracketCard.getByTestId('bracket-match-l32_m1')
    await expect(l32M1).toBeVisible()
    // The slot-code is generated based on the picker's `slotLabelFor` helper — 'W_A1' → 'W A1' etc.
    // Instead it's more stable to check the color-indicating border class.
    const chipA = l32M1.locator('[data-testid^="team-slot-"]').first()
    const chipB = l32M1.locator('[data-testid^="team-slot-"]').nth(1)
    await expect(chipA).toHaveClass(/border-emerald-500/)
    await expect(chipB).toHaveClass(/border-red-500/)

    const l32M2 = bracketCard.getByTestId('bracket-match-l32_m2')
    const chipC = l32M2.locator('[data-testid^="team-slot-"]').first()
    const chipD = l32M2.locator('[data-testid^="team-slot-"]').nth(1)
    await expect(chipC).toHaveClass(/border-red-500/)
    await expect(chipD).toHaveClass(/border-emerald-500/)

    // 5) The sticky save-status bar should not appear in evaluated mode.
    await expect(bracketCard.getByTestId('bracket-progression-sticky')).toHaveCount(0)
  })
})
