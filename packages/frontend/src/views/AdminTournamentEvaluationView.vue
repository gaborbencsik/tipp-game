<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold text-gray-900">Torna-tipp kiértékelés</h1>
    </div>
    <AdminNav />

    <div v-if="store.error" class="mb-4 p-3 bg-red-100 text-red-700 rounded text-sm">
      {{ store.error }}
    </div>

    <p class="text-sm text-gray-600 mb-4 max-w-2xl">
      Itt írod be a globális speciális tippek helyes válaszait, és szeletenként (csoportonként
      vagy körönként) futtatod a kiértékelést. A pontok ezután minden aktív felhasználónál
      automatikusan újraszámolódnak.
    </p>

    <div v-if="store.isLoading" class="text-center py-8">Betöltés...</div>

    <div v-else-if="store.globalTypes.length === 0" class="text-gray-500 text-sm">
      Még nincs hivatalos speciális tipp típus.
    </div>

    <div v-else class="space-y-4">
      <article
        v-for="gt in activeTypes"
        :key="gt.id"
        class="border rounded-lg p-4 bg-white"
        data-testid="tournament-evaluation-type"
        :data-type-id="gt.id"
      >
        <header class="mb-3">
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="font-semibold text-gray-800">{{ gt.name }}</h2>
            <span class="text-xs text-gray-500">· {{ inputTypeLabel(gt.inputType) }}</span>
            <span class="text-xs text-gray-500">· {{ gt.points }} pont</span>
            <span v-if="gt.correctAnswer" class="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700">
              Helyes válasz beírva
            </span>
            <span v-else class="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
              Nincs helyes válasz
            </span>
          </div>
          <p v-if="gt.description" class="text-xs text-gray-500 mt-1">{{ gt.description }}</p>
        </header>

        <!-- Simple types: text / dropdown -->
        <div v-if="gt.inputType === 'text' || gt.inputType === 'dropdown'" class="space-y-2">
          <label class="block text-xs font-medium text-gray-700">Helyes válasz</label>
          <select
            v-if="gt.inputType === 'dropdown' && Array.isArray(gt.options)"
            v-model="answerDrafts[gt.id]"
            class="w-full border rounded px-2 py-1.5 text-sm"
          >
            <option value="" disabled>Válassz...</option>
            <option v-for="opt in gt.options" :key="opt" :value="opt">{{ opt }}</option>
          </select>
          <input
            v-else
            v-model="answerDrafts[gt.id]"
            type="text"
            class="w-full border rounded px-2 py-1.5 text-sm"
            placeholder="..."
          />
          <div class="flex gap-2 flex-wrap">
            <button
              class="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              :disabled="busy[gt.id]"
              @click="onSaveAndEvaluate(gt, null)"
            >
              Mentés és kiértékelés
            </button>
            <span v-if="lastRunFor(gt.id, null)" class="text-xs text-gray-500 self-center">
              Legutóbb: {{ formatLastRun(lastRunFor(gt.id, null)!) }}
            </span>
          </div>
        </div>

        <!-- team_select: searchable team dropdown -->
        <div v-else-if="gt.inputType === 'team_select'" class="space-y-2">
          <label class="block text-xs font-medium text-gray-700">Helyes csapat</label>
          <TeamSelectDropdown
            :model-value="answerDrafts[gt.id] || null"
            @update:model-value="v => answerDrafts[gt.id] = v ?? ''"
          />
          <div class="flex gap-2 flex-wrap">
            <button
              class="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              :disabled="busy[gt.id]"
              @click="onSaveAndEvaluate(gt, null)"
            >
              Mentés és kiértékelés
            </button>
            <span v-if="lastRunFor(gt.id, null)" class="text-xs text-gray-500 self-center">
              Legutóbb: {{ formatLastRun(lastRunFor(gt.id, null)!) }}
            </span>
          </div>
        </div>

        <!-- player_select: searchable player dropdown -->
        <div v-else-if="gt.inputType === 'player_select'" class="space-y-2">
          <label class="block text-xs font-medium text-gray-700">Helyes játékos</label>
          <PlayerSelectCombobox
            :model-value="answerDrafts[gt.id] || null"
            :show-player-meta="true"
            @update:model-value="v => answerDrafts[gt.id] = v ?? ''"
          />
          <div class="flex gap-2 flex-wrap">
            <button
              class="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              :disabled="busy[gt.id]"
              @click="onSaveAndEvaluate(gt, null)"
            >
              Mentés és kiértékelés
            </button>
            <span v-if="lastRunFor(gt.id, null)" class="text-xs text-gray-500 self-center">
              Legutóbb: {{ formatLastRun(lastRunFor(gt.id, null)!) }}
            </span>
          </div>
        </div>

        <!-- multi_team_weighted (Upset) — auto-derived from bracket -->
        <div v-else-if="gt.inputType === 'multi_team_weighted'" class="space-y-2">
          <p class="text-xs text-gray-600">
            A kiesett csapatok automatikusan származtatódnak a Bracket-progresszió helyes válaszából
            (32-be jutók halmazából). Itt nem kell külön választ beírni.
          </p>
          <p v-if="upsetMissingPrereqs.length > 0" class="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
            Előfeltétel hiányzik: {{ upsetMissingPrereqs.join(' és ') }} helyes válasza még nincs rögzítve.
          </p>
          <div class="flex gap-2 flex-wrap">
            <button
              class="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              :disabled="busy[gt.id] || upsetMissingPrereqs.length > 0"
              @click="onEvaluateOnly(gt, null)"
            >
              Kiértékelés (auto-derive)
            </button>
            <span v-if="lastRunFor(gt.id, null)" class="text-xs text-gray-500 self-center">
              Legutóbb: {{ formatLastRun(lastRunFor(gt.id, null)!) }}
            </span>
          </div>
        </div>

        <!-- all_groups_standing: per-group slice buttons -->
        <div v-else-if="gt.inputType === 'all_groups_standing' && isAllGroupsStandingOptions(gt.options)" class="space-y-3">
          <GroupStandingsPicker
            :options="gt.options"
            :answer="answerDrafts[gt.id] || null"
            @submit="v => onPickerSubmit(gt, v)"
          />
          <div class="flex flex-wrap gap-2 pt-2 border-t">
            <span class="text-xs text-gray-600 self-center mr-2">Kiértékelés szeletenként:</span>
            <button
              v-for="code in gt.options.groups"
              :key="code"
              class="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
              :disabled="busy[gt.id]"
              @click="onSaveAndEvaluate(gt, `group_${code}`)"
            >
              {{ code }} csoport
            </button>
            <button
              class="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              :disabled="busy[gt.id]"
              @click="onSaveAndEvaluate(gt, null)"
            >
              Mind kiértékelése
            </button>
          </div>
        </div>

        <!-- bracket_progression: per-round slice buttons -->
        <div v-else-if="gt.inputType === 'bracket_progression' && isBracketProgressionOptions(gt.options)" class="space-y-3">
          <BracketProgressionPicker
            :options="gt.options"
            :answer="answerDrafts[gt.id] || null"
            :group-standings-answer="bracketGroupStandings"
            @submit="v => onPickerSubmit(gt, v)"
          />
          <div class="flex flex-wrap gap-2 pt-2 border-t">
            <span class="text-xs text-gray-600 self-center mr-2">Kiértékelés körönként:</span>
            <button
              v-for="round in BRACKET_ROUNDS"
              :key="round"
              class="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 disabled:opacity-50"
              :disabled="busy[gt.id]"
              @click="onSaveAndEvaluate(gt, round)"
            >
              {{ roundLabel(round) }}
            </button>
            <button
              class="text-xs px-2 py-1 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
              :disabled="busy[gt.id]"
              @click="onSaveAndEvaluate(gt, null)"
            >
              Mind kiértékelése
            </button>
          </div>
        </div>

        <div v-else class="text-xs text-amber-700">
          Nem támogatott típus: <code>{{ gt.inputType }}</code>
        </div>
      </article>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import AdminNav from '../components/admin/AdminNav.vue'
