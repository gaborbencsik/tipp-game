<template>
  <div
    class="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold border transition-colors min-w-0 flex-1"
    :class="rootClass"
    :data-testid="`team-slot-${slotCode}`"
  >
    <span v-if="team" class="truncate">{{ team.shortCode }}</span>
    <span v-else class="text-gray-400 italic truncate">⏳ {{ slotCode }}</span>
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

const rootClass = computed(() => {
  if (props.isCorrect) return 'bg-green-100 text-green-800 border-green-300'
  if (props.isWrong) return 'bg-red-100 text-red-800 border-red-300'
  if (props.isActual) return 'bg-green-50 text-green-700 border-dashed border-green-300'
  if (props.isPicked) return 'bg-blue-600 text-white border-blue-700 shadow-sm'
  if (props.isLocked) return 'bg-gray-50 text-gray-400 border-gray-200'
  return 'bg-white text-gray-800 border-gray-200 hover:bg-gray-50'
})
</script>
