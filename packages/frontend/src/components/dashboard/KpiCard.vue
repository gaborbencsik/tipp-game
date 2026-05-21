<template>
  <div class="bg-white border border-gray-200 rounded-xl shadow-sm p-4 flex flex-col gap-1">
    <div v-if="icon" class="text-2xl leading-none" aria-hidden="true">{{ icon }}</div>
    <div class="text-xs uppercase tracking-wide text-gray-500 font-medium">{{ label }}</div>
    <div class="flex items-baseline gap-2">
      <span class="text-2xl font-bold" :class="valueColorClass">{{ value }}</span>
      <span v-if="suffix" class="text-sm text-gray-400 font-medium">{{ suffix }}</span>
    </div>
    <div v-if="hint" class="text-xs text-gray-400 mt-0.5">{{ hint }}</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  label: string
  value: string | number
  suffix?: string
  hint?: string
  icon?: string
  tone?: 'default' | 'positive' | 'negative' | 'neutral'
}

const props = withDefaults(defineProps<Props>(), { tone: 'default' })

const valueColorClass = computed(() => {
  switch (props.tone) {
    case 'positive': return 'text-green-600'
    case 'negative': return 'text-red-600'
    case 'neutral': return 'text-gray-700'
    default: return 'text-blue-600'
  }
})
</script>
