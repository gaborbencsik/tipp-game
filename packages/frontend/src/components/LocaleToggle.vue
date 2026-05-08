<template>
  <div class="flex items-center gap-1 text-sm">
    <button
      v-for="loc in locales"
      :key="loc"
      :class="loc === currentLocale ? 'font-semibold text-gray-900' : 'text-gray-500 hover:text-gray-800'"
      :data-testid="`locale-toggle-${loc}`"
      @click="setLocale(loc)"
    >
      {{ loc.toUpperCase() }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { locale } = useI18n()
const locales = ['hu', 'en'] as const

const currentLocale = computed(() => locale.value)

function setLocale(loc: string): void {
  locale.value = loc
  localStorage.setItem('locale', loc)
}
</script>
