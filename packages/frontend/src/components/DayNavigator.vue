<template>
  <div class="flex items-center gap-2 flex-nowrap">
    <button
      data-testid="day-nav-prev"
      :disabled="!canGoPrev"
      class="w-7 h-7 flex items-center justify-center rounded transition-colors shrink-0"
      :class="canGoPrev ? 'hover:bg-gray-200 text-gray-600' : 'opacity-30 cursor-not-allowed text-gray-400'"
      @click="canGoPrev && $emit('prev')"
    >
      ◀
    </button>
    <span
      v-if="!isShowingAll"
      data-testid="day-nav-label"
      class="text-sm font-medium text-gray-700 min-w-[5rem] text-center whitespace-nowrap"
    >
      {{ dateLabel }}
    </span>
    <button
      data-testid="day-nav-next"
      :disabled="!canGoNext"
      class="w-7 h-7 flex items-center justify-center rounded transition-colors shrink-0"
      :class="canGoNext ? 'hover:bg-gray-200 text-gray-600' : 'opacity-30 cursor-not-allowed text-gray-400'"
      @click="canGoNext && $emit('next')"
    >
      ▶
    </button>
    <button
      data-testid="day-nav-all"
      class="px-2 py-0.5 text-xs rounded transition-colors ml-1 inline-flex items-center gap-1 whitespace-nowrap shrink-0"
      :class="isShowingAll ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'"
      @click="$emit('showAll')"
    >
      <svg v-if="isShowingAll" class="w-3 h-3" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
      </svg>
      <svg v-else class="w-3 h-3" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect x="3" y="3" width="14" height="14" rx="2"/>
      </svg>
      {{ $t('matches.showAllMatches') }}
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
