<template>
  <AppLayout>
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-2xl font-bold text-gray-900">Mérkőzések</h1>
      </div>

      <div class="flex gap-2 mb-6">
        <button
          class="px-3 py-1 text-sm rounded"
          :class="!matchesStore.stageFilter ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
          @click="matchesStore.stageFilter = null"
        >
          Összes
        </button>
        <button
          class="px-3 py-1 text-sm rounded"
          :class="matchesStore.stageFilter === 'group' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
          @click="matchesStore.stageFilter = 'group'"
        >
          Csoportkör
        </button>
        <button
          class="px-3 py-1 text-sm rounded"
          :class="matchesStore.stageFilter && matchesStore.stageFilter !== 'group' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'"
          @click="matchesStore.stageFilter = 'round_of_16'"
        >
          Egyenes kiesés
        </button>
      </div>

      <div v-if="matchesStore.isLoading" class="flex justify-center py-16">
        <div data-testid="spinner" class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>

      <div v-else-if="matchesStore.error" class="bg-red-50 border border-red-200 text-red-700 rounded p-4">
        {{ matchesStore.error }}
      </div>

      <div v-else-if="matchesStore.matchesByDate.length === 0" class="text-center text-gray-500 py-16">
        Nincs megjeleníthető mérkőzés.
      </div>

      <div v-else>
        <div
          v-for="group in matchesStore.matchesByDate"
          :key="group.date"
          class="mb-8"
        >
          <h2
            class="text-lg font-semibold text-gray-700 mb-3 border-b border-gray-200 pb-1 flex items-center justify-between"
            :class="isCollapsible(group) ? 'cursor-pointer select-none hover:text-gray-900' : ''"
            @click="isCollapsible(group) && toggleCollapsed(group.date)"
          >
            <span>{{ group.label }}</span>
            <svg
              v-if="isCollapsible(group)"
              xmlns="http://www.w3.org/2000/svg"
              class="w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0"
              :class="collapsedDates.has(group.date) ? '' : 'rotate-180'"
              fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </h2>

          <template v-if="!collapsedDates.has(group.date)">
            <div
              v-for="match in visibleMatches(group)"
              :key="match.id"
              class="bg-white rounded-lg shadow-sm border p-4 mb-3"
              :class="cardBorderClass(match)"
            >
            <router-link
              :to="`/matches/${match.id}`"
              class="block"
            >
              <div class="flex items-center justify-between mb-2">
                <span class="text-xs font-medium uppercase tracking-wide text-gray-500">
                  {{ stageLabel(match.stage) }}
                  <span v-if="match.groupName"> – {{ match.groupName }} csoport</span>
                </span>
                <span
                  class="text-xs font-bold px-2 py-0.5 rounded"
                  :class="statusClass(match.status)"
                >
                  {{ statusLabel(match.status) }}
                </span>
              </div>

              <div class="flex items-center justify-center gap-4">
                <span class="font-semibold text-gray-800 text-right flex-1">{{ match.homeTeam.name }}</span>

                <div class="text-xl font-bold text-gray-900 min-w-[5rem] text-center">
                  <template v-if="match.result">
                    {{ match.result.homeGoals }} – {{ match.result.awayGoals }}
                  </template>
                  <template v-else>
                    {{ formatTime(match.scheduledAt) }}
                  </template>
                </div>

                <span class="font-semibold text-gray-800 text-left flex-1">{{ match.awayTeam.name }}</span>
              </div>

              <div v-if="match.venue" class="text-xs text-gray-400 text-center mt-1">
                {{ match.venue.city }}
              </div>
            </router-link>

            <!-- Tipp szekció -->
            <div class="mt-3 pt-3 border-t border-gray-100">
              <!-- Tippelhető meccs -->
              <template v-if="isTippable(match)">
                <div class="flex items-center gap-2 justify-center">
                  <span class="text-sm">{{ predictionsStore.predictionByMatchId(match.id) ? '✅' : '⏳' }}</span>
                  <input
                    :ref="el => { if (el) homeInputs[match.id] = el as HTMLInputElement }"
                    :value="draftGoals[match.id]?.home ?? ''"
                    type="number"
                    min="0"
                    max="99"
                    placeholder="0"
                    data-testid="input-home"
                    class="w-14 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                    :disabled="predictionsStore.saveStatus[match.id] === 'saving'"
                    @focus="onGoalFocus(match.id, 'home', $event)"
                    @input="onGoalInput(match.id, 'home', ($event.target as HTMLInputElement).value)"
                    @keydown="onGoalKeydown(match.id, 'home', $event)"
                  />
                  <span class="text-gray-400 text-sm">–</span>
                  <input
                    :ref="el => { if (el) awayInputs[match.id] = el as HTMLInputElement }"
                    :value="draftGoals[match.id]?.away ?? ''"
                    type="number"
                    min="0"
                    max="99"
                    placeholder="0"
                    data-testid="input-away"
                    class="w-14 text-center border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:border-blue-400"
                    :disabled="predictionsStore.saveStatus[match.id] === 'saving'"
                    @focus="onGoalFocus(match.id, 'away', $event)"
                    @input="onGoalInput(match.id, 'away', ($event.target as HTMLInputElement).value)"
                    @keydown="onGoalKeydown(match.id, 'away', $event)"
                  />
                </div>
                <div class="text-center mt-1 text-xs">
                  <span
                    v-if="predictionsStore.saveStatus[match.id] === 'saved'"
                    class="text-green-600"
                    data-testid="save-success"
                  >
                    Tipp elmentve! ✓
                  </span>
                  <span
                    v-else-if="predictionsStore.saveStatus[match.id] === 'error'"
                    class="text-red-500"
                  >
                    {{ predictionsStore.error }}
                  </span>
                  <span
                    v-else-if="predictionsStore.predictionByMatchId(match.id)"
                    class="text-gray-400"
                  >
                    Utoljára módosítva: {{ formatDateTime(predictionsStore.predictionByMatchId(match.id)!.updatedAt) }}
                  </span>
                </div>
              </template>

              <!-- Lezárt meccs -->
              <template v-else>
                <div class="text-center text-xs text-gray-400">
                  <template v-if="predictionsStore.predictionByMatchId(match.id)">
                    <span class="mr-1">🔒</span>
                    <span class="mr-2">
                      Tippem:
                      <strong class="text-gray-600">
                        {{ predictionsStore.predictionByMatchId(match.id)!.homeGoals }}
                        –
                        {{ predictionsStore.predictionByMatchId(match.id)!.awayGoals }}
                      </strong>
                    </span>
                    <span v-if="predictionsStore.predictionByMatchId(match.id)!.pointsGlobal !== null">
                      · <strong class="text-blue-600">{{ predictionsStore.predictionByMatchId(match.id)!.pointsGlobal }} pont</strong>
                    </span>
                  </template>
                  <template v-else>
                    <span>❌ Nem tippeltél erre a meccsre</span>
                  </template>
                </div>
              </template>
            </div>
          </div>

            <button
              v-if="isCollapsible(group) && group.matches.length > COLLAPSED_LIMIT && expandedDates.has(group.date) === false"
              class="text-xs text-blue-600 hover:text-blue-800 mt-1 mb-2"
              @click="expandedDates.add(group.date)"
            >
              Összes mutatása ({{ group.matches.length }} db)
            </button>
          </template>
        </div>
      </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { onMounted, ref, nextTick, computed } from 'vue'
