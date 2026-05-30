import { and, eq, inArray, isNull } from 'drizzle-orm'
import { db } from '../db/client.js'
import { specialPredictionTypes, specialPredictions, teams, players, groupMembers, groups, groupLeagues, leagues } from '../db/schema/index.js'
import type { AllGroupsStandingCompletion, BracketProgressionCompletion, SpecialPredictionInputType, SpecialPredictionOptions, SpecialPredictionWithType } from '../types/index.js'
import { parseUpsetPicks, resolveUpsetMaxPoints, validateUpsetOptions } from './upset-special.service.js'
import {
  parseAllGroupsStandingAnswer,
  validateAllGroupsStandingAnswer,
  validateAllGroupsStandingOptions,
  computeCompletion,
  type GroupTeamMembership,
} from './group-standings.service.js'
import {
  parseBracketProgressionAnswer,
  validateBracketProgressionOptions,
  validateBracketProgressionAnswer,
  computeBracketCompletion,
} from './bracket-progression.service.js'

class AppError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
    this.name = 'AppError'
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const TOURNAMENT_LEAGUE_SHORT_NAME = 'VB'

export async function userHasTournamentAccess(userId: string): Promise<boolean> {
  const rows = await db
    .select({ id: groupMembers.id })
    .from(groupMembers)
    .innerJoin(groups, eq(groups.id, groupMembers.groupId))
    .innerJoin(groupLeagues, eq(groupLeagues.groupId, groupMembers.groupId))
    .innerJoin(leagues, eq(leagues.id, groupLeagues.leagueId))
    .where(and(
      eq(groupMembers.userId, userId),
      eq(leagues.shortName, TOURNAMENT_LEAGUE_SHORT_NAME),
      isNull(groups.deletedAt),
    ))
    .limit(1)
  return rows.length > 0
}

