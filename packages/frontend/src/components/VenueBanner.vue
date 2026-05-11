<template>
  <div
    v-if="venue"
    class="relative w-full rounded-lg overflow-hidden h-[200px] sm:h-[240px] lg:h-[280px] cursor-pointer mb-8"
    role="img"
    :aria-label="`${venue.name}, ${venue.city}`"
    data-testid="venue-banner"
    @click="openLightbox"
  >
    <div class="absolute inset-0 bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900" />
    <img
      v-if="venue.imageUrl && !imageError"
      :src="venue.imageUrl"
      :alt="`${venue.name}, ${venue.city}`"
      class="absolute inset-0 w-full h-full object-cover object-center transition-opacity duration-300"
      :class="imageLoaded ? 'opacity-100' : 'opacity-0'"
      loading="eager"
      fetchpriority="high"
      @load="onImageLoad"
      @error="onImageError"
    />
    <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
    <div class="absolute top-2 right-2 bg-black/40 backdrop-blur-sm rounded p-1.5 text-white/70 hover:bg-black/60 hover:text-white transition-colors pointer-events-none" data-testid="expand-icon">
      <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9m11.25-5.25v4.5m0-4.5h-4.5m4.5 0L15 9m-11.25 11.25v-4.5m0 4.5h4.5m-4.5 0L9 15m11.25 5.25v-4.5m0 4.5h-4.5m4.5 0L15 15" />
      </svg>
    </div>
    <div class="absolute bottom-0 left-0 p-3 sm:p-4 lg:p-6 flex flex-col gap-0.5">
      <span class="text-white font-semibold text-sm sm:text-base lg:text-lg" data-testid="venue-name">
        {{ venue.name }}
      </span>
      <span class="text-white/70 text-xs sm:text-sm" data-testid="venue-city">
        {{ venue.city }}
      </span>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="lightboxOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
      data-testid="venue-lightbox"
      @click="closeLightbox"
    >
      <div class="relative max-w-[90vw] max-h-[85vh]">
        <img
          v-if="venue?.imageUrl"
          :src="venue.imageUrl"
          :alt="`${venue.name}, ${venue.city}`"
          class="max-w-full max-h-[85vh] rounded-lg object-contain"
        />
        <div class="absolute bottom-0 left-0 right-0 p-4 text-center">
          <span class="text-white font-semibold text-base">{{ venue?.name }}</span>
          <span class="text-white/70 text-sm ml-2">{{ venue?.city }}</span>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { MatchVenue } from '../types/index.js'

defineProps<{ venue: MatchVenue | null }>()

const imageLoaded = ref(false)
const imageError = ref(false)
const lightboxOpen = ref(false)

function onImageLoad(): void {
  imageLoaded.value = true
}

function onImageError(): void {
  imageError.value = true
}

function openLightbox(): void {
  lightboxOpen.value = true
}

function closeLightbox(): void {
  lightboxOpen.value = false
}
</script>