import { useMatchesStore } from '../stores/matches.store.js'
import { usePredictionsStore } from '../stores/predictions.store.js'
import type { Match, MatchDateGroup, MatchStage, MatchStatus } from '../types/index.js'
import AppLayout from '../components/AppLayout.vue'

const matchesStore = useMatchesStore()
const predictionsStore = usePredictionsStore()

const now = ref(new Date())
const draftGoals = ref<Record<string, { home: number | null, away: number | null }>>({})
const homeInputs = ref<Record<string, HTMLInputElement>>({})
const awayInputs = ref<Record<string, HTMLInputElement>>({})
const autosaveTimers: Record<string, ReturnType<typeof setTimeout>> = {}

const COLLAPSED_LIMIT = 5
const collapsedDates = ref<Set<string>>(new Set())
const expandedDates = ref<Set<string>>(new Set())

// Ordered list of all tippable inputs: [matchId, side] pairs in display order
const inputOrder = computed((): Array<{ matchId: string; side: 'home' | 'away' }> => {
  const order: Array<{ matchId: string; side: 'home' | 'away' }> = []
  for (const group of matchesStore.matchesByDate) {
    for (const match of group.matches) {
      if (isTippable(match)) {
        order.push({ matchId: match.id, side: 'home' })
        order.push({ matchId: match.id, side: 'away' })
      }
    }
  }
  return order
})

onMounted(async () => {
  await matchesStore.fetchMatches()
  await predictionsStore.fetchMyPredictions()
  initDrafts()
  initCollapsed()
})

function initCollapsed(): void {
  for (const group of matchesStore.matchesByDate) {
    if (isCollapsible(group)) {
      collapsedDates.value.add(group.date)
    }
  }
}

function isCollapsible(group: MatchDateGroup): boolean {
  return group.matches.every(m => m.status === 'finished' || m.status === 'cancelled')
}

