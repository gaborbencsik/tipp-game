<template>
  <div
    class="fixed inset-0 bg-black/40 flex items-center justify-center z-50"
    role="dialog"
    aria-modal="true"
    aria-label="Adományozás"
    data-testid="donation-modal"
    @click.self="$emit('close')"
  >
    <div class="bg-white rounded-xl p-6 shadow-xl max-w-sm w-full mx-4">
      <h2 class="text-lg font-bold text-gray-900 mb-2">Tetszik a játék? 🍺</h2>

      <p class="text-sm text-gray-600 mb-5">
        Ezt a tippjátékot hobbiból, a közösség öröméért készítem. Ha neked is örömet okoz, egy kisebb támogatással te is hozzájárulhatsz a működéséhez.
      </p>

      <div v-if="amounts.length > 0" class="flex gap-2 mb-3">
        <a
          v-for="(item, i) in amounts"
          :key="item.url"
          :href="item.url"
          target="_blank"
          rel="noopener noreferrer"
          :class="[
            'flex-1 text-center px-2 py-2 text-sm rounded-lg border transition-colors',
            i === 1
              ? 'bg-amber-500 text-white border-amber-500 font-semibold hover:bg-amber-600'
              : 'border-gray-300 text-gray-700 hover:bg-gray-50'
          ]"
          :aria-label="`Támogatás ${item.amount}`"
          :data-testid="`donation-amount-${i}`"
        >
          {{ item.label }}
        </a>
      </div>

      <div v-if="openAmountUrl" class="mb-4 text-center">
        <a
          :href="openAmountUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-sm text-amber-600 hover:underline"
          data-testid="donation-open-amount"
        >
          Egyéni összeg →
        </a>
      </div>

      <div class="text-center">
        <button
          class="text-sm text-gray-400 hover:text-gray-600 transition-colors"
          data-testid="donation-dismiss"
          @click="$emit('close')"
        >
          Majd máskor
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import type { DonationAmount } from '../composables/useDonationConfig.js'

defineProps<{
  amounts: readonly DonationAmount[]
  openAmountUrl?: string
}>()

const emit = defineEmits<{ close: [] }>()

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') emit('close')
}

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => document.removeEventListener('keydown', onKeydown))
</script>
