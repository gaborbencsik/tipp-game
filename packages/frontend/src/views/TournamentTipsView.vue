<template>
  <AppLayout>
    <div class="max-w-3xl">
      <header class="mb-6">
        <div class="flex items-center gap-2 mb-1">
          <h1 class="text-2xl font-semibold text-gray-900">{{ $t('tournamentTips.title') }}</h1>
          <ScoringExplainerTrigger source="special-tip" variant="icon" />
        </div>
        <p class="text-sm text-gray-600">{{ $t('tournamentTips.description') }}</p>
      </header>

      <div v-if="store.isLoading" class="text-gray-500 text-sm" data-testid="tournament-tips-loading">
        {{ $t('common.loading') }}
      </div>

      <div v-else-if="store.hasAccess === false" class="text-gray-500 text-sm" data-testid="tournament-tips-no-access">
        {{ $t('tournamentTips.noAccess') }}
      </div>

      <div v-else-if="store.error" class="text-red-600 text-sm" data-testid="tournament-tips-error">
        {{ store.error }}
      </div>

      <div v-else-if="store.tips.length === 0" class="text-gray-500 text-sm" data-testid="tournament-tips-empty">
        {{ $t('tournamentTips.empty') }}
      </div>

      <div v-else>
        <div class="flex gap-2 overflow-x-auto mb-3 px-1 py-1 -mx-1" role="tablist" data-testid="tournament-tips-tabs">
          <button
            v-for="tab in tabs"
            :key="tab.key"
            type="button"
            role="tab"
            :aria-selected="activeTab === tab.key"
            class="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors flex items-center gap-1.5"
            :class="activeTab === tab.key
              ? 'bg-blue-50 ring-2 ring-blue-300 text-blue-700'
              : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-200'"
            :data-testid="`tournament-tips-tab-${tab.key}`"
            @click="selectTab(tab.key)"
          >
            <span>{{ tab.label }}</span>
            <span
              class="text-[10px] font-bold px-1.5 rounded-full"
              :class="activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'"
            >{{ tab.count }}</span>
          </button>
        </div>

        <div v-if="visibleTips.length === 0" class="text-gray-500 text-sm" data-testid="tournament-tips-tab-empty">
          {{ $t('tournamentTips.tabEmpty') }}
        </div>

        <div v-else class="space-y-3" data-testid="tournament-tips-list">
        <div
          v-for="sp in visibleTips"
          :key="sp.typeId"
          class="bg-white rounded-xl border border-gray-200 p-4"
          :data-testid="`tournament-tip-${sp.typeId}`"
        >
          <div class="flex items-start justify-between gap-2 mb-2">
            <div>
              <p class="font-medium text-gray-800 text-sm">{{ displayTypeName(sp) }}</p>
              <p v-if="sp.typeDescription" class="text-xs text-gray-500 mt-0.5">{{ sp.typeDescription }}</p>
            </div>
            <span class="text-xs font-semibold px-2 py-0.5 rounded-full shrink-0" :class="statusClass(sp)">
              {{ statusLabel(sp) }}
            </span>
          </div>

          <div class="flex flex-wrap gap-2 text-xs mb-3">
            <span class="text-gray-500">{{ $t('tournamentTips.maxPoints', { n: sp.maxPoints }) }}</span>
            <template v-if="formatRelativeDeadline(sp.deadline, now, t)">
              <span class="text-gray-500">·</span>
              <span :class="formatRelativeDeadline(sp.deadline, now, t)!.cssClass">
                {{ formatRelativeDeadline(sp.deadline, now, t)!.label }}
              </span>
            </template>
          </div>

          <div v-if="sp.points !== null" class="text-sm">
            <p class="text-gray-600">{{ $t('tournamentTips.yourTip', { answer: sp.answerLabel ?? sp.answer ?? '–' }) }}</p>
            <!-- UX-039: structured all_groups_standing tip → render picker readOnly+correctAnswer for visual diff -->
            <div
              v-if="sp.inputType === 'all_groups_standing' && isAllGroupsStandingOptions(sp.options) && sp.correctAnswer"
              class="mt-2"
            >
              <GroupStandingsPicker
                :options="sp.options"
                :answer="sp.answer ?? null"
                :correct-answer="sp.correctAnswer"
                :read-only="true"
              />
            </div>
            <!-- UX-041: structured multi_team_weighted tip → render Upset picker readOnly+derived correctAnswer for visual diff -->
            <div
              v-else-if="sp.inputType === 'multi_team_weighted' && isMultiTeamWeightedOptions(sp.options) && deriveUpsetCorrectAnswer(sp)"
              class="mt-2"
            >
              <UpsetSpecialPicker
                :options="sp.options"
                :answer="sp.answer ?? null"
                :correct-answer="deriveUpsetCorrectAnswer(sp)"
                :read-only="true"
              />
            </div>
            <!-- UX-045: structured bracket_progression tip → render picker readOnly+correctAnswer for visual diff -->
            <div
              v-else-if="sp.inputType === 'bracket_progression' && isBracketProgressionOptions(sp.options) && sp.correctAnswer"
              class="mt-2"
            >
              <BracketProgressionPicker
                :options="sp.options"
                :answer="sp.answer ?? null"
                :group-standings-answer="parsedGroupStandingsAnswer"
                :correct-answer="sp.correctAnswer"
                :read-only="true"
                @open-group-standings="scrollToGroupStandings"
              />
            </div>
            <p
              v-else-if="sp.correctAnswer"
              class="text-gray-600 whitespace-pre-line"
              data-testid="tip-correct-answer"
            >{{ $t('tournamentTips.correctAnswer', { answer: sp.correctAnswerLabel ?? formatRawCorrectAnswer(sp.correctAnswer) }) }}</p>
            <p class="mt-1 font-semibold" :class="sp.points > 0 ? 'text-green-600' : 'text-gray-400'">
              {{ sp.points > 0 ? $t('tournamentTips.pointsResult', { n: sp.points }) : $t('tournamentTips.zeroPoints') }}
            </p>
          </div>

          <div v-else>
            <!-- UX-032: deadline lejárt + még nincs pont → read-only lock banner + halvány picker -->
            <div
              v-if="isLockedReadOnly(sp)"
              class="mb-3 flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900"
              data-testid="tip-locked-banner"
            >
              <span aria-hidden="true">🔒</span>
              <span class="font-medium">{{ $t('tournamentTips.lockedBanner') }}</span>
            </div>

            <!-- Saját tipp egysoros összegzése — egyszerű (text/dropdown) tippeknél is látsszon a beadott válasz lock után. -->
            <p
              v-if="isLockedReadOnly(sp)"
              class="text-sm text-gray-600 mb-2"
              data-testid="tip-locked-answer"
            >
              {{ $t('tournamentTips.yourTip', { answer: sp.answerLabel ?? sp.answer ?? $t('tournamentTips.noTip') }) }}
            </p>

            <div
              :class="isLockedReadOnly(sp) ? 'opacity-70' : ''"
              :aria-disabled="isLockedReadOnly(sp) ? 'true' : undefined"
              :data-testid="isLockedReadOnly(sp) ? 'tip-locked-wrapper' : undefined"
            >
              <div v-if="sp.inputType === 'team_select'" class="mb-2">
                <TeamSelectDropdown
                  :model-value="sp.answer ?? null"
                  :league-id="wcLeagueId"
                  :answer-label="sp.answerLabel ?? null"
                  :disabled="isLockedReadOnly(sp)"
                  @update:model-value="v => onAnswerChange(sp, v)"
                />
              </div>
              <div v-else-if="sp.inputType === 'player_select'" class="mb-2">
                <PlayerSelectCombobox
                  :model-value="sp.answer ?? null"
                  :league-id="wcLeagueId"
                  :answer-label="sp.answerLabel ?? null"
                  :disabled="isLockedReadOnly(sp)"
                  @update:model-value="v => onAnswerChange(sp, v)"
                />
              </div>
              <div v-else-if="sp.inputType === 'multi_team_weighted' && isMultiTeamWeightedOptions(sp.options)" class="mb-2">
                <UpsetSpecialPicker
                  :options="sp.options"
                  :answer="sp.answer ?? null"
                  :read-only="isLockedReadOnly(sp)"
                  @submit="v => onAnswerChange(sp, v)"
                />
              </div>
              <div v-else-if="sp.inputType === 'all_groups_standing' && isAllGroupsStandingOptions(sp.options)" class="mb-2">
                <GroupStandingsPicker
                  :options="sp.options"
                  :answer="sp.answer ?? null"
                  :read-only="isLockedReadOnly(sp)"
                  @submit="v => onAnswerChange(sp, v)"
                />
              </div>
              <div v-else-if="sp.inputType === 'bracket_progression' && isBracketProgressionOptions(sp.options)" class="mb-2">
                <BracketProgressionPicker
                  :options="sp.options"
                  :answer="sp.answer ?? null"
                  :group-standings-answer="parsedGroupStandingsAnswer"
                  :read-only="isLockedReadOnly(sp)"
                  @submit="v => onAnswerChange(sp, v)"
                  @open-group-standings="scrollToGroupStandings"
                />
              </div>
              <div v-else-if="sp.inputType === 'dropdown' && Array.isArray(sp.options) && sp.options.length">
                <select
                  :value="sp.answer ?? ''"
                  :disabled="isLockedReadOnly(sp)"
                  class="w-full border rounded px-2 py-1.5 text-sm mb-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  @change="onAnswerChange(sp, ($event.target as HTMLSelectElement).value)"
                >
                  <option value="" disabled>{{ $t('tournamentTips.placeholder') }}</option>
                  <option v-for="opt in sp.options" :key="opt" :value="opt">{{ opt }}</option>
                </select>
              </div>
              <div v-else>
                <input
                  :value="textDraft[sp.typeId] ?? sp.answer ?? ''"
                  type="text"
                  maxlength="500"
                  :disabled="isLockedReadOnly(sp)"
                  class="w-full border rounded px-2 py-1.5 text-sm mb-2 disabled:bg-gray-100 disabled:cursor-not-allowed"
                  :placeholder="$t('tournamentTips.inputPlaceholder')"
                  @input="textDraft[sp.typeId] = ($event.target as HTMLInputElement).value"
                  @blur="onAnswerChange(sp, textDraft[sp.typeId] ?? '')"
                />
              </div>
            </div>

            <div v-if="!isLockedReadOnly(sp)" class="flex items-center gap-2 min-h-[1.25rem]">
              <span v-if="store.saveStatusByTypeId[sp.typeId] === 'saving'" class="text-xs text-gray-500">{{ $t('tournamentTips.saving') }}</span>
              <span v-else-if="store.saveStatusByTypeId[sp.typeId] === 'saved'" class="text-xs text-green-600">{{ $t('tournamentTips.saved') }}</span>
              <span v-else-if="store.saveStatusByTypeId[sp.typeId] === 'error'" class="text-xs text-red-600">{{ $t('tournamentTips.errorSaving') }}</span>
            </div>
          </div>
        </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '../components/AppLayout.vue'
