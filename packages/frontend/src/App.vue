<template>
  <RouterView />
  <ToastContainer />
  <ScoringExplainerModal />
</template>

<script setup lang="ts">
import ToastContainer from './components/ToastContainer.vue'
import ScoringExplainerModal from './components/ScoringExplainerModal.vue'
</script>