import GroupStandingsPicker from '../components/predictions/GroupStandingsPicker.vue'
import BracketProgressionPicker from '../components/predictions/BracketProgressionPicker.vue'
import TeamSelectDropdown from '../components/predictions/TeamSelectDropdown.vue'
import PlayerSelectCombobox from '../components/predictions/PlayerSelectCombobox.vue'
import { useAdminTournamentEvaluationStore, type EvaluationRunResult } from '../stores/admin-tournament-evaluation.store.js'
import { useToastStore } from '../stores/toast.store.js'
import type {
  AllGroupsStandingAnswer,
  AllGroupsStandingOptions,
  BracketProgressionOptions,
  SpecialPredictionOptions,
  SpecialPredictionType,
} from '../types/index.js'

const BRACKET_ROUNDS = ['last_32', 'last_16', 'qf', 'sf', 'final', 'bronze'] as const

const store = useAdminTournamentEvaluationStore()
const toast = useToastStore()

const answerDrafts = reactive<Record<string, string>>({})
const busy = reactive<Record<string, boolean>>({})

const activeTypes = computed(() => store.globalTypes.filter(t => t.isActive))

const bracketGroupStandings = computed<AllGroupsStandingAnswer | null>(() => {
  const groupType = store.globalTypes.find(t => t.inputType === 'all_groups_standing' && t.isActive)
  if (!groupType?.correctAnswer) return null
  try {
    const parsed = JSON.parse(groupType.correctAnswer) as AllGroupsStandingAnswer
    if (parsed && typeof parsed === 'object' && parsed.groups) return parsed
  } catch {
    // ignore
  }
  return null
})

