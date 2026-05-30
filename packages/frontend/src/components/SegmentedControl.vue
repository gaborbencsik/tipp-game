<template>
  <div class="flex gap-2 overflow-x-auto px-1 py-1 -mx-1" role="tablist">
    <button
      v-for="option in options"
      :key="option.value ?? '__null__'"
      type="button"
      role="tab"
      :aria-selected="modelValue === option.value"
      class="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
      :class="modelValue === option.value
        ? 'bg-blue-50 ring-2 ring-blue-300 text-blue-700'
        : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-200'"
      @click="$emit('update:modelValue', option.value)"
    >
      {{ option.label }}
    </button>
  </div>
</template>

<script setup lang="ts">
export interface SegmentOption {
  label: string
  value: string | null
}

defineProps<{
  options: SegmentOption[]
  modelValue: string | null
}>()

defineEmits<{
  'update:modelValue': [value: string | null]
}>()
</script>