import ScoringExplainerTrigger from '../components/ScoringExplainerTrigger.vue'
import TeamSelectDropdown from '../components/predictions/TeamSelectDropdown.vue'
import PlayerSelectCombobox from '../components/predictions/PlayerSelectCombobox.vue'
import UpsetSpecialPicker from '../components/predictions/UpsetSpecialPicker.vue'
import GroupStandingsPicker from '../components/predictions/GroupStandingsPicker.vue'
import BracketProgressionPicker from '../components/predictions/BracketProgressionPicker.vue'
import { useTournamentTipsStore } from '../stores/tournamentTips.store.js'
import { formatRelativeDeadline } from '../lib/deadline.js'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import { deriveBracket } from '../lib/bracketDerive.js'
import type { AllGroupsStandingAnswer, AllGroupsStandingOptions, BracketProgressionAnswer, BracketProgressionOptions, MultiTeamWeightedOptions, SpecialPredictionOptions, SpecialPredictionWithType } from '../types/index.js'

const { t, te } = useI18n()
const store = useTournamentTipsStore()

function displayTypeName(sp: SpecialPredictionWithType): string {
  const key = `tournamentTips.typeName.${sp.inputType}`
  return te(key) ? t(key) : sp.typeName
}

// UX-037: if the backend could not resolve labels for a JSON-array correctAnswer (e.g. a
// team/player lookup miss), fall back to a comma-joined list of the raw entries so the user
// does not see a bare JSON string. Plain single-string answers pass through unchanged.
// UX-038: if the correctAnswer is a JSON object (e.g. all_groups_standing / bracket_progression)
// and the backend label resolver could not produce a readable label, suppress the raw blob with
// an em-dash so the user does not see "{...}".
function formatRawCorrectAnswer(raw: string): string {
  const trimmed = raw.trim()
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown
      if (Array.isArray(parsed)) {
        return parsed
          .filter((v): v is string => typeof v === 'string')
          .map(v => v.trim())
          .filter(v => v.length > 0)
          .join(', ')
      }
    } catch {
      // fall through
    }
  }
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    return '–'
  }
  return raw
}

