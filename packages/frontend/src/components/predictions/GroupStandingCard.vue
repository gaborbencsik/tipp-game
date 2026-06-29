<template>
  <div
    class="rounded-lg overflow-hidden transition-all"
    :class="cardClass"
    :data-testid="`group-standing-card-${groupCode}`"
  >
    <button
      type="button"
      class="w-full flex items-center justify-between gap-2 px-3 py-3 text-left bg-white"
      @click="$emit('toggle')"
    >
      <span class="flex items-center gap-2 min-w-0">
        <span v-if="isDone && !readOnlyScored" class="text-emerald-500" aria-hidden="true">✓</span>
        <span class="font-semibold text-slate-800 text-sm shrink-0">{{ $t('groupStandings.groupTitle', { code: groupCode }) }}</span>
        <span
          v-if="readOnlyScored"
          class="flex items-center gap-1 text-xs text-slate-500 min-w-0 truncate"
          :data-testid="`group-standing-summary-${groupCode}`"
        >
          <template v-for="(item, idx) in summaryItems" :key="idx">
            <span v-if="idx > 0" class="text-slate-300" aria-hidden="true">·</span>
            <span
              class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
              :class="scoredSummaryClass(idx)"
              :data-testid="`group-standing-summary-chip-${groupCode}-${idx + 1}`"
            >
              <img
                v-if="item.flagUrl"
                :src="item.flagUrl"
                :alt="item.name"
                class="w-4 h-3 object-cover rounded-sm flex-shrink-0"
              />
              <span>{{ item.code }}</span>
            </span>
          </template>
        </span>
        <span
          v-else-if="isDone && !expanded"
          class="flex items-center gap-1 text-xs text-slate-500 min-w-0 truncate"
          :data-testid="`group-standing-summary-${groupCode}`"
        >
          <template v-for="(item, idx) in summaryItems" :key="idx">
            <span v-if="idx > 0" class="text-slate-300" aria-hidden="true">·</span>
            <span
              class="inline-flex items-center gap-1"
              :data-testid="`group-standing-summary-chip-${groupCode}-${idx + 1}`"
            >
              <img
                v-if="item.flagUrl"
                :src="item.flagUrl"
                :alt="item.name"
                class="w-4 h-3 object-cover rounded-sm flex-shrink-0"
              />
              <span>{{ item.code }}</span>
            </span>
          </template>
        </span>
      </span>
      <span class="flex items-center gap-2 shrink-0">
        <span
          v-if="readOnlyScored && props.pointsAwarded !== null && props.pointsAwarded !== undefined"
          class="text-xs font-bold px-2 py-0.5 rounded-full"
          :class="pointsPillClass"
          :data-testid="`group-standing-points-${groupCode}`"
        >{{ pointsPillLabel }}</span>
        <span
          v-if="readOnlyScored"
          class="text-xs font-semibold px-2 py-0.5 rounded-full"
          :class="scoredHitsClass"
          :data-testid="`group-standing-hits-${groupCode}`"
        >{{ correctHits }} / {{ teamsPerGroup }}</span>
        <span
          v-else-if="isDone"
          class="text-xs font-medium text-emerald-600"
          :data-testid="`group-standing-status-${groupCode}-done`"
        >{{ $t('groupStandings.done') }}</span>
        <span
          v-else
          class="text-xs font-medium px-2 py-0.5 rounded-full"
          :class="expanded ? 'text-blue-600 bg-blue-50' : 'text-slate-500 bg-slate-100'"
          :data-testid="`group-standing-status-${groupCode}-progress`"
        >{{ filledCount }} / {{ teamsPerGroup }}</span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="w-4 h-4 transition-transform"
          :class="[expanded ? 'rotate-180' : '', expanded ? 'text-blue-500' : 'text-slate-400']"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
        </svg>
      </span>
    </button>

    <div v-if="expanded" class="px-3 pb-3 pt-2 space-y-2 border-t border-slate-100 bg-white">
      <template v-if="readOnlyScored">
        <div
          v-for="pos in positions"
          :key="pos"
          class="rounded-lg px-3 py-2 flex items-center gap-3"
          :class="scoredRowClass(pos)"
          :data-testid="`group-standing-row-${groupCode}-${pos}`"
        >
          <span class="text-xs font-bold text-slate-500 w-5 shrink-0">{{ pos }}.</span>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <img
                v-if="userTeam(pos)?.flagUrl"
                :src="userTeam(pos)!.flagUrl ?? ''"
                :alt="userTeam(pos)?.name ?? ''"
                class="w-5 h-3.5 object-cover rounded-sm shadow-sm"
              />
              <span
                class="text-sm font-medium truncate"
                :class="scoredTeamTextClass(pos)"
              >{{ userTeam(pos)?.name ?? '—' }}</span>
              <span
                v-if="isPosCorrect(pos)"
                class="text-emerald-600 text-xs"
                aria-hidden="true"
              >✓</span>
              <span
                v-else
                class="text-rose-500 text-xs"
                aria-hidden="true"
              >✗</span>
            </div>
            <div
              v-if="!isPosCorrect(pos) && actualTeam(pos)"
              class="flex items-center gap-2 mt-0.5 pl-7 text-[11px] text-slate-500"
              :data-testid="`group-standing-actual-${groupCode}-${pos}`"
            >
              <span class="uppercase tracking-wide font-semibold text-emerald-700">{{ $t('groupStandings.actualAnswer') }}:</span>
              <img
                v-if="actualTeam(pos)!.flagUrl"
                :src="actualTeam(pos)!.flagUrl ?? ''"
                :alt="actualTeam(pos)!.name ?? ''"
                class="w-4 h-3 object-cover rounded-sm"
              />
              <span class="truncate">{{ actualTeam(pos)!.name }}</span>
            </div>
          </div>
        </div>
        <div
          v-if="props.pointsAwarded !== null && props.pointsAwarded !== undefined"
          class="mt-1 text-[11px] text-slate-500 italic"
          :data-testid="`group-standing-footer-${groupCode}`"
        >
          {{ $t('groupStandings.scoreFooter', { hits: `${correctHits}/${teamsPerGroup}`, points: props.pointsAwarded }) }}
        </div>
      </template>
      <template v-else>
        <PositionTeamDropdown
          v-for="pos in positions"
          :key="pos"
          :position="pos"
          :group-code="groupCode"
          :group-teams="groupTeams"
          :current-assignments="assignments"
          :group-done="isDone"
          :model-value="assignments[pos - 1] ?? null"
          @update:model-value="v => onPositionChange(pos, v)"
        />
        <button
          v-if="filledCount > 0"
          type="button"
          class="text-xs text-slate-500 hover:text-slate-700 mt-1"
          :data-testid="`group-standing-clear-${groupCode}`"
          @click="$emit('clear')"
        >
          ↺ {{ $t('groupStandings.clearGroup') }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import PositionTeamDropdown from './PositionTeamDropdown.vue'
import type { Team } from '../../types/index.js'

const props = defineProps<{
  groupCode: string
  groupTeams: readonly Team[]
  assignments: readonly (string | null)[]
  teamsPerGroup: number
  expanded: boolean
  // UX-039: scored read-only mode.
  correctPositions?: readonly (string | null)[]
  readOnlyScored?: boolean
  // UX-040: per-group points awarded for this card (3 or 0 in MVP).
  pointsAwarded?: number | null
}>()

const emit = defineEmits<{
  'toggle': []
  'clear': []
  'update': [position: 1 | 2 | 3 | 4, teamId: string | null]
}>()

const positions = computed<(1 | 2 | 3 | 4)[]>(() => {
  return Array.from({ length: props.teamsPerGroup }, (_, i) => (i + 1) as 1 | 2 | 3 | 4)
})

const filledCount = computed(() => props.assignments.filter(t => t !== null).length)
const isDone = computed(() => filledCount.value === props.teamsPerGroup)

const teamMap = computed(() => new Map(props.groupTeams.map(t => [t.id, t])))

const summaryItems = computed<{ code: string; flagUrl: string | null; name: string }[]>(() =>
  props.assignments.map(id => {
    const t = id ? teamMap.value.get(id) : undefined
    return {
      code: t?.shortCode ?? '—',
      flagUrl: t?.flagUrl ?? null,
      name: t?.name ?? '',
    }
  }),
)

const correctHits = computed(() => {
  const corr = props.correctPositions
  if (!corr) return 0
  let hits = 0
  for (let i = 0; i < props.teamsPerGroup; i++) {
    if (props.assignments[i] && props.assignments[i] === corr[i]) hits += 1
  }
  return hits
})

const scoredHitsClass = computed(() => {
  if (correctHits.value === props.teamsPerGroup) return 'bg-emerald-100 text-emerald-700'
  if (correctHits.value === 0) return 'bg-rose-100 text-rose-700'
  return 'bg-amber-100 text-amber-700'
})

function isPosCorrect(pos: number): boolean {
  const idx = pos - 1
  const corr = props.correctPositions
  if (!corr) return false
  const a = props.assignments[idx]
  const c = corr[idx]
  return Boolean(a && c && a === c)
}

function isPosKnownIncorrect(pos: number): boolean {
  const idx = pos - 1
  const corr = props.correctPositions
  if (!corr) return false
  const c = corr[idx]
  if (!c) return false
  return !isPosCorrect(pos)
}

function scoredSummaryClass(idx: number): string {
  if (!props.correctPositions) return ''
  const pos = idx + 1
  if (isPosCorrect(pos)) return 'bg-emerald-100 text-emerald-800'
  if (isPosKnownIncorrect(pos)) return 'bg-rose-100 text-rose-800'
  return 'bg-slate-100 text-slate-600'
}

function scoredRowClass(pos: number): string {
  if (isPosCorrect(pos)) return 'bg-emerald-50 border border-emerald-200'
  if (isPosKnownIncorrect(pos)) return 'bg-rose-50 border border-rose-200'
  return 'bg-slate-50 border border-slate-200'
}

function scoredTeamTextClass(pos: number): string {
  if (isPosCorrect(pos)) return 'text-emerald-900'
  if (isPosKnownIncorrect(pos)) return 'text-rose-900'
  return 'text-slate-700'
}

function userTeam(pos: number): Team | undefined {
  const id = props.assignments[pos - 1]
  if (!id) return undefined
  return teamMap.value.get(id)
}

function actualTeam(pos: number): Team | undefined {
  const id = props.correctPositions?.[pos - 1]
  if (!id) return undefined
  return teamMap.value.get(id)
}

const cardClass = computed(() => {
  if (props.readOnlyScored) {
    if (correctHits.value === props.teamsPerGroup) return 'border border-emerald-300 shadow-sm'
    if (correctHits.value === 0) return 'border border-rose-200 shadow-sm'
    return 'border border-slate-200 shadow-sm'
  }
  if (props.expanded) return 'border-2 border-blue-400 ring-4 ring-blue-100 shadow-md'
  if (isDone.value) return 'border border-emerald-300 shadow-sm'
  return 'border border-slate-200 shadow-sm'
})

const pointsPillClass = computed(() => {
  const p = props.pointsAwarded ?? 0
  return p > 0
    ? 'bg-emerald-100 text-emerald-800'
    : 'bg-slate-100 text-slate-500'
})

const pointsPillLabel = computed(() => {
  const p = props.pointsAwarded ?? 0
  // Use i18n via $t inline keeps the test simple; here we use a string-builder fallback.
  return p > 0 ? `+${p}` : '0'
})

function onPositionChange(pos: 1 | 2 | 3 | 4, teamId: string | null): void {
  emit('update', pos, teamId)
}
</script>
