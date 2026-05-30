<template>
  <div data-testid="best-3rd-picker">
    <header class="flex items-center justify-between mb-2">
      <h3 class="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
        <span>🏆</span>
        <span>{{ $t('groupStandings.best3rdTitle') }}</span>
      </h3>
      <span
        class="text-xs font-semibold px-2 py-0.5 rounded-full"
        :class="selected.length === maxPicks ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-600'"
        data-testid="best-3rd-counter"
      >
        {{ selected.length }} / {{ maxPicks }}
      </span>
    </header>

    <div
      v-if="!unlocked"
      class="rounded-lg p-4 text-center bg-slate-100 border-2 border-dashed border-slate-300"
      data-testid="best-3rd-locked"
    >
      <div class="text-2xl mb-1" aria-hidden="true">🔒</div>
      <p class="font-semibold text-slate-600 text-sm">{{ $t('groupStandings.best3rdTitle') }}</p>
      <p class="text-xs text-slate-500 mt-1">{{ $t('groupStandings.best3rdLocked') }}</p>
    </div>

    <div v-else>
      <p class="text-xs text-slate-600 mb-3">
        {{ $t('groupStandings.best3rdInstruction', { n: maxPicks }) }}
      </p>
      <div class="grid grid-cols-3 gap-2">
        <button
          v-for="teamId in availableTeams"
          :key="teamId"
          type="button"
          class="rounded-lg p-2 flex flex-col items-center gap-1 relative transition-colors"
          :class="chipClass(teamId)"
          :data-testid="`best-3rd-chip-${teamId}`"
          @click="toggle(teamId)"
        >
          <span
            v-if="isSelected(teamId)"
            class="absolute top-1 right-1 text-blue-600 text-xs"
            aria-hidden="true"
          >✓</span>
          <img
            v-if="teamMap.get(teamId)?.flagUrl"
            :src="teamMap.get(teamId)!.flagUrl ?? ''"
            :alt="teamMap.get(teamId)?.name ?? ''"
            class="w-8 h-6 object-cover rounded-sm shadow-sm"
          />
          <span
            class="text-xs font-bold"
            :class="isSelected(teamId) ? 'text-blue-900' : 'text-slate-700'"
          >{{ teamMap.get(teamId)?.shortCode ?? '—' }}</span>
          <span class="text-[10px] text-slate-500">{{ groupLabel(teamId) }}</span>
        </button>
      </div>

      <div
        v-if="remaining > 0"
        class="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900 flex gap-2"
      >
        <span aria-hidden="true">💡</span>
        <span>{{ $t('groupStandings.best3rdRemaining', { n: remaining }) }}</span>
      </div>

      <p v-if="availableTeams.length === 0" class="text-xs text-slate-500 italic mt-2">
        {{ $t('groupStandings.best3rdEmpty') }}
      </p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { Team } from '../../types/index.js'

const props = defineProps<{
  unlocked: boolean
  availableTeams: readonly string[]
  selected: readonly string[]
  maxPicks: number
  teamMap: ReadonlyMap<string, Team>
}>()

const emit = defineEmits<{
  'toggle': [teamId: string]
  'overflow': []
}>()

const { t } = useI18n()

const remaining = computed(() => Math.max(0, props.maxPicks - props.selected.length))

function isSelected(teamId: string): boolean {
  return props.selected.includes(teamId)
}

function chipClass(teamId: string): string {
  const picked = isSelected(teamId)
  if (picked) return 'border-2 border-blue-500 bg-blue-50'
  if (!picked && props.selected.length >= props.maxPicks) {
    return 'border border-slate-200 bg-white opacity-50 cursor-not-allowed'
  }
  return 'border border-slate-200 bg-white hover:border-blue-300'
}

function groupLabel(teamId: string): string {
  const code = props.teamMap.get(teamId)?.group
  return code ? t('groupStandings.best3rdGroupLabel', { code }) : ''
}

function toggle(teamId: string): void {
  if (!isSelected(teamId) && props.selected.length >= props.maxPicks) {
    emit('overflow')
    return
  }
  emit('toggle', teamId)
}
</script>