function toggleCollapsed(date: string): void {
  if (collapsedDates.value.has(date)) {
    collapsedDates.value = new Set([...collapsedDates.value].filter(d => d !== date))
  } else {
    collapsedDates.value = new Set([...collapsedDates.value, date])
    expandedDates.value = new Set([...expandedDates.value].filter(d => d !== date))
  }
}

function visibleMatches(group: MatchDateGroup): Match[] {
  if (!isCollapsible(group) || expandedDates.value.has(group.date)) return group.matches
  return group.matches.slice(-COLLAPSED_LIMIT)
}

function initDrafts(): void {
  for (const match of matchesStore.matches) {
    const existing = predictionsStore.predictionByMatchId(match.id)
    if (existing) {
      draftGoals.value[match.id] = { home: existing.homeGoals, away: existing.awayGoals }
    }
  }
}

function isTippable(match: Match): boolean {
  return match.status === 'scheduled' && new Date(match.scheduledAt) > now.value
}

function cardBorderClass(match: Match): string {
  const prediction = predictionsStore.predictionByMatchId(match.id)
  if (isTippable(match) && !prediction) return 'border-amber-300 bg-amber-50'
  if ((match.status === 'finished' || match.status === 'live') && !prediction) return 'border-red-200'
  return 'border-gray-100'
}

function onGoalFocus(matchId: string, side: 'home' | 'away', event: FocusEvent): void {
  const input = event.target as HTMLInputElement
  if (draftGoals.value[matchId]?.[side] == null) {
    const current = draftGoals.value[matchId] ?? { home: null, away: null }
    draftGoals.value = { ...draftGoals.value, [matchId]: { ...current, [side]: 0 } }
  }
  nextTick(() => input.select())
}

function onGoalInput(matchId: string, side: 'home' | 'away', raw: string): void {
  const val = raw === '' ? null : Math.min(99, Math.max(0, parseInt(raw, 10)))
  const current = draftGoals.value[matchId] ?? { home: null, away: null }
  draftGoals.value = { ...draftGoals.value, [matchId]: { ...current, [side]: val } }
  if (autosaveTimers[matchId]) clearTimeout(autosaveTimers[matchId])
  autosaveTimers[matchId] = setTimeout(() => { void savePrediction(matchId) }, 2000)
}

function onGoalKeydown(matchId: string, side: 'home' | 'away', event: KeyboardEvent): void {
  if (/^[0-9]$/.test(event.key)) {
    const currentIdx = inputOrder.value.findIndex(e => e.matchId === matchId && e.side === side)
    const next = inputOrder.value[currentIdx + 1]
    if (!next) return
    event.preventDefault()
    const val = parseInt(event.key, 10)
    const current = draftGoals.value[matchId] ?? { home: null, away: null }
    draftGoals.value = { ...draftGoals.value, [matchId]: { ...current, [side]: val } }
    if (autosaveTimers[matchId]) clearTimeout(autosaveTimers[matchId])
    autosaveTimers[matchId] = setTimeout(() => { void savePrediction(matchId) }, 2000)
    nextTick(() => {
      const target = next.side === 'home' ? homeInputs.value[next.matchId] : awayInputs.value[next.matchId]
      if (target) { target.focus(); target.select() }
    })
  }
}

async function savePrediction(matchId: string): Promise<void> {
  const draft = draftGoals.value[matchId]
  if (draft?.home == null || draft?.away == null) return
  await predictionsStore.upsertPrediction({
    matchId,
    homeGoals: draft.home,
    awayGoals: draft.away,
  })
}

function statusLabel(status: MatchStatus): string {
  switch (status) {
    case 'live': return 'ÉLŐBEN'
    case 'finished': return 'Befejezett'
    case 'scheduled': return 'Tervezett'
    case 'cancelled': return 'Törölve'
  }
}

function statusClass(status: MatchStatus): string {
  switch (status) {
    case 'live': return 'bg-red-500 text-white'
    case 'finished': return 'bg-gray-200 text-gray-600'
    case 'scheduled': return 'bg-blue-100 text-blue-700'
    case 'cancelled': return 'bg-gray-100 text-gray-400'
  }
}

function stageLabel(stage: MatchStage): string {
  switch (stage) {
    case 'group': return 'Csoportkör'
    case 'round_of_16': return 'Nyolcaddöntő'
    case 'quarter_final': return 'Negyeddöntő'
    case 'semi_final': return 'Elődöntő'
    case 'third_place': return 'Bronzmérkőzés'
    case 'final': return 'Döntő'
  }
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('hu-HU', {
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('hu-HU', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}
</script>