type TabKey = 'progression' | 'upset' | 'other'
const activeTab = ref<TabKey>('progression')

function tabKeyForTip(sp: SpecialPredictionWithType): TabKey {
  if (sp.inputType === 'all_groups_standing' || sp.inputType === 'bracket_progression') return 'progression'
  if (sp.inputType === 'multi_team_weighted') return 'upset'
  return 'other'
}

const tabs = computed<{ key: TabKey; label: string; count: number }[]>(() => {
  const counts: Record<TabKey, number> = { progression: 0, upset: 0, other: 0 }
  for (const sp of store.tips) counts[tabKeyForTip(sp)] += 1
  return [
    { key: 'progression', label: t('tournamentTips.tabProgression'), count: counts.progression },
    { key: 'upset', label: t('tournamentTips.tabUpset'), count: counts.upset },
    { key: 'other', label: t('tournamentTips.tabOther'), count: counts.other },
  ]
})

const visibleTips = computed(() => store.tips.filter(sp => tabKeyForTip(sp) === activeTab.value))

const userPickedTab = ref(false)

watch(() => store.tips.length, () => {
  if (userPickedTab.value) return
  const firstNonEmpty = tabs.value.find(t => t.count > 0)
  if (firstNonEmpty) activeTab.value = firstNonEmpty.key
})

