<template>
  <AppLayout>
    <div class="max-w-3xl">
      <header class="mb-6">
        <h1 class="text-2xl font-semibold text-gray-900 mb-1">{{ $t('tournamentTips.title') }}</h1>
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

      <div v-else class="space-y-3" data-testid="tournament-tips-list">
        <div
          v-for="sp in store.tips"
          :key="sp.typeId"
          class="bg-white rounded-xl border border-gray-200 p-4"
          :data-testid="`tournament-tip-${sp.typeId}`"
        >
          <div class="flex items-start justify-between gap-2 mb-2">
            <div>
              <p class="font-medium text-gray-800 text-sm">{{ sp.typeName }}</p>
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
            <p v-if="sp.correctAnswer" class="text-gray-600">{{ $t('tournamentTips.correctAnswer', { answer: sp.correctAnswerLabel ?? sp.correctAnswer }) }}</p>
            <p class="mt-1 font-semibold" :class="sp.points > 0 ? 'text-green-600' : 'text-gray-400'">
              {{ sp.points > 0 ? $t('tournamentTips.pointsResult', { n: sp.points }) : $t('tournamentTips.zeroPoints') }}
            </p>
          </div>

          <div v-else-if="!isDeadlinePassed(sp.deadline)">
            <div v-if="sp.inputType === 'team_select'" class="mb-2">
              <TeamSelectDropdown
                :model-value="sp.answer ?? null"
                :league-id="wcLeagueId"
                :answer-label="sp.answerLabel ?? null"
                @update:model-value="v => onAnswerChange(sp, v)"
              />
            </div>
            <div v-else-if="sp.inputType === 'player_select'" class="mb-2">
              <PlayerSelectCombobox
                :model-value="sp.answer ?? null"
                :league-id="wcLeagueId"
                :answer-label="sp.answerLabel ?? null"
                @update:model-value="v => onAnswerChange(sp, v)"
              />
            </div>
            <div v-else-if="sp.inputType === 'multi_team_weighted' && isMultiTeamWeightedOptions(sp.options)" class="mb-2">
              <UpsetSpecialPicker
                :options="sp.options"
                :answer="sp.answer ?? null"
                @submit="v => onAnswerChange(sp, v)"
              />
            </div>
            <div v-else-if="sp.inputType === 'all_groups_standing' && isAllGroupsStandingOptions(sp.options)" class="mb-2">
              <GroupStandingsPicker
                :options="sp.options"
                :answer="sp.answer ?? null"
                @submit="v => onAnswerChange(sp, v)"
              />
            </div>
            <div v-else-if="sp.inputType === 'bracket_progression' && isBracketProgressionOptions(sp.options)" class="mb-2">
              <BracketProgressionPicker
                :options="sp.options"
                :answer="sp.answer ?? null"
                :group-standings-answer="parsedGroupStandingsAnswer"
                @submit="v => onAnswerChange(sp, v)"
                @open-group-standings="scrollToGroupStandings"
              />
            </div>
            <div v-else-if="sp.inputType === 'dropdown' && Array.isArray(sp.options) && sp.options.length">
              <select
                :value="sp.answer ?? ''"
                class="w-full border rounded px-2 py-1.5 text-sm mb-2"
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
                class="w-full border rounded px-2 py-1.5 text-sm mb-2"
                :placeholder="$t('tournamentTips.inputPlaceholder')"
                @input="textDraft[sp.typeId] = ($event.target as HTMLInputElement).value"
                @blur="onAnswerChange(sp, textDraft[sp.typeId] ?? '')"
              />
            </div>
            <div class="flex items-center gap-2 min-h-[1.25rem]">
              <span v-if="store.saveStatusByTypeId[sp.typeId] === 'saving'" class="text-xs text-gray-500">{{ $t('tournamentTips.saving') }}</span>
              <span v-else-if="store.saveStatusByTypeId[sp.typeId] === 'saved'" class="text-xs text-green-600">{{ $t('tournamentTips.saved') }}</span>
              <span v-else-if="store.saveStatusByTypeId[sp.typeId] === 'error'" class="text-xs text-red-600">{{ $t('tournamentTips.errorSaving') }}</span>
            </div>
          </div>

          <div v-else class="text-sm">
            <p class="text-gray-600">{{ $t('tournamentTips.yourTip', { answer: sp.answerLabel ?? sp.answer ?? $t('tournamentTips.noTip') }) }}</p>
            <p class="text-xs text-gray-400 mt-1">{{ $t('tournamentTips.expired') }}</p>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, reactive, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '../components/AppLayout.vue'
import TeamSelectDropdown from '../components/predictions/TeamSelectDropdown.vue'
import PlayerSelectCombobox from '../components/predictions/PlayerSelectCombobox.vue'
import UpsetSpecialPicker from '../components/predictions/UpsetSpecialPicker.vue'
import GroupStandingsPicker from '../components/predictions/GroupStandingsPicker.vue'
import BracketProgressionPicker from '../components/predictions/BracketProgressionPicker.vue'
import { useTournamentTipsStore } from '../stores/tournamentTips.store.js'
import { formatRelativeDeadline } from '../lib/deadline.js'
import { supabase } from '../lib/supabase.js'
import { api } from '../api/index.js'
import type { AllGroupsStandingAnswer, AllGroupsStandingOptions, BracketProgressionOptions, MultiTeamWeightedOptions, SpecialPredictionOptions, SpecialPredictionWithType } from '../types/index.js'

const { t } = useI18n()
const store = useTournamentTipsStore()

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
