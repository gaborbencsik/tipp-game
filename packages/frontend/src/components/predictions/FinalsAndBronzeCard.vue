<template>
  <section
    class="rounded-xl bg-white"
    :class="cardClass"
    data-testid="bracket-finals-bronze"
  >
    <button
      type="button"
      class="w-full flex items-center justify-between px-3 py-3 text-left"
      @click="$emit('toggle')"
    >
      <span class="font-semibold text-sm flex items-center gap-1.5" :class="titleClass">
        <span v-if="isEvaluated ? championHit : isDone" class="text-emerald-500" aria-hidden="true">✓</span>
        <span>{{ $t('bracketProgression.finalsAndBronzeTitle') }}</span>
      </span>
      <span v-if="isEvaluated" class="flex items-center gap-1.5">
        <span
          class="text-xs font-semibold px-2 py-0.5 rounded-full"
          :class="championPillClass"
          data-testid="bracket-final-champion-pill"
        >👑 {{ championPillLabel }}</span>
        <span
          class="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-500"
          data-testid="bracket-final-bronze-pill"
        >🥉 0 p</span>
      </span>
      <span
        v-else
        class="text-xs font-semibold px-2 py-0.5 rounded-full"
        :class="badgeClass"
      >{{ doneCount }} / 2</span>
    </button>
    <div v-if="expanded" class="px-3 pb-3 border-t border-slate-100 pt-3 space-y-4">
      <div v-if="finalMatch">
        <BracketMatchCard
          :match="finalMatch"
          :team-map="teamMap"
          :advancing-team-ids="finalMatchAdvancingIds"
          :is-read-only="isReadOnly"
          @pick="(matchId, teamId) => $emit('pick', matchId, teamId)"
        />
        <div
          v-if="isEvaluated && userChampionPick"
          class="mt-1.5 flex items-center justify-center gap-2 rounded-lg border px-3 py-1.5"
          :class="userPickRowClass"
          :data-testid="'bracket-final-user-pick'"
        >
          <span :class="userPickIconClass" aria-hidden="true">{{ userPickIcon }}</span>
          <span
            class="text-sm font-semibold flex items-center gap-1.5"
            :class="userPickTextClass"
            :aria-label="$t('bracketProgression.yourChampionPick', { team: userChampionTeam?.shortCode ?? '' })"
          >
            <img
              v-if="userChampionTeam?.flagUrl"
              :src="userChampionTeam.flagUrl"
              :alt="userChampionTeam.name"
              class="w-5 h-3.5 object-cover rounded-sm flex-shrink-0"
            />
            <span>{{ userChampionTeam?.shortCode ?? '?' }}</span>
          </span>
        </div>
      </div>
      <BracketMatchCard
        v-if="bronzeMatch"
        :match="bronzeMatch"
        :team-map="teamMap"
        :advancing-team-ids="bronzeMatchAdvancingIds"
        :is-read-only="isReadOnly"
        @pick="(matchId, teamId) => $emit('pick', matchId, teamId)"
      />
      <div
        v-if="isEvaluated"
        class="text-[11px] text-slate-500 flex items-center justify-between"
        data-testid="bracket-bronze-note"
      >
        <span :title="$t('bracketProgression.bronzeNoScoreTooltip')" class="cursor-help">
          {{ $t('bracketProgression.bronzeNoScore') }}
        </span>
      </div>
      <div
        v-if="!isEvaluated && summary"
        class="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5 text-xs text-emerald-900"
      >
        ✅ <span class="font-semibold">{{ $t('bracketProgression.summaryTitle') }}</span><br>
        {{ summary }}
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BracketMatchCard from './BracketMatchCard.vue'
import type { Team } from '../../types/index.js'
import type { DerivedMatch } from '../../lib/bracketDerive.js'

const props = defineProps<{
  matches: readonly DerivedMatch[]
  expanded: boolean
  teamMap: ReadonlyMap<string, Team>
  /**
   * UX-045: teams that reached the final (i.e. `correctAnswer.participants.final`).
   * When null, chips render in their pre-eval colors.
   */
  advancingTeamIds?: ReadonlySet<string> | null
  /**
   * UX-045: teams that reached the bronze match (i.e. SF participants minus finalists).
   * When null, chips render in their pre-eval colors. Bronze awards 0 points, but the
   * chip still colors correct/wrong so the user sees whether their bronze tip was on
   * a team that actually played the third-place match.
   */
  bronzeAdvancingTeamIds?: ReadonlySet<string> | null
  championId?: string | null
  evaluation?: {
    final: { matched: number; points: number; pointsPerTeam: number; pending?: boolean }
    champion: { hit: boolean; points: number }
  } | null
  isReadOnly?: boolean
}>()

