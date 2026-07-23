<template>
  <RouterView />
  <ToastContainer />
  <ScoringExplainerModal v-if="isScoringRulesEnabled" />
</template>

<script setup lang="ts">
import ToastContainer from './components/ToastContainer.vue'
import ScoringExplainerModal from './components/ScoringExplainerModal.vue'
import { useScoringRulesConfig } from './composables/useScoringRulesConfig.js'

const { isScoringRulesEnabled } = useScoringRulesConfig()
</script>
