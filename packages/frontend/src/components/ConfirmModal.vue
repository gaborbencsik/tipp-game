<template>
  <div
    class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
    role="dialog"
    aria-modal="true"
    :aria-label="title"
    data-testid="confirm-modal"
    @click.self="$emit('cancel')"
    @keydown.esc="$emit('cancel')"
  >
    <div class="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
      <h2 class="text-lg font-bold text-gray-900 mb-2">{{ title }}</h2>
      <p class="text-sm text-gray-600 mb-5">{{ body }}</p>

      <div class="flex justify-end gap-2">
        <button
          ref="cancelBtnRef"
          type="button"
          data-testid="confirm-modal-cancel"
          class="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
          @click="$emit('cancel')"
        >
          {{ cancelLabel || $t('common.cancel') }}
        </button>
        <button
          type="button"
          data-testid="confirm-modal-confirm"
          :class="[
            'px-4 py-2 text-sm rounded-lg font-semibold transition-colors',
            variant === 'danger'
              ? 'bg-red-600 text-white hover:bg-red-700'
              : 'bg-blue-600 text-white hover:bg-blue-700',
          ]"
          @click="$emit('confirm')"
        >
          {{ confirmLabel }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'

defineProps<{
  title: string
  body: string
  confirmLabel: string
  cancelLabel?: string
  variant?: 'default' | 'danger'
}>()

defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const cancelBtnRef = ref<HTMLButtonElement | null>(null)

onMounted(async () => {
  await nextTick()
  cancelBtnRef.value?.focus()
})
</script>
