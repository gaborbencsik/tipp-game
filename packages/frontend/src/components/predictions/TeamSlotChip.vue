<template>
  <div
    class="relative flex flex-col gap-0.5 rounded-lg px-2.5 py-2 text-left transition-colors min-w-0 border"
    :class="rootClass"
    :data-testid="`team-slot-${slotCode}`"
  >
    <span class="text-[10px] font-medium uppercase tracking-wide truncate" :class="slotIdClass">
      {{ slotLabel }}
    </span>
    <span class="text-[13px] font-semibold leading-tight flex items-center gap-1.5 truncate" :class="nameClass">
      <template v-if="team">
        <img
          v-if="team.flagUrl"
          :src="team.flagUrl"
          :alt="team.name"
          class="w-5 h-3.5 object-cover rounded-sm flex-shrink-0"
        />
        <span class="truncate">{{ team.shortCode }}</span>
      </template>
      <span v-else class="italic truncate">⏳ {{ $t('bracketProgression.waiting', { slot: slotLabel }) }}</span>
    </span>
    <span
      v-if="isPicked && !isCorrect && !isWrong"
      class="absolute -top-1.5 -right-1.5 w-[18px] h-[18px] rounded-full bg-emerald-500 text-white text-[11px] font-bold flex items-center justify-center border-2 border-white"
      aria-hidden="true"
    >✓</span>
    <span
      v-if="isCorrect"
      class="absolute -top-1.5 -right-1.5 text-emerald-700 text-[11px] font-bold"
      aria-hidden="true"
    >✓✓</span>
    <span
      v-if="isActual"
      class="absolute -top-2 left-2 bg-emerald-600 text-white text-[9px] font-semibold px-1.5 py-[1px] rounded"
    >{{ $t('bracketProgression.actualWinner') }}</span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Team } from '../../types/index.js'

const props = defineProps<{
  slotCode: string
  team: Team | null
  isPicked: boolean
  isLocked: boolean
  isCorrect?: boolean
  isWrong?: boolean
  isActual?: boolean
}>()

const slotLabel = computed(() => props.slotCode)

const rootClass = computed(() => {
  if (props.isCorrect) return 'border-2 border-emerald-500 bg-emerald-50'
  if (props.isWrong) return 'border-2 border-red-500 bg-red-50'
  if (props.isActual) return 'border-2 border-dashed border-emerald-500 bg-white'
  if (props.isPicked) return 'border-2 border-blue-500 bg-blue-500 shadow-md shadow-blue-500/30'
  if (props.isLocked) return 'border-dashed border-slate-400 bg-slate-100 cursor-not-allowed'
  return 'border-slate-300 bg-white hover:border-blue-300 hover:bg-blue-50'
})

const slotIdClass = computed(() => {
  if (props.isPicked && !props.isCorrect && !props.isWrong && !props.isActual) return 'text-white/70'
  return 'text-slate-400'
})

const nameClass = computed(() => {
  if (props.isCorrect) return 'text-emerald-900'
  if (props.isWrong) return 'text-red-900'
  if (props.isActual) return 'text-emerald-900'
  if (props.isPicked) return 'text-white'
  if (props.isLocked) return 'text-slate-400 italic'
  return 'text-slate-800'
})
</script>
