<template>
  <button
    v-if="config.isConfigured"
    class="flex items-center gap-3 py-2 rounded-full text-sm text-amber-700 hover:bg-amber-50 transition-colors mt-auto"
    :class="sidebarOpen ? 'px-4' : 'px-3 justify-center'"
    :title="!sidebarOpen ? $t('donation.buttonLabel') : undefined"
    :aria-label="$t('donation.buttonAria')"
    data-testid="donation-btn"
    @click="showModal = true"
  >
    <span class="shrink-0 text-base">🍺</span>
    <span v-if="sidebarOpen" class="whitespace-nowrap">{{ $t('donation.buttonLabel') }}</span>
  </button>

  <DonationModal
    v-if="showModal"
    :amounts="config.amounts"
    :open-amount-url="config.openAmountUrl"
    @close="showModal = false"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useDonationConfig } from '../composables/useDonationConfig.js'
import DonationModal from './DonationModal.vue'

defineProps<{ sidebarOpen: boolean }>()

const config = useDonationConfig()
const showModal = ref(false)
</script>