defineEmits<{
  'toggle': []
  'pick': [matchId: string, teamId: string]
}>()

const { t } = useI18n()

const finalMatch = computed(() => props.matches.find(m => m.id === 'final'))
const bronzeMatch = computed(() => props.matches.find(m => m.id === 'bronze'))

const doneCount = computed(() => {
  let n = 0
  if (finalMatch.value?.winnerId) n += 1
  if (bronzeMatch.value?.winnerId) n += 1
  return n
})

const isDone = computed(() => doneCount.value === 2)
const isEvaluated = computed(() => !!props.evaluation)

// UX-045: on the final match, "green vs red" would compare each chip to the finalists set,
// but the user usually cares more about the champion — so we highlight only the user's own
// champion pick vs the truth. To do that, we build a per-match advancing set:
//   • final match: use { championId } if known; otherwise fall back to advancingTeamIds.
//     A chip whose team === championId is green; the OTHER chip (the runner-up) is red.
//   • bronze match: use `bronzeAdvancingTeamIds` (SF participants minus finalists).
const finalMatchAdvancingIds = computed<ReadonlySet<string> | null>(() => {
  if (!isEvaluated.value) return null
  if (props.championId) return new Set([props.championId])
  return props.advancingTeamIds ?? null
})

const bronzeMatchAdvancingIds = computed<ReadonlySet<string> | null>(() => {
  if (!isEvaluated.value) return null
  return props.bronzeAdvancingTeamIds ?? null
})

const championHit = computed(() => !!props.evaluation?.champion.hit)

// UX-047: the user's champion pick is the team they selected as the final's winner.
const userChampionPick = computed<string | null>(() => finalMatch.value?.winnerId ?? null)
const userChampionTeam = computed<Team | null>(() =>
  userChampionPick.value ? (props.teamMap.get(userChampionPick.value) ?? null) : null,
)

// Pending: finalists are evaluated but the champion is not yet set (championId == null).
const userPickPending = computed(() => isEvaluated.value && !props.championId)
const userPickHit = computed(
  () => !!props.championId && userChampionPick.value === props.championId,
)

const userPickIcon = computed(() => {
  if (userPickPending.value) return '⏳'
  return userPickHit.value ? '✓' : '✗'
})

const userPickIconClass = computed(() => {
  if (userPickPending.value) return 'text-slate-400'
  return userPickHit.value ? 'text-emerald-600' : 'text-red-600'
})

const userPickRowClass = computed(() => {
  if (userPickPending.value) return 'border-slate-200 bg-slate-50'
  return userPickHit.value ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'
})

const userPickTextClass = computed(() => {
  if (userPickPending.value) return 'text-slate-500'
  return userPickHit.value ? 'text-emerald-900' : 'text-red-900 line-through decoration-red-400'
})

const championPillClass = computed(() =>
  championHit.value ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500',
)

const championPillLabel = computed(() => {
  const pts = props.evaluation?.champion.points ?? 0
  return pts > 0 ? `+${pts} p` : '0 p'
})

const cardClass = computed(() => {
  if (props.expanded) return 'border-2 border-blue-400 ring-4 ring-blue-100 shadow-md'
  if (isEvaluated.value && championHit.value) return 'border border-emerald-300 shadow-sm'
  if (isEvaluated.value) return 'border border-slate-200'
  if (isDone.value) return 'border border-emerald-300 shadow-sm'
  return 'border border-slate-200'
})

const titleClass = computed(() => 'text-slate-800')

const badgeClass = computed(() => {
  if (isDone.value) return 'bg-emerald-50 text-emerald-700'
  if (props.expanded) return 'bg-blue-50 text-blue-600'
  return 'bg-slate-100 text-slate-600'
})

const summary = computed(() => {
  const f = finalMatch.value
  const b = bronzeMatch.value
  if (!f?.winnerId) return ''
  const champion = props.teamMap.get(f.winnerId)?.shortCode ?? '?'
  const silverId = f.teamA === f.winnerId ? f.teamB : f.teamA
  const silver = silverId ? (props.teamMap.get(silverId)?.shortCode ?? '?') : '?'
  const parts = [
    t('bracketProgression.summary.champion', { team: champion }),
    t('bracketProgression.summary.silver', { team: silver }),
  ]
  if (b?.winnerId) {
    const bronze = props.teamMap.get(b.winnerId)?.shortCode ?? '?'
    const fourthId = b.teamA === b.winnerId ? b.teamB : b.teamA
    const fourth = fourthId ? (props.teamMap.get(fourthId)?.shortCode ?? '?') : '?'
    parts.push(t('bracketProgression.summary.bronze', { team: bronze }))
    parts.push(t('bracketProgression.summary.fourth', { team: fourth }))
  }
  return parts.join(' · ')
})
</script>
