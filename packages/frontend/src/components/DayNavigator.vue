<template>
  <div class="flex items-center gap-2">
    <button
      data-testid="day-nav-prev"
      :disabled="!canGoPrev"
      class="w-7 h-7 flex items-center justify-center rounded transition-colors"
      :class="canGoPrev ? 'hover:bg-gray-200 text-gray-600' : 'opacity-30 cursor-not-allowed text-gray-400'"
      @click="canGoPrev && $emit('prev')"
    >
      ◀
    </button>
    <span
      v-if="!isShowingAll"
      data-testid="day-nav-label"
      class="text-sm font-medium text-gray-700 min-w-[5rem] text-center"
    >
      {{ dateLabel }}
    </span>
    <button
      data-testid="day-nav-next"
      :disabled="!canGoNext"
      class="w-7 h-7 flex items-center justify-center rounded transition-colors"
      :class="canGoNext ? 'hover:bg-gray-200 text-gray-600' : 'opacity-30 cursor-not-allowed text-gray-400'"
      @click="canGoNext && $emit('next')"
    >
      ▶
    </button>
    <button
      data-testid="day-nav-all"
      class="px-2 py-0.5 text-xs rounded transition-colors ml-1"
      :class="isShowingAll ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'"
      @click="$emit('showAll')"
    >
      Mind
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  dateLabel: string
  canGoPrev: boolean
  canGoNext: boolean
  isShowingAll: boolean
}>()

defineEmits<{
  prev: []
  next: []
  showAll: []
}>()
</script>