export async function listGlobalTypesWithPredictions(
  userId: string,
): Promise<SpecialPredictionWithType[]> {
  if (!(await userHasTournamentAccess(userId))) {
    throw new AppError(403, 'No tournament access — join a group with the WC league first')
  }

  const types = await db
    .select()
    .from(specialPredictionTypes)
    .where(and(
      eq(specialPredictionTypes.isGlobal, true),
      eq(specialPredictionTypes.isActive, true),
    ))
    .orderBy(specialPredictionTypes.createdAt)

  if (types.length === 0) return []

  const preds = await db
    .select()
    .from(specialPredictions)
    .where(and(
      eq(specialPredictions.userId, userId),
      isNull(specialPredictions.groupId),
      inArray(specialPredictions.typeId, types.map(t => t.id)),
    ))

  const predByTypeId = new Map(preds.map(p => [p.typeId, p]))

  const teamIds: string[] = []
  const playerIds: string[] = []
  for (const t of types) {
    const pred = predByTypeId.get(t.id)
    if (t.inputType === 'team_select') {
      if (pred?.answer) teamIds.push(pred.answer)
      if (t.correctAnswer) teamIds.push(t.correctAnswer)
    }
    if (t.inputType === 'player_select') {
      if (pred?.answer) playerIds.push(pred.answer)
      if (t.correctAnswer) playerIds.push(t.correctAnswer)
    }
    if (t.inputType === 'multi_team_weighted') {
      const opts = validateUpsetOptions(t.options)
      if (opts) for (const c of opts.choices) teamIds.push(c.teamId)
      if (pred?.answer) {
        const picks = parseUpsetPicks(pred.answer)
        if (picks) for (const id of picks) teamIds.push(id)
      }
    }
    if (t.inputType === 'all_groups_standing') {
      if (pred?.answer) {
        const parsed = parseAllGroupsStandingAnswer(pred.answer)
        if (parsed) {
          for (const positions of Object.values(parsed.groups)) {
            for (const teamId of positions) {
              if (teamId) teamIds.push(teamId)
            }
          }
          for (const teamId of parsed.best3rds) teamIds.push(teamId)
        }
      }
    }
    if (t.inputType === 'bracket_progression') {
      if (pred?.answer) {
        const parsed = parseBracketProgressionAnswer(pred.answer)
        if (parsed) {
          for (const teamId of Object.values(parsed.winners)) teamIds.push(teamId)
        }
      }
    }
  }

  const teamNameMap = new Map<string, string>()
  if (teamIds.length > 0) {
    const teamRows = await db.select({ id: teams.id, name: teams.name }).from(teams).where(inArray(teams.id, teamIds))
    for (const r of teamRows) teamNameMap.set(r.id, r.name)
  }

  const playerNameMap = new Map<string, string>()
  if (playerIds.length > 0) {
    const playerRows = await db.select({ id: players.id, name: players.name }).from(players).where(inArray(players.id, playerIds))
    for (const r of playerRows) playerNameMap.set(r.id, r.name)
  }

  const now = new Date()
  return types.map(t => {
    const pred = predByTypeId.get(t.id)
    const deadlinePassed = t.deadline <= now
    let answerLabel: string | null = null
    let correctAnswerLabel: string | null = null
    let maxPoints = t.points
    let completion: AllGroupsStandingCompletion | BracketProgressionCompletion | undefined
    if (t.inputType === 'multi_team_weighted') {
      const opts = validateUpsetOptions(t.options)
      if (opts) maxPoints = resolveUpsetMaxPoints(opts)
    }
    if (t.inputType === 'all_groups_standing') {
      const opts = validateAllGroupsStandingOptions(t.options)
      if (opts && pred?.answer) {
        const parsed = parseAllGroupsStandingAnswer(pred.answer)
        if (parsed) {
          completion = computeCompletion(parsed.groups, parsed.best3rds, opts)
          answerLabel = `${completion.groupsDone}/${opts.groups.length} csoport · ${completion.best3rdsDone}/${opts.best3rdPicks} továbbjutó`
        }
      } else if (opts) {
        completion = { groupsDone: 0, best3rdsDone: 0, totalDone: 0, totalSteps: opts.groups.length + opts.best3rdPicks }
      }
    }
    if (t.inputType === 'bracket_progression') {
      const opts = validateBracketProgressionOptions(t.options)
      if (opts && pred?.answer) {
        const parsed = parseBracketProgressionAnswer(pred.answer)
        if (parsed) {
          const c = computeBracketCompletion(parsed, opts.bracketTemplate.matches)
          completion = c
          answerLabel = `${c.totalDone}/${c.totalSteps} mérkőzés tippelve`
        }
      } else if (opts) {
        const c = computeBracketCompletion({ winners: {} }, opts.bracketTemplate.matches)
        completion = c
      }
    }
    if (pred?.answer) {
      if (t.inputType === 'team_select') answerLabel = teamNameMap.get(pred.answer) ?? null
      if (t.inputType === 'player_select') answerLabel = playerNameMap.get(pred.answer) ?? null
      if (t.inputType === 'multi_team_weighted') {
        const picks = parseUpsetPicks(pred.answer)
        if (picks) {
          const labels = picks.map(id => teamNameMap.get(id)).filter((n): n is string => Boolean(n))
          answerLabel = labels.length > 0 ? labels.join(', ') : null
        }
      }
    }
    const reveal = deadlinePassed || (pred?.points !== null && pred?.points !== undefined)
    if (reveal && t.correctAnswer) {
      if (t.inputType === 'team_select') correctAnswerLabel = teamNameMap.get(t.correctAnswer) ?? null
      else if (t.inputType === 'player_select') correctAnswerLabel = playerNameMap.get(t.correctAnswer) ?? null
      else if (t.inputType === 'multi_team_weighted') {
        const eliminated = parseUpsetPicks(t.correctAnswer) ?? []
        const labels = eliminated.map(id => teamNameMap.get(id)).filter((n): n is string => Boolean(n))
        correctAnswerLabel = labels.length > 0 ? labels.join(', ') : null
      }
    }
    return {
      id: pred?.id ?? null,
      typeId: t.id,
      typeName: t.name,
      typeDescription: t.description ?? null,
      inputType: t.inputType as SpecialPredictionInputType,
      options: t.options as SpecialPredictionOptions,
      deadline: t.deadline.toISOString(),
      maxPoints,
      answer: pred?.answer ?? null,
      answerLabel,
      points: pred?.points ?? null,
      correctAnswer: reveal ? (t.correctAnswer ?? null) : null,
      correctAnswerLabel: reveal ? correctAnswerLabel : null,
      isGlobal: true,
      createdAt: pred?.createdAt.toISOString() ?? null,
      updatedAt: pred?.updatedAt.toISOString() ?? null,
      ...(completion ? { completion } : {}),
    }
  })
}

