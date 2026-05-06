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

export interface TestUser {
  id: string
  supabaseId: string
  email: string
  displayName: string
  role: string
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

export async function createTeam(name: string, shortCode: string): Promise<TestTeam> {
  return post('/api/admin/teams', {
    name,
    shortCode,
    teamType: 'club',
  }) as Promise<TestTeam>
}

export async function createMatch(
  homeTeamId: string,
  awayTeamId: string,
  leagueId: string,
  options: { scheduledAt?: string; status?: string } = {},
): Promise<TestMatch> {
  return post('/api/admin/matches', {
    homeTeamId,
    awayTeamId,
    leagueId,
    stage: 'group',
    scheduledAt: options.scheduledAt ?? '2099-01-01T12:00:00.000Z',
    status: options.status ?? 'scheduled',
  }) as Promise<TestMatch>
}

export async function createGroup(name: string, leagueId: string): Promise<TestGroup> {
  return post('/api/groups', { name, leagueId }) as Promise<TestGroup>
}
