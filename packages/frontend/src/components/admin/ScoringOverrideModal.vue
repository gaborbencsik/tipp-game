<template>
  <div
    class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
    data-testid="override-modal"
    @click.self="$emit('cancel')"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
      <h2 class="text-xl font-bold mb-2">{{ title }}</h2>
      <p class="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 mb-4">
        {{ warning }}
      </p>

      <div v-if="affectedMatches !== undefined" class="text-sm text-gray-600 mb-4">
        <span class="font-semibold">{{ affectedMatches }}</span> mérkőzést és
        <span class="font-semibold">{{ affectedPredictions }}</span> tippet érint.
      </div>

      <label class="block mb-3">
        <span class="text-sm font-medium">Indok *</span>
        <select
          v-model="reason"
          data-testid="override-reason"
          class="mt-1 w-full border rounded px-2 py-1.5"
        >
          <option value="">— Válassz —</option>
          <option value="bug_fix">Hiba javítása</option>
          <option value="rule_change">Szabályváltozás</option>
          <option value="data_correction">Adatkorrekció</option>
          <option value="other">Egyéb</option>
        </select>
      </label>

      <label class="block mb-3">
        <span class="text-sm font-medium">Megjegyzés</span>
        <textarea
          v-model="comment"
          data-testid="override-comment"
          rows="3"
          class="mt-1 w-full border rounded px-2 py-1.5"
        />
      </label>

      <label class="flex items-center gap-2 mb-4">
        <input
          v-model="recalculate"
          data-testid="override-recalc"
          type="checkbox"
        />
        <span class="text-sm">Pontok újraszámolása mentés után</span>
      </label>

      <div class="flex justify-end gap-2 pt-4 border-t">
        <button
          type="button"
          data-testid="override-cancel"
          class="px-4 py-2 rounded border bg-gray-100 hover:bg-gray-200"
          @click="$emit('cancel')"
        >
          Mégse
        </button>
        <button
          type="button"
          data-testid="override-confirm"
          class="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
          :disabled="!reason"
          @click="confirm"
        >
          Felülírás
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  title: string
  warning: string
  affectedMatches?: number
  affectedPredictions?: number
}>()

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'confirm', payload: { reason: string; comment: string; recalculate: boolean }): void
}>()

const reason = ref('')
const comment = ref('')
const recalculate = ref(true)

function confirm(): void {
  if (!reason.value) return
  emit('confirm', { reason: reason.value, comment: comment.value, recalculate: recalculate.value })
}
</script>
