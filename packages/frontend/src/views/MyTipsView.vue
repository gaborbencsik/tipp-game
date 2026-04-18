<template>
  <AppLayout>
    <h1 class="text-2xl font-bold text-gray-900 mb-6">Tippjeim</h1>

    <div v-if="matchesStore.isLoading || predictionsStore.isLoading" class="flex justify-center py-16">
      <div class="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>

    <div v-else-if="matchesStore.matchesByDate.length === 0" class="text-center text-gray-500 py-16">
      Nincs megjeleníthető mérkőzés.
    </div>

    <div v-else>
      <div
        v-for="group in [...matchesStore.matchesByDate].reverse()"
        :key="group.date"
        class="mb-8"
      >
        <h2 class="text-lg font-semibold text-gray-700 mb-3 border-b border-gray-200 pb-1">
          {{ group.label }}
        </h2>

        <div
          v-for="match in group.matches"
          :key="match.id"
          class="bg-white rounded-lg shadow-sm border p-4 mb-3"
          :class="rowBorderClass(match)"
        >
          <div class="flex items-center justify-between gap-4">
            <!-- Teams + score -->
            <div class="flex items-center gap-3 flex-1 min-w-0">
              <div class="text-lg shrink-0">{{ statusIcon(match) }}</div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 text-sm font-medium text-gray-800">
                  <span class="truncate"><TeamBadge :team="match.homeTeam" /></span>
                  <span class="text-gray-400 shrink-0">
                    <template v-if="match.result">{{ match.result.homeGoals }}–{{ match.result.awayGoals }}</template>
                    <template v-else>vs</template>
                  </span>
                  <span class="truncate"><TeamBadge :team="match.awayTeam" /></span>
                </div>
                <div class="text-xs text-gray-400 mt-0.5">{{ formatDateTime(match.scheduledAt) }}</div>
              </div>
            </div>

            <!-- Tipp / státusz -->
            <div class="shrink-0">
              <template v-if="isTippable(match)">
                <!-- Inline szerkesztés -->
                <div v-if="activeMatchId === match.id" class="flex items-center gap-1">
                  <input
                    :ref="el => { if (el) homeInputs[match.id] = el as HTMLInputElement }"
                    :value="draftGoals[match.id]?.home ?? ''"
                    type="number"
                    min="0"
                    max="99"
                    placeholder="0"
                    class="w-12 text-center border border-gray-300 rounded px-1 py-1 text-sm focus:outline-none focus:border-blue-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    @focus="onFocus(match.id, 'home', $event)"
                    @input="onInput(match.id, 'home', ($event.target as HTMLInputElement).value)"
                    @keydown="onKeydown(match.id, 'home', $event)"
                    @blur="onBlur(match.id)"
                  />
                  <span class="text-gray-400 text-sm">–</span>
                  <input
                    :ref="el => { if (el) awayInputs[match.id] = el as HTMLInputElement }"
                    :value="draftGoals[match.id]?.away ?? ''"
                    type="number"
                    min="0"
                    max="99"
                    placeholder="0"
                    class="w-12 text-center border border-gray-300 rounded px-1 py-1 text-sm focus:outline-none focus:border-blue-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    @focus="onFocus(match.id, 'away', $event)"
                    @input="onInput(match.id, 'away', ($event.target as HTMLInputElement).value)"
                    @keydown="onKeydown(match.id, 'away', $event)"
                    @blur="onBlur(match.id)"
                  />
                </div>

                <!-- Megjelenítés / kattintható -->
                <template v-else>
                  <template v-if="predictionsStore.predictionByMatchId(match.id)">
                    <button
                      class="text-sm font-semibold text-green-700 hover:text-green-900 transition-colors"
                      @click="openEdit(match.id)"
                    >
                      {{ predictionsStore.predictionByMatchId(match.id)!.homeGoals }}
                      –
                      {{ predictionsStore.predictionByMatchId(match.id)!.awayGoals }}
                    </button>
                    <div class="text-xs text-gray-400 text-right">
                      <span v-if="predictionsStore.saveStatus[match.id] === 'saved'" class="text-green-600">elmentve ✓</span>
                      <span v-else>elmentve</span>
                    </div>
                  </template>
                  <template v-else>
                    <button
                      class="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded hover:bg-amber-100 transition-colors"
                      @click="openEdit(match.id)"
                    >
                      Tippelj!
                    </button>
                  </template>
                </template>
              </template>

              <template v-else-if="match.status === 'finished' || match.status === 'live'">
                <template v-if="predictionsStore.predictionByMatchId(match.id)">
                  <div class="text-sm font-semibold text-gray-700 text-right">
                    {{ predictionsStore.predictionByMatchId(match.id)!.homeGoals }}
                    –
                    {{ predictionsStore.predictionByMatchId(match.id)!.awayGoals }}
                    <span v-if="predictionsStore.predictionByMatchId(match.id)!.outcomeAfterDraw" class="text-xs font-normal text-gray-500 ml-1">
                      · {{ outcomeLabel(predictionsStore.predictionByMatchId(match.id)!.outcomeAfterDraw!) }}
                    </span>
                  </div>
                  <div v-if="predictionsStore.predictionByMatchId(match.id)!.pointsGlobal !== null" class="text-xs font-bold text-blue-600 text-right">
                    {{ predictionsStore.predictionByMatchId(match.id)!.pointsGlobal }} pont
                  </div>
                </template>
                <template v-else>
                  <span class="text-xs text-red-500 font-medium">Kimaradt</span>
                </template>
              </template>

              <template v-else>
                <span class="text-xs text-gray-400">–</span>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import TeamBadge from '../components/TeamBadge.vue'
