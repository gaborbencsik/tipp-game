<template>
  <div
    class="bg-amber-50 border-2 border-amber-300 rounded-2xl p-6 text-center"
    data-testid="bracket-progression-gate"
  >
    <div class="text-4xl mb-3" aria-hidden="true">🔒</div>
    <h2 class="text-base font-bold text-slate-800 mb-2 leading-snug">
      {{ $t('bracketProgression.gateTitle') }}
    </h2>
    <p class="text-sm text-slate-600 mb-4 leading-relaxed">
      {{ $t('bracketProgression.gateBody') }}
    </p>
    <button
      type="button"
      class="w-full bg-blue-600 text-white font-semibold rounded-lg px-4 py-3 text-sm hover:bg-blue-700 shadow-sm"
      data-testid="bracket-progression-gate-cta"
      @click="$emit('open-group-standings')"
    >
      {{ $t('bracketProgression.gateCta') }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineEmits<{
  'open-group-standings': []
}>()
</script>
