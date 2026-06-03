<template>
  <AppLayout>
    <h1 class="text-2xl font-bold text-gray-900 mb-2">{{ $t('install.title') }}</h1>
    <p class="text-sm text-gray-500 mb-6">{{ $t('install.subtitle') }}</p>

    <!-- Already installed -->
    <div
      v-if="isStandalone"
      data-testid="install-already"
      class="bg-green-50 border border-green-200 rounded p-4 mb-6 flex items-start gap-3"
    >
      <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0 mt-0.5 text-green-600" viewBox="0 0 20 20" fill="currentColor">
        <path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z" clip-rule="evenodd" />
      </svg>
      <div>
        <p class="text-sm font-semibold text-green-800">{{ $t('install.installed.title') }}</p>
        <p class="text-xs text-green-700 mt-1">{{ $t('install.installed.description') }}</p>
      </div>
    </div>

    <!-- Platform tabs -->
    <div v-if="!isStandalone" class="flex gap-2 mb-6" role="tablist">
      <button
        v-for="tab in tabs"
        :key="tab.value"
        type="button"
        role="tab"
        :aria-selected="platform === tab.value"
        :data-testid="`install-tab-${tab.value}`"
        class="shrink-0 inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full transition-colors"
        :class="platform === tab.value
          ? 'bg-blue-50 ring-2 ring-blue-300 text-blue-700'
          : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-200'"
        @click="platform = tab.value"
      >
        <component :is="tab.icon" class="w-4 h-4" />
        {{ tab.label }}
      </button>
    </div>

    <!-- iOS card -->
    <div
      v-if="!isStandalone && platform === 'ios'"
      data-testid="install-ios"
      class="bg-white rounded shadow p-6 space-y-5"
    >
      <div class="flex items-center gap-3 pb-4 border-b border-gray-100">
        <div class="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M16.365 1.43c0 1.14-.46 2.23-1.21 3.02-.81.85-2.13 1.51-3.42 1.4-.16-1.13.43-2.32 1.18-3.07.83-.84 2.24-1.46 3.45-1.35Zm4.41 16.4c-.41.95-.91 1.87-1.55 2.74-.86 1.18-2.1 2.65-3.62 2.66-1.36.02-1.71-.88-3.55-.87-1.84.01-2.23.89-3.59.88-1.52-.02-2.69-1.36-3.55-2.54-2.41-3.31-2.66-7.2-1.18-9.27.95-1.34 2.45-2.13 3.86-2.13 1.43 0 2.32.78 3.5.78 1.14 0 1.83-.78 3.49-.78 1.26 0 2.6.69 3.55 1.88-3.12 1.71-2.61 6.16.64 6.65Z"/>
          </svg>
        </div>
        <div>
          <h2 class="text-base font-semibold text-gray-900">{{ $t('install.ios.heading') }}</h2>
          <p class="text-xs text-gray-500">{{ $t('install.ios.requirements') }}</p>
        </div>
      </div>

      <ol class="space-y-4">
        <li v-for="(step, idx) in iosSteps" :key="idx" class="flex gap-3">
          <span class="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
            {{ idx + 1 }}
          </span>
          <div class="flex-1 min-w-0 pt-0.5">
            <p class="text-sm text-gray-800" v-html="step.text"></p>
            <p v-if="step.hint" class="text-xs text-gray-500 mt-1">{{ step.hint }}</p>
          </div>
        </li>
      </ol>

      <div class="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded text-sm text-amber-800">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 6a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 6Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" />
        </svg>
        <span>{{ $t('install.ios.note') }}</span>
      </div>
    </div>

    <!-- Android card -->
    <div
      v-if="!isStandalone && platform === 'android'"
      data-testid="install-android"
      class="bg-white rounded shadow p-6 space-y-5"
    >
      <div class="flex items-center gap-3 pb-4 border-b border-gray-100">
        <div class="w-10 h-10 rounded-lg bg-green-50 text-green-600 flex items-center justify-center shrink-0">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.6 9.48 19 7.06a.4.4 0 0 0-.7-.4l-1.42 2.45A11.5 11.5 0 0 0 12 8c-1.71 0-3.32.34-4.88 1.11L5.7 6.66a.4.4 0 0 0-.7.4l1.4 2.42A8.7 8.7 0 0 0 2 17h20a8.7 8.7 0 0 0-4.4-7.52ZM7 14.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm10 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"/>
          </svg>
        </div>
        <div>
          <h2 class="text-base font-semibold text-gray-900">{{ $t('install.android.heading') }}</h2>
          <p class="text-xs text-gray-500">{{ $t('install.android.requirements') }}</p>
        </div>
      </div>

      <!-- One-tap install CTA -->
      <div
        v-if="canPrompt"
        data-testid="install-prompt-cta"
        class="rounded-lg border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4 space-y-3"
      >
        <div class="flex items-center gap-2 text-sm font-semibold text-blue-900">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
            <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z"/>
            <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z"/>
          </svg>
          {{ $t('install.promptCta.title') }}
        </div>
        <p class="text-xs text-gray-600">{{ $t('install.promptCta.description') }}</p>
        <button
          type="button"
          data-testid="install-prompt-btn"
          :disabled="installing"
          class="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded hover:bg-blue-700 disabled:opacity-50 transition-colors"
          @click="onInstallClick"
        >
          {{ installing ? $t('install.promptCta.installing') : $t('install.promptCta.button') }}
        </button>
        <p class="text-xs text-gray-400">{{ $t('install.promptCta.manualFallback') }}</p>
      </div>

      <h3 v-if="canPrompt" class="text-sm font-semibold text-gray-700 pt-2">{{ $t('install.android.manualHeading') }}</h3>

      <ol class="space-y-4">
        <li v-for="(step, idx) in androidSteps" :key="idx" class="flex gap-3">
          <span class="shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
            {{ idx + 1 }}
          </span>
          <div class="flex-1 min-w-0 pt-0.5">
            <p class="text-sm text-gray-800" v-html="step.text"></p>
            <p v-if="step.hint" class="text-xs text-gray-500 mt-1">{{ step.hint }}</p>
          </div>
        </li>
      </ol>

      <div class="flex items-start gap-3 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-800">
        <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clip-rule="evenodd" />
        </svg>
        <span>{{ $t('install.android.note') }}</span>
      </div>
    </div>

    <!-- Benefits -->
    <div v-if="!isStandalone" class="bg-white rounded shadow p-6 mt-6">
      <h2 class="text-base font-semibold text-gray-900 mb-4">{{ $t('install.benefits.title') }}</h2>
      <ul class="space-y-3">
        <li v-for="(b, idx) in benefits" :key="idx" class="flex items-start gap-3 text-sm text-gray-700">
          <svg xmlns="http://www.w3.org/2000/svg" class="w-5 h-5 shrink-0 mt-0.5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z" clip-rule="evenodd" />
          </svg>
          <span>{{ b }}</span>
        </li>
      </ul>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, h, type FunctionalComponent } from 'vue'