function selectTab(key: TabKey): void {
  userPickedTab.value = true
  activeTab.value = key
}

const now = ref(Date.now())
const textDraft = reactive<Record<string, string>>({})
const wcLeagueId = ref<string | null>(null)

const DEV_AUTH_BYPASS = import.meta.env.VITE_DEV_AUTH_BYPASS === 'true'

async function getAccessToken(): Promise<string> {
  if (DEV_AUTH_BYPASS) return 'dev-bypass-token'
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token ?? ''
}

let nowTimer: ReturnType<typeof setInterval> | null = null

onMounted(async () => {
  await store.fetchTips()
  try {
    const token = await getAccessToken()
    const leagues = await api.leagues.list(token)
    wcLeagueId.value = leagues.find(l => l.shortName === 'VB')?.id ?? null
  } catch {
    wcLeagueId.value = null
  }
  nowTimer = setInterval(() => { now.value = Date.now() }, 60_000)
})

onUnmounted(() => {
  if (nowTimer) clearInterval(nowTimer)
})

function isDeadlinePassed(deadline: string): boolean {
  return new Date(deadline).getTime() < Date.now()
}

// UX-032: a tipp lockolt read-only állapotban van, ha a deadline lejárt, de a pontszám
// még nincs kiértékelve. Ilyenkor a megszokott picker UI-t renderelik, csak halványítva +
// pointer-events-none, hogy a felhasználó még lássa a saját tippjét.
function isLockedReadOnly(sp: SpecialPredictionWithType): boolean {
  return sp.points === null && isDeadlinePassed(sp.deadline)
}

function isMultiTeamWeightedOptions(options: SpecialPredictionOptions): options is MultiTeamWeightedOptions {
  return options !== null && !Array.isArray(options) && Array.isArray((options as MultiTeamWeightedOptions).choices)
}

function isAllGroupsStandingOptions(options: SpecialPredictionOptions): options is AllGroupsStandingOptions {
  return options !== null && !Array.isArray(options) && Array.isArray((options as AllGroupsStandingOptions).groups)
}

function isBracketProgressionOptions(options: SpecialPredictionOptions): options is BracketProgressionOptions {
  return options !== null && !Array.isArray(options)
    && typeof (options as BracketProgressionOptions).bracketTemplate === 'object'
    && Array.isArray((options as BracketProgressionOptions).bracketTemplate?.matches)
}