import { useMatchesStore } from '../stores/matches.store.js'
import { usePredictionsStore } from '../stores/predictions.store.js'
import type { Match, MatchOutcome } from '../types/index.js'

const matchesStore = useMatchesStore()
const predictionsStore = usePredictionsStore()

const now = new Date()
const activeMatchId = ref<string | null>(null)
const draftGoals = ref<Record<string, { home: number | null; away: number | null }>>({})
const homeInputs = ref<Record<string, HTMLInputElement>>({})
const awayInputs = ref<Record<string, HTMLInputElement>>({})
const autosaveTimers: Record<string, ReturnType<typeof setTimeout>> = {}

onMounted(async () => {
  await Promise.all([
    matchesStore.matches.length === 0 ? matchesStore.fetchMatches() : Promise.resolve(),
    predictionsStore.predictions.length === 0 ? predictionsStore.fetchMyPredictions() : Promise.resolve(),
  ])
  initDrafts()
})

function initDrafts(): void {
  for (const match of matchesStore.matches) {
    const existing = predictionsStore.predictionByMatchId(match.id)
    if (existing) {
      draftGoals.value[match.id] = { home: existing.homeGoals, away: existing.awayGoals }
    }
  }
}

function openEdit(matchId: string): void {
  activeMatchId.value = matchId
  if (!draftGoals.value[matchId]) {
    draftGoals.value[matchId] = { home: null, away: null }
  }
  nextTick(() => {
    homeInputs.value[matchId]?.focus()
    homeInputs.value[matchId]?.select()
  })
}

function onFocus(matchId: string, side: 'home' | 'away', event: FocusEvent): void {
  const input = event.target as HTMLInputElement
  if (draftGoals.value[matchId]?.[side] == null) {
    const current = draftGoals.value[matchId] ?? { home: null, away: null }
    draftGoals.value = { ...draftGoals.value, [matchId]: { ...current, [side]: 0 } }
  }
  nextTick(() => input.select())
}

function onInput(matchId: string, side: 'home' | 'away', raw: string): void {
  const val = raw === '' ? null : Math.min(99, Math.max(0, parseInt(raw, 10)))
  const current = draftGoals.value[matchId] ?? { home: null, away: null }
  draftGoals.value = { ...draftGoals.value, [matchId]: { ...current, [side]: val } }
  if (autosaveTimers[matchId]) clearTimeout(autosaveTimers[matchId])
  autosaveTimers[matchId] = setTimeout(() => { void savePrediction(matchId) }, 2000)
}

function onKeydown(matchId: string, side: 'home' | 'away', event: KeyboardEvent): void {
  if (/^[0-9]$/.test(event.key)) {
    event.preventDefault()
    const val = parseInt(event.key, 10)
    const current = draftGoals.value[matchId] ?? { home: null, away: null }
    draftGoals.value = { ...draftGoals.value, [matchId]: { ...current, [side]: val } }
    if (autosaveTimers[matchId]) clearTimeout(autosaveTimers[matchId])
    autosaveTimers[matchId] = setTimeout(() => { void savePrediction(matchId) }, 2000)
    if (side === 'home') {
      nextTick(() => {
        awayInputs.value[matchId]?.focus()
        awayInputs.value[matchId]?.select()
      })
    } else {
      nextTick(() => awayInputs.value[matchId]?.blur())
    }
  }
}

function onBlur(matchId: string): void {
  // kis delay hogy a másik input fókuszálható legyen ugyanazon a meccsen
  setTimeout(() => {
    const homeActive = document.activeElement === homeInputs.value[matchId]
    const awayActive = document.activeElement === awayInputs.value[matchId]
    if (!homeActive && !awayActive) {
      void savePrediction(matchId)
      activeMatchId.value = null
    }
  }, 100)
}

async function savePrediction(matchId: string): Promise<void> {
  const draft = draftGoals.value[matchId]
  if (draft?.home == null || draft?.away == null) return
  await predictionsStore.upsertPrediction({ matchId, homeGoals: draft.home, awayGoals: draft.away })
}

function isTippable(match: Match): boolean {
  return match.status === 'scheduled' && new Date(match.scheduledAt) > now
}

function statusIcon(match: Match): string {
  const prediction = predictionsStore.predictionByMatchId(match.id)
  if (isTippable(match)) return prediction ? '✅' : '⏳'
  if (match.status === 'finished' || match.status === 'live') return prediction ? '🔒' : '❌'
  return '–'
}

function rowBorderClass(match: Match): string {
  const prediction = predictionsStore.predictionByMatchId(match.id)
  if (isTippable(match) && !prediction) return 'border-amber-300 bg-amber-50'
  if ((match.status === 'finished' || match.status === 'live') && !prediction) return 'border-red-200'
  return 'border-gray-100'
}

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('hu-HU', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso))
}

function outcomeLabel(outcome: MatchOutcome): string {
  switch (outcome) {
    case 'extra_time_home': return 'H+hossz.'
    case 'extra_time_away': return 'V+hossz.'
    case 'penalties_home': return 'H+tiz.'
    case 'penalties_away': return 'V+tiz.'
  }
}
</script>
