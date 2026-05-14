<template>
  <div class="inline-flex gap-0 bg-gray-100 border border-gray-200 rounded-lg p-0.5">
    <button
      v-for="option in options"
      :key="option.value ?? '__null__'"
      class="px-3 py-1.5 text-sm font-medium rounded-md transition-all duration-150 whitespace-nowrap"
      :class="modelValue === option.value
        ? 'bg-white text-gray-900 font-semibold shadow-sm'
        : 'text-gray-500 hover:text-gray-700'"
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