/**
 * Names of upstream types whose `correctAnswer` is required before multi_team_weighted
 * (Biztos kieső) can derive its eliminated set. The eliminated halmaz a bracket template
 * + group-standings (incl. best3rds) párosából resolveolódik — a bracket winners map-je
 * nem szükséges hozzá, csak a csoport-végeredmény legyen rögzítve.
 */
const upsetMissingPrereqs = computed<string[]>(() => {
  const missing: string[] = []
  const groupType = store.globalTypes.find(t => t.inputType === 'all_groups_standing' && t.isActive)
  if (!groupType?.correctAnswer || groupType.correctAnswer.trim().length === 0) {
    missing.push('Csoport végeredmény')
  } else {
    // Best3rds must be present so 3rd_ bracket slots resolve.
    try {
      const parsed = JSON.parse(groupType.correctAnswer) as AllGroupsStandingAnswer
      if (!parsed || !Array.isArray(parsed.best3rds) || parsed.best3rds.length < 8) {
        missing.push('Csoport végeredmény (8 best 3rd csapat)')
      }
    } catch {
      missing.push('Csoport végeredmény (érvénytelen JSON)')
    }
  }
  return missing
})

function isAllGroupsStandingOptions(options: SpecialPredictionOptions): options is AllGroupsStandingOptions {
  return options !== null && !Array.isArray(options) && Array.isArray((options as AllGroupsStandingOptions).groups)
}

async function onEvaluateOnly(gt: SpecialPredictionType, slice: string | null): Promise<void> {
  busy[gt.id] = true
  try {
    const result = await store.evaluate(gt.id, slice)
    const sliceLabel = slice ? ` (${slice})` : ''
    toast.addToast(
      `${gt.name}${sliceLabel}: ${result.evaluatedCount} felhasználó · ${result.totalPoints} pont`,
      'success',
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hiba'
    toast.addToast(`Hiba: ${msg}`, 'error')
  } finally {
    busy[gt.id] = false
  }
}

function inputTypeLabel(t: string): string {
  switch (t) {
    case 'text': return 'Szabad szöveg'
    case 'dropdown': return 'Legördülő'
    case 'team_select': return 'Csapatválasztó'
    case 'player_select': return 'Játékosválasztó'
    case 'multi_team_weighted': return 'Kiesett favoritok'
    case 'all_groups_standing': return 'Csoport végeredmény'
    case 'bracket_progression': return 'Bracket-progresszió'
    default: return t
  }
}

function roundLabel(r: typeof BRACKET_ROUNDS[number]): string {
  switch (r) {
    case 'last_32': return '32-be jutók'
    case 'last_16': return '16-ba jutók'
    case 'qf': return 'Negyeddöntő'
    case 'sf': return 'Elődöntő'
    case 'final': return 'Döntő'
    case 'bronze': return 'Bronzmeccs'
  }
}

function isBracketProgressionOptions(options: SpecialPredictionOptions): options is BracketProgressionOptions {
  return options !== null && !Array.isArray(options)
    && typeof (options as BracketProgressionOptions).bracketTemplate === 'object'
    && Array.isArray((options as BracketProgressionOptions).bracketTemplate?.matches)
}

function lastRunFor(typeId: string, slice: string | null): EvaluationRunResult | null {
  return store.lastRunBySliceKey[store.sliceKey(typeId, slice)] ?? null
}

function formatLastRun(r: EvaluationRunResult): string {
  const ts = new Date(r.lastRunAt).toLocaleTimeString('hu-HU', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  return `${ts} · ${r.evaluatedCount} felhasználó · ${r.totalPoints} pont`
}

function onPickerSubmit(gt: SpecialPredictionType, value: string): void {
  answerDrafts[gt.id] = value
}

async function onSaveAndEvaluate(gt: SpecialPredictionType, slice: string | null): Promise<void> {
  const draft = (answerDrafts[gt.id] ?? gt.correctAnswer ?? '').trim()
  if (!draft) {
    toast.addToast('Először add meg a helyes választ', 'error')
    return
  }
  busy[gt.id] = true
  try {
    if (draft !== (gt.correctAnswer ?? '')) {
      await store.setCorrectAnswer(gt.id, draft)
    }
    const result = await store.evaluate(gt.id, slice)
    const sliceLabel = slice ? ` (${slice})` : ''
    toast.addToast(
      `${gt.name}${sliceLabel}: ${result.evaluatedCount} felhasználó · ${result.totalPoints} pont`,
      'success',
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Hiba'
    toast.addToast(`Hiba: ${msg}`, 'error')
  } finally {
    busy[gt.id] = false
  }
}

onMounted(async () => {
  await store.fetchGlobalTypes()
  // Pre-fill drafts from the stored correctAnswer so the picker shows the persisted state.
  for (const t of store.globalTypes) {
    if (t.correctAnswer) answerDrafts[t.id] = t.correctAnswer
  }
})
</script>