// UX-041 follow-up: the multi_team_weighted (Upset Special) type has no explicit
// correctAnswer on the row — the backend derives "eliminated" from the bracket
// progression's correctAnswer. To render the scored visual diff we mirror that
// derivation client-side from the two upstream tips already in `store.tips`.
function deriveUpsetCorrectAnswer(sp: SpecialPredictionWithType): string | null {
  if (sp.points === null) return null
  if (!isMultiTeamWeightedOptions(sp.options)) return null
  const groupStandingsTip = store.tips.find(t => t.inputType === 'all_groups_standing')
  const bracketTip = store.tips.find(t => t.inputType === 'bracket_progression')
  if (!groupStandingsTip?.correctAnswer) return null
  if (!bracketTip || !isBracketProgressionOptions(bracketTip.options)) return null

  let correctGroupStandings: AllGroupsStandingAnswer | null = null
  try {
    const parsed = JSON.parse(groupStandingsTip.correctAnswer) as AllGroupsStandingAnswer
    if (parsed && typeof parsed === 'object' && parsed.groups && Array.isArray(parsed.best3rds)) {
      correctGroupStandings = parsed
    }
  } catch {
    return null
  }
  if (!correctGroupStandings) return null

  let correctBracketWinners: Readonly<Record<string, string>> = {}
  if (bracketTip.correctAnswer) {
    try {
      const parsed = JSON.parse(bracketTip.correctAnswer) as BracketProgressionAnswer
      if (parsed && typeof parsed === 'object' && parsed.winners && typeof parsed.winners === 'object') {
        const winners: Record<string, string> = {}
        for (const [k, v] of Object.entries(parsed.winners)) {
          if (typeof v === 'string') winners[k] = v
        }
        correctBracketWinners = winners
      }
    } catch {
      // tolerate parse errors — winners stays empty and derive uses group standings only
    }
  }

  const derived = deriveBracket(bracketTip.options.bracketTemplate.matches, correctGroupStandings, correctBracketWinners)
  const last32 = new Set<string>()
  let unresolved = 0
  for (const m of derived.matches) {
    if (m.round !== 'last_32') continue
    if (m.teamA) last32.add(m.teamA); else unresolved += 1
    if (m.teamB) last32.add(m.teamB); else unresolved += 1
  }
  if (last32.size === 0 || unresolved > 0) return null
  const eliminated = sp.options.choices.map(c => c.teamId).filter(id => !last32.has(id))
  return JSON.stringify(eliminated)
}

const parsedGroupStandingsAnswer = computed<AllGroupsStandingAnswer | null>(() => {
  const sp = store.tips.find(t => t.inputType === 'all_groups_standing')
  if (!sp?.answer) return null
  try {
    const parsed = JSON.parse(sp.answer) as AllGroupsStandingAnswer
    if (parsed && typeof parsed === 'object' && parsed.groups && Array.isArray(parsed.best3rds)) {
      return parsed
    }
  } catch {
    // ignore
  }
  return null
})

function scrollToGroupStandings(): void {
  const sp = store.tips.find(t => t.inputType === 'all_groups_standing')
  if (!sp) return
  const el = document.querySelector(`[data-testid="tournament-tip-${sp.typeId}"]`)
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
}

function isPartiallyAnswered(sp: SpecialPredictionWithType): boolean {
  const c = sp.completion
  if (!c) return false
  return c.totalDone > 0 && c.totalDone < c.totalSteps
}

function isFullyAnswered(sp: SpecialPredictionWithType): boolean {
  const c = sp.completion
  if (c) return c.totalDone >= c.totalSteps && c.totalSteps > 0
  return Boolean(sp.answer)
}

function statusClass(sp: SpecialPredictionWithType): string {
  if (sp.points !== null) return sp.points > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
  if (isDeadlinePassed(sp.deadline)) return 'bg-yellow-100 text-yellow-700'
  if (isFullyAnswered(sp)) return 'bg-blue-100 text-blue-700'
  if (isPartiallyAnswered(sp)) return 'bg-amber-100 text-amber-700'
  return 'bg-gray-100 text-gray-500'
}

function statusLabel(sp: SpecialPredictionWithType): string {
  if (sp.points !== null) return sp.points > 0 ? `+${sp.points}` : t('tournamentTips.statusZero')
  if (isDeadlinePassed(sp.deadline)) return t('tournamentTips.statusPending')
  if (isFullyAnswered(sp)) return t('tournamentTips.statusSubmitted')
  if (isPartiallyAnswered(sp)) return t('tournamentTips.statusInProgress')
  return t('tournamentTips.statusOpen')
}

async function onAnswerChange(sp: SpecialPredictionWithType, value: string | null): Promise<void> {
  const trimmed = (value ?? '').trim()
  if (!trimmed || trimmed === sp.answer) return
  try {
    await store.upsertTip({ typeId: sp.typeId, answer: trimmed })
  } catch {
    // Save status flagged by store; UI shows error label.
  }
}
</script>