export async function upsertGlobalPrediction(
  userId: string,
  typeId: string,
  rawAnswer: string,
): Promise<SpecialPredictionWithType> {
  if (!(await userHasTournamentAccess(userId))) {
    throw new AppError(403, 'No tournament access — join a group with the WC league first')
  }

  const typeRows = await db
    .select()
    .from(specialPredictionTypes)
    .where(and(
      eq(specialPredictionTypes.id, typeId),
      eq(specialPredictionTypes.isGlobal, true),
      eq(specialPredictionTypes.isActive, true),
    ))
    .limit(1)

  const type = typeRows[0]
  if (!type) throw new AppError(404, 'Special prediction type not found')

  if (type.deadline <= new Date()) {
    throw new AppError(409, 'Deadline has passed for this prediction type')
  }

  const answer = rawAnswer.trim()
  if (!answer || answer.length === 0) {
    throw new AppError(400, 'answer is required')
  }
  const maxLen = type.inputType === 'all_groups_standing' ? 4000 : type.inputType === 'bracket_progression' ? 8000 : 500
  if (answer.length > maxLen) {
    throw new AppError(400, `answer must be at most ${maxLen} characters`)
  }

  if (type.inputType === 'dropdown') {
    const options = type.options as string[] | null
    if (!options || !options.includes(answer)) {
      throw new AppError(400, 'answer must be one of the available options')
    }
  }

  let resolvedAnswerLabel: string | null = null
  let resolvedMaxPoints = type.points
  let resolvedCompletion: AllGroupsStandingCompletion | BracketProgressionCompletion | undefined
  let normalizedAnswer = answer

  if (type.inputType === 'team_select') {
    if (!UUID_RE.test(answer)) throw new AppError(400, 'Invalid team id')
    const teamRows = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(eq(teams.id, answer))
      .limit(1)
    if (!teamRows[0]) throw new AppError(400, 'Invalid team id')
    resolvedAnswerLabel = teamRows[0].name
  }

  if (type.inputType === 'player_select') {
    if (!UUID_RE.test(answer)) throw new AppError(400, 'Invalid player id')
    const playerRows = await db
      .select({ id: players.id, name: players.name })
      .from(players)
      .where(eq(players.id, answer))
      .limit(1)
    if (!playerRows[0]) throw new AppError(400, 'Invalid player id')
    resolvedAnswerLabel = playerRows[0].name
  }

  if (type.inputType === 'multi_team_weighted') {
    const opts = validateUpsetOptions(type.options)
    if (!opts) throw new AppError(500, 'Special type options are misconfigured')
    const picks = parseUpsetPicks(answer)
    if (!picks) throw new AppError(400, 'answer must be a JSON array of team ids')
    const unique = Array.from(new Set(picks))
    if (unique.length !== picks.length) throw new AppError(400, 'duplicate team ids are not allowed')
    if (picks.length < opts.minPicks || picks.length > opts.maxPicks) {
      throw new AppError(400, `pick exactly ${opts.minPicks} team(s)`)
    }
    const choiceIds = new Set(opts.choices.map(c => c.teamId))
    for (const id of picks) {
      if (!UUID_RE.test(id)) throw new AppError(400, 'Invalid team id')
      if (!choiceIds.has(id)) throw new AppError(400, 'team id is not in the choices list')
    }
    const teamRows = await db
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(inArray(teams.id, picks))
    const nameMap = new Map(teamRows.map(r => [r.id, r.name]))
    resolvedAnswerLabel = picks.map(id => nameMap.get(id) ?? '').filter(Boolean).join(', ') || null
    resolvedMaxPoints = resolveUpsetMaxPoints(opts)
  }

  if (type.inputType === 'all_groups_standing') {
    const opts = validateAllGroupsStandingOptions(type.options)
    if (!opts) throw new AppError(500, 'Special type options are misconfigured')
    const parsed = parseAllGroupsStandingAnswer(answer)
    if (!parsed) throw new AppError(400, 'answer must be a JSON object with groups and best3rds')

    const groupTeams = await db
      .select({ id: teams.id, group: teams.group })
      .from(teams)
      .where(inArray(teams.group, [...opts.groups]))

    const membership: GroupTeamMembership = {
      groups: groupTeams.reduce((map, row) => {
        if (!row.group) return map
        const existing = map.get(row.group) ?? new Set<string>()
        existing.add(row.id)
        map.set(row.group, existing)
        return map
      }, new Map<string, Set<string>>()),
    }

    const result = validateAllGroupsStandingAnswer(parsed, opts, membership)
    if ('error' in result) throw new AppError(400, result.error)

    normalizedAnswer = JSON.stringify(result.answer)
    resolvedCompletion = result.completion
    resolvedAnswerLabel = `${result.completion.groupsDone}/${opts.groups.length} csoport · ${result.completion.best3rdsDone}/${opts.best3rdPicks} továbbjutó`
  }

  if (type.inputType === 'bracket_progression') {
    const opts = validateBracketProgressionOptions(type.options)
    if (!opts) throw new AppError(500, 'Special type options are misconfigured')
    const parsed = parseBracketProgressionAnswer(answer)
    if (!parsed) throw new AppError(400, 'answer must be a JSON object with a winners map')

    // Load the user's US-945 (all_groups_standing) tip — required for slot resolver.
    // We look up the type by inputType (single global instance per spec) and join with the
    // user's prediction. If the user hasn't filled it yet, slot resolution returns null and
    // any winners pointing at unresolved Last 32 slots will fail validation as team_not_in_match.
    const standingsTypeRows = await db
      .select({ id: specialPredictionTypes.id })
      .from(specialPredictionTypes)
      .where(and(
        eq(specialPredictionTypes.inputType, 'all_groups_standing'),
        eq(specialPredictionTypes.isGlobal, true),
      ))
      .limit(1)
    let groupStandings: import('../types/index.js').AllGroupsStandingAnswer | null = null
    if (standingsTypeRows[0]) {
      const stRows = await db
        .select({ answer: specialPredictions.answer })
        .from(specialPredictions)
        .where(and(
          eq(specialPredictions.userId, userId),
          eq(specialPredictions.typeId, standingsTypeRows[0].id),
          isNull(specialPredictions.groupId),
        ))
        .limit(1)
      if (stRows[0]?.answer) {
        groupStandings = parseAllGroupsStandingAnswer(stRows[0].answer)
      }
    }

    const result = validateBracketProgressionAnswer(parsed, opts, groupStandings)
    if ('error' in result) throw new AppError(400, result.error)

    normalizedAnswer = JSON.stringify(result.answer)
    resolvedCompletion = result.completion
    resolvedAnswerLabel = `${result.completion.totalDone}/${result.completion.totalSteps} mérkőzés tippelve`
  }

  const existing = await db
    .select()
    .from(specialPredictions)
    .where(and(
      eq(specialPredictions.userId, userId),
      eq(specialPredictions.typeId, typeId),
      isNull(specialPredictions.groupId),
    ))
    .limit(1)

  let row
  if (existing[0]) {
    const updated = await db
      .update(specialPredictions)
      .set({ answer: normalizedAnswer, updatedAt: new Date() })
      .where(eq(specialPredictions.id, existing[0].id))
      .returning()
    row = updated[0]
  } else {
    const inserted = await db
      .insert(specialPredictions)
      .values({
        userId,
        typeId,
        groupId: null,
        answer: normalizedAnswer,
      })
      .returning()
    row = inserted[0]
  }

  if (!row) throw new AppError(500, 'Failed to save prediction')

  return {
    id: row.id,
    typeId: type.id,
    typeName: type.name,
    typeDescription: type.description ?? null,
    inputType: type.inputType as SpecialPredictionInputType,
    options: type.options as SpecialPredictionOptions,
    deadline: type.deadline.toISOString(),
    maxPoints: resolvedMaxPoints,
    answer: row.answer,
    answerLabel: resolvedAnswerLabel,
    points: row.points ?? null,
    correctAnswer: null,
    correctAnswerLabel: null,
    isGlobal: true,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    ...(resolvedCompletion ? { completion: resolvedCompletion } : {}),
  }
}
