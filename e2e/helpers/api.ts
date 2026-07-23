const BASE = process.env['API_URL'] ?? 'http://localhost:3000'
const HEADERS = {
  Authorization: 'Bearer dev-bypass-token',
  'Content-Type': 'application/json',
}

async function post(path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, { method: 'DELETE', headers: HEADERS })
  if (!res.ok && res.status !== 404) {
    throw new Error(`API ${path} failed: ${res.status} ${await res.text()}`)
  }
}

async function get(path: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { headers: HEADERS })
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

export interface TestUser {
  id: string
  supabaseId: string
  email: string
  displayName: string
  role: string
}

export interface UserGroupSummary {
  id: string
  name: string
  leagues: ReadonlyArray<{ id: string; name: string; shortName: string }>
}

export interface TestLeague {
  id: string
  name: string
  shortName: string
}

export interface TestTeam {
  id: string
  name: string
  shortCode: string
}

export interface TestMatch {
  id: string
  homeTeamId: string
  awayTeamId: string
  leagueId: string
  status: string
  scheduledAt: string
}

export interface TestGroup {
  id: string
  name: string
  inviteCode: string
}

export async function ensureUser(): Promise<TestUser> {
  return post('/api/auth/me') as Promise<TestUser>
}

export async function createLeague(name: string): Promise<TestLeague> {
  return post('/api/admin/leagues', {
    name,
    shortName: name.slice(0, 3).toUpperCase(),
  }) as Promise<TestLeague>
}

export async function getLeagues(): Promise<TestLeague[]> {
  return get('/api/admin/leagues') as Promise<TestLeague[]>
}

export async function getLeagueByShortName(shortName: string): Promise<TestLeague | null> {
  const leagues = await getLeagues()
  return leagues.find(l => l.shortName === shortName) ?? null
}

export interface TestGlobalSpecialType {
  id: string
  name: string
  inputType: 'text' | 'dropdown' | 'team_select'
  options: string[] | null
  deadline: string
  points: number
}

export async function createGlobalSpecialType(input: {
  name: string
  description?: string
  inputType: 'text' | 'dropdown' | 'team_select'
  options?: string[]
  deadline: string
  points: number
}): Promise<TestGlobalSpecialType> {
  return post('/api/admin/global-special-types', input) as Promise<TestGlobalSpecialType>
}

export async function deactivateGlobalSpecialType(typeId: string): Promise<void> {
  await del(`/api/admin/global-special-types/${typeId}`)
}

export async function createTeam(name: string, shortCode: string): Promise<TestTeam> {
  return post('/api/admin/teams', {
    name,
    shortCode,
    teamType: 'club',
  }) as Promise<TestTeam>
}

export interface TestPlayer {
  readonly id: string
  readonly name: string
  readonly teamId: string | null
}

export async function createPlayer(input: {
  name: string
  teamId: string
  position?: string
  shirtNumber?: number
}): Promise<TestPlayer> {
  return post('/api/admin/players', input) as Promise<TestPlayer>
}

export async function createMatch(
  homeTeamId: string,
  awayTeamId: string,
  leagueId: string,
  options: { scheduledAt?: string; status?: string; stage?: string } = {},
): Promise<TestMatch> {
  return post('/api/admin/matches', {
    homeTeamId,
    awayTeamId,
    leagueId,
    stage: options.stage ?? 'group',
    scheduledAt: options.scheduledAt ?? '2099-01-01T12:00:00.000Z',
    status: options.status ?? 'scheduled',
  }) as Promise<TestMatch>
}

export async function createGroup(name: string, leagueId: string): Promise<TestGroup> {
  return post('/api/groups', { name, leagueId }) as Promise<TestGroup>
}

export async function getMyGroups(): Promise<UserGroupSummary[]> {
  return get('/api/groups/mine') as Promise<UserGroupSummary[]>
}

export async function deleteAllMyGroups(): Promise<void> {
  const groups = await getMyGroups()
  for (const g of groups) {
    await del(`/api/groups/${g.id}`)
  }
}

export async function deleteMyGroupsByLeagueShortName(shortName: string): Promise<void> {
  const groups = await getMyGroups()
  for (const g of groups) {
    if (g.leagues.some(l => l.shortName === shortName)) {
      await del(`/api/groups/${g.id}`)
    }
  }
}

export async function ensureGroupInLeague(name: string, leagueId: string): Promise<void> {
  const groups = await getMyGroups()
  if (groups.some(g => g.leagues.some(l => l.id === leagueId))) return
  try {
    await createGroup(name, leagueId)
  } catch (err) {
    if (err instanceof Error && err.message.includes('Maximum number of created groups')) return
    throw err
  }
}

export interface TestPrediction {
  id: string
  matchId: string
  homeGoals: number
  awayGoals: number
}

export async function createPrediction(
  matchId: string,
  homeGoals: number,
  awayGoals: number,
  scorerPickPlayerId?: string,
  outcomeAfterDraw?: 'extra_time_home' | 'extra_time_away' | 'penalties_home' | 'penalties_away' | null,
): Promise<TestPrediction> {
  return post('/api/predictions', {
    matchId,
    homeGoals,
    awayGoals,
    ...(scorerPickPlayerId ? { scorerPickPlayerId } : {}),
    ...(outcomeAfterDraw !== undefined ? { outcomeAfterDraw } : {}),
  }) as Promise<TestPrediction>
}

export async function setMatchResult(
  matchId: string,
  homeGoals: number,
  awayGoals: number,
  scorerPlayerIds?: ReadonlyArray<string>,
  outcomeAfterDraw?: 'extra_time_home' | 'extra_time_away' | 'penalties_home' | 'penalties_away' | null,
): Promise<unknown> {
  return post(`/api/admin/matches/${matchId}/result`, {
    homeGoals,
    awayGoals,
    ...(scorerPlayerIds ? { scorerPlayerIds } : {}),
    ...(outcomeAfterDraw !== undefined ? { outcomeAfterDraw } : {}),
  })
}

async function put(path: string, body?: unknown): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    throw new Error(`API ${path} failed: ${res.status} ${await res.text()}`)
  }
  return res.json()
}

export async function updateMatch(
  matchId: string,
  patch: { scheduledAt?: string; status?: string },
): Promise<unknown> {
  return put(`/api/admin/matches/${matchId}`, patch)
}

export interface DefaultScoringConfig {
  correctOutcomePoints: number
  exactBonusPoints: number
  extraTimeBonusPoints: number
}

export async function getDefaultScoringConfig(): Promise<DefaultScoringConfig> {
  return get('/api/scoring-config/default') as Promise<DefaultScoringConfig>
}