import { useI18n } from 'vue-i18n'
import AppLayout from '../components/AppLayout.vue'
import { installPromptEvent, isStandalone, triggerInstall } from '../lib/install-prompt.js'

type Platform = 'ios' | 'android'

const { t, tm, rt } = useI18n()
const platform = ref<Platform>(detectInitial())
const installing = ref(false)

const host = computed((): string => {
  if (typeof window === 'undefined') return 'tippjatek.app'
  return window.location.hostname || 'tippjatek.app'
})

const canPrompt = computed((): boolean => installPromptEvent.value !== null)

function detectInitial(): Platform {
  if (typeof navigator === 'undefined') return 'ios'
  const ua = navigator.userAgent || ''
  if (/android/i.test(ua)) return 'android'
  return 'ios'
}

async function onInstallClick(): Promise<void> {
  if (installing.value) return
  installing.value = true
  try { await triggerInstall() }
  finally { installing.value = false }
}

const IosIcon: FunctionalComponent = () => h('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'currentColor' }, [
  h('path', { d: 'M16.365 1.43c0 1.14-.46 2.23-1.21 3.02-.81.85-2.13 1.51-3.42 1.4-.16-1.13.43-2.32 1.18-3.07.83-.84 2.24-1.46 3.45-1.35Zm4.41 16.4c-.41.95-.91 1.87-1.55 2.74-.86 1.18-2.1 2.65-3.62 2.66-1.36.02-1.71-.88-3.55-.87-1.84.01-2.23.89-3.59.88-1.52-.02-2.69-1.36-3.55-2.54-2.41-3.31-2.66-7.2-1.18-9.27.95-1.34 2.45-2.13 3.86-2.13 1.43 0 2.32.78 3.5.78 1.14 0 1.83-.78 3.49-.78 1.26 0 2.6.69 3.55 1.88-3.12 1.71-2.61 6.16.64 6.65Z' }),
])
const AndroidIcon: FunctionalComponent = () => h('svg', { xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24', fill: 'currentColor' }, [
  h('path', { d: 'M17.6 9.48 19 7.06a.4.4 0 0 0-.7-.4l-1.42 2.45A11.5 11.5 0 0 0 12 8c-1.71 0-3.32.34-4.88 1.11L5.7 6.66a.4.4 0 0 0-.7.4l1.4 2.42A8.7 8.7 0 0 0 2 17h20a8.7 8.7 0 0 0-4.4-7.52ZM7 14.5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm10 0a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z' }),
])

const tabs = computed(() => [
  { value: 'ios' as Platform, label: t('install.tabs.ios'), icon: IosIcon },
  { value: 'android' as Platform, label: t('install.tabs.android'), icon: AndroidIcon },
])

interface Step { text: string; hint?: string }

function withDomain(s: string): string {
  return s.replace(/\{domain\}/g, host.value)
}

const iosSteps = computed((): Step[] => (tm('install.ios.steps') as Step[]).map(s => ({
  text: withDomain(rt(s.text)),
  hint: s.hint ? withDomain(rt(s.hint)) : undefined,
})))

const androidSteps = computed((): Step[] => (tm('install.android.steps') as Step[]).map(s => ({
  text: withDomain(rt(s.text)),
  hint: s.hint ? withDomain(rt(s.hint)) : undefined,
})))

const benefits = computed((): string[] => (tm('install.benefits.items') as string[]).map(b => rt(b)))
</script>
