<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

const emit = defineEmits<{
  complete: []
}>()

const TOTAL_STEPS = 5

const router = useRouter()
const { t } = useI18n()
const currentStep = ref(0)
const overlayRef = ref<HTMLElement | null>(null)
const direction = ref<'forward' | 'backward'>('forward')

interface HubCard {
  readonly key: string
  readonly icon: string
  readonly titleKey: string
  readonly descKey: string
  readonly liveBadgeKey?: string
  readonly route: string
}

const hubCards: readonly HubCard[] = [
  { key: 'matches', icon: '📅', titleKey: 'onboarding.hubMatches', descKey: 'onboarding.hubMatchesDesc', route: '/app/matches' },
  { key: 'tournament', icon: '🏆', titleKey: 'onboarding.hubTournament', descKey: 'onboarding.hubTournamentDesc', route: '/app/tournament-tips' },
  { key: 'mytips', icon: '📊', titleKey: 'onboarding.hubMyTips', descKey: 'onboarding.hubMyTipsDesc', liveBadgeKey: 'onboarding.hubMyTipsLiveBadge', route: '/app/my-tips' },
  { key: 'groups', icon: '👥', titleKey: 'onboarding.hubGroups', descKey: 'onboarding.hubGroupsDesc', route: '/app/groups' },
  { key: 'profile', icon: '⚙️', titleKey: 'onboarding.hubProfile', descKey: 'onboarding.hubProfileDesc', route: '/app/profile' },
  { key: 'donation', icon: '☕', titleKey: 'onboarding.hubDonation', descKey: 'onboarding.hubDonationDesc', route: '/app/profile' },
] as const

const stepTitleKey: readonly string[] = [
  'onboarding.step1Title',
  'onboarding.step2Title',
  'onboarding.step3Title',
  'onboarding.step4Title',
  'onboarding.step5Title',
]

const ariaLiveLabel = computed<string>(() =>
  t('onboarding.stepLabel', { n: currentStep.value + 1, total: TOTAL_STEPS, title: t(stepTitleKey[currentStep.value]) })
)

const primaryLabel = computed<string>(() => {
  switch (currentStep.value) {
    case 0: return t('onboarding.step1Next')
    case 1: return t('onboarding.step2Next')
    case 2: return t('onboarding.step3Next')
    case 3: return t('onboarding.step4Next')
    default: return t('onboarding.step5Cta')
  }
})

function nextStep(): void {
  if (currentStep.value < TOTAL_STEPS - 1) {
    direction.value = 'forward'
    currentStep.value++
    return
  }
  // Last step primary CTA → navigate to matches and complete
  finishToMatches()
}

function prevStep(): void {
  if (currentStep.value > 0) {
    direction.value = 'backward'
    currentStep.value--
  }
}

function skip(): void {
  emit('complete')
}

function finishToMatches(): void {
  emit('complete')
  void router.push('/app/matches')
}

function openHub(card: HubCard): void {
  emit('complete')
  void router.push(card.route)
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === 'Escape') {
    skip()
    return
  }
  if (e.key === 'Tab') {
    trapFocus(e)
  }
}

function trapFocus(e: KeyboardEvent): void {
  if (!overlayRef.value) return
  const focusable = overlayRef.value.querySelectorAll<HTMLElement>(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  if (focusable.length === 0) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

function focusFirstButton(): void {
  void nextTick(() => {
    if (!overlayRef.value) return
    const btn = overlayRef.value.querySelector<HTMLElement>('[data-testid="next-button"]')
      ?? overlayRef.value.querySelector<HTMLElement>('button')
    btn?.focus()
  })
}

watch(currentStep, () => {
  focusFirstButton()
})

onMounted(() => {
  document.addEventListener('keydown', onKeydown)
  focusFirstButton()
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div
    ref="overlayRef"
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-6"
    role="dialog"
    aria-modal="true"
    aria-label="Onboarding bemutató"
    data-testid="onboarding-overlay"
  >
    <div class="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
      <!-- Sticky header: progress dots + counter + skip -->
      <div class="flex items-center justify-between px-5 pt-4">
        <div class="flex gap-1.5" aria-hidden="true">
          <span
            v-for="i in TOTAL_STEPS"
            :key="i"
            :class="[
              i === TOTAL_STEPS
                ? 'h-2.5 w-2.5 ring-2'
                : 'h-2 w-2',
              'rounded-full transition-colors duration-200',
              i - 1 <= currentStep ? 'bg-blue-600' : 'bg-gray-300',
              i === TOTAL_STEPS && i - 1 <= currentStep ? 'ring-blue-300' : 'ring-gray-200',
              i === TOTAL_STEPS && i - 1 > currentStep ? 'ring-gray-200' : '',
            ]"
            data-testid="progress-dot"
          />
        </div>
        <div class="flex items-center gap-3 text-xs">
          <span class="text-gray-400 tabular-nums" data-testid="step-counter">{{ currentStep + 1 }}/{{ TOTAL_STEPS }}</span>
          <button
            class="text-gray-400 hover:text-gray-600 underline-offset-2 hover:underline focus:outline-none focus:underline"
            :aria-label="$t('onboarding.skip')"
            data-testid="skip-button"
            @click="skip"
          >
            {{ $t('onboarding.skip') }}
          </button>
        </div>
      </div>

      <!-- aria-live region for screen readers -->
      <span class="sr-only" aria-live="polite" data-testid="step-aria-live">{{ ariaLiveLabel }}</span>

      <!-- Step content -->
      <div class="relative overflow-hidden">
        <!-- Step 0: Üdvözlés -->
        <div
          v-if="currentStep === 0"
          class="px-6 pt-6 pb-4 text-center"
          data-testid="step-0"
        >
          <div class="mx-auto mb-6 flex flex-col items-center">
            <div class="text-5xl mb-2">🏆</div>
            <div class="flex items-end gap-2">
              <div class="h-10 w-9 rounded-md border-2 border-blue-400 bg-white flex items-center justify-center text-base font-bold text-blue-700 shadow-sm">2</div>
              <div class="h-10 w-9 rounded-md border-2 border-blue-400 bg-white flex items-center justify-center text-base font-bold text-blue-700 shadow-sm">1</div>
              <div class="h-10 w-9 rounded-md border-2 border-blue-400 bg-white flex items-center justify-center text-base font-bold text-blue-700 shadow-sm">X</div>
            </div>
          </div>

          <h2 class="text-2xl font-bold text-gray-900 mb-2">{{ $t('onboarding.step1Title') }}</h2>
          <p class="text-sm text-gray-600 leading-relaxed mb-5">{{ $t('onboarding.step1Desc') }}</p>

          <ul class="text-sm text-gray-600 space-y-1.5 mb-2 text-left max-w-xs mx-auto">
            <li class="flex gap-2"><span class="text-green-500 font-bold">✓</span><span>{{ $t('onboarding.step1Bullet1') }}</span></li>
            <li class="flex gap-2"><span class="text-green-500 font-bold">✓</span><span>{{ $t('onboarding.step1Bullet2') }}</span></li>
          </ul>
        </div>

        <!-- Step 1: Hogyan tippelsz -->
        <div
          v-else-if="currentStep === 1"
          class="px-6 pt-6 pb-4 text-center"
          data-testid="step-1"
        >
          <!-- Mini meccskártya odds-szal -->
          <div class="mx-auto mb-5 max-w-[18rem] rounded-xl border border-gray-200 bg-gray-50 p-3 text-left">
            <div class="flex items-center justify-between gap-2 mb-2">
              <div class="flex items-center gap-2">
                <span class="text-base leading-none">🇭🇺</span>
                <span class="text-sm font-medium text-gray-800">{{ $t('onboarding.step2TeamA') }}</span>
              </div>
              <div class="flex items-center gap-1.5">
                <div class="h-7 w-8 rounded-md border-2 border-blue-400 bg-white flex items-center justify-center text-sm font-bold text-blue-700">2</div>
                <span class="text-gray-400 font-bold text-sm">:</span>
                <div class="h-7 w-8 rounded-md border-2 border-blue-400 bg-white flex items-center justify-center text-sm font-bold text-blue-700">1</div>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-base leading-none">🇩🇪</span>
              <span class="text-sm font-medium text-gray-800">{{ $t('onboarding.step2TeamB') }}</span>
            </div>
            <div class="mt-3 pt-3 border-t border-gray-200">
              <p class="text-[11px] uppercase tracking-wide text-gray-400 mb-1.5">{{ $t('onboarding.step2OddsLabel') }}</p>
              <div class="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <div class="h-2 rounded-full bg-green-400" style="width: 62%" />
                  <p class="mt-1 text-gray-600">H · 62%</p>
                </div>
                <div>
                  <div class="h-2 rounded-full bg-yellow-400" style="width: 18%" />
                  <p class="mt-1 text-gray-600">D · 18%</p>
                </div>
                <div>
                  <div class="h-2 rounded-full bg-red-400" style="width: 20%" />
                  <p class="mt-1 text-gray-600">V · 20%</p>
                </div>
              </div>
            </div>
          </div>

          <!-- Idővonal -->
          <div class="mx-auto mb-5 max-w-xs">
            <div class="relative flex items-center justify-between">
              <div class="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-400" />
              <div class="relative z-10 flex flex-col items-center gap-1">
                <div class="h-6 w-6 rounded-full bg-green-500 border-2 border-white shadow flex items-center justify-center">
                  <svg class="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                </div>
                <span class="text-[11px] font-medium text-green-700">{{ $t('onboarding.step2Open') }}</span>
              </div>
              <div class="relative z-10 flex flex-col items-center gap-1">
                <div class="h-6 w-6 rounded-full bg-yellow-500 border-2 border-white shadow flex items-center justify-center">
                  <svg class="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="currentColor" /></svg>
                </div>
                <span class="text-[11px] font-medium text-yellow-700">{{ $t('onboarding.step2Start') }}</span>
              </div>
              <div class="relative z-10 flex flex-col items-center gap-1">
                <div class="h-6 w-6 rounded-full bg-red-500 border-2 border-white shadow flex items-center justify-center">
                  <svg class="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <span class="text-[11px] font-medium text-red-700">{{ $t('onboarding.step2Closed') }}</span>
              </div>
            </div>
          </div>

          <h2 class="text-2xl font-bold text-gray-900 mb-2">{{ $t('onboarding.step2Title') }}</h2>
          <p class="text-sm text-gray-600 leading-relaxed mb-4">{{ $t('onboarding.step2Desc') }}</p>

          <ul class="text-sm text-gray-600 space-y-1.5 mb-2 text-left max-w-xs mx-auto">
            <li class="flex gap-2"><span class="text-blue-500 font-bold">•</span><span>{{ $t('onboarding.step2Bullet1') }}</span></li>
            <li class="flex gap-2"><span class="text-blue-500 font-bold">•</span><span>{{ $t('onboarding.step2Bullet2') }}</span></li>
            <li class="flex gap-2"><span class="text-blue-500 font-bold">•</span><span>{{ $t('onboarding.step2Bullet3') }}</span></li>
          </ul>
        </div>

        <!-- Step 2: Speciális (torna) tippek -->
        <div
          v-else-if="currentStep === 2"
          class="px-6 pt-6 pb-4 text-center"
          data-testid="step-2"
        >
          <div class="flex flex-wrap justify-center gap-2 mb-5">
            <div class="rounded-xl border border-yellow-200 bg-yellow-50 px-3 py-2 text-left">
              <div class="text-lg">⚽</div>
              <p class="text-xs font-semibold text-yellow-900">{{ $t('onboarding.step3ChipScorer') }}</p>
              <p class="text-[11px] font-bold text-yellow-700 tabular-nums">{{ $t('onboarding.step3PointsScorer') }}</p>
            </div>
            <div class="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-left">
              <div class="text-lg">🥇</div>
              <p class="text-xs font-semibold text-blue-900">{{ $t('onboarding.step3ChipGroupWinner') }}</p>
              <p class="text-[11px] font-bold text-blue-700 tabular-nums">{{ $t('onboarding.step3PointsGroupWinner') }}</p>
            </div>
            <div class="rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-left">
              <div class="text-lg">🏁</div>
              <p class="text-xs font-semibold text-purple-900">{{ $t('onboarding.step3ChipFinalists') }}</p>
              <p class="text-[11px] font-bold text-purple-700 tabular-nums">{{ $t('onboarding.step3PointsFinalists') }}</p>
            </div>
          </div>

          <h2 class="text-2xl font-bold text-gray-900 mb-2">{{ $t('onboarding.step3Title') }}</h2>
          <p class="text-sm text-gray-600 leading-relaxed mb-4">{{ $t('onboarding.step3Desc') }}</p>

          <ul class="text-sm text-gray-600 space-y-1.5 mb-3 text-left max-w-xs mx-auto">
            <li class="flex gap-2"><span class="text-blue-500 font-bold">•</span><span>{{ $t('onboarding.step3Bullet1') }}</span></li>
            <li class="flex gap-2"><span class="text-blue-500 font-bold">•</span><span>{{ $t('onboarding.step3Bullet2') }}</span></li>
            <li class="flex gap-2"><span class="text-blue-500 font-bold">•</span><span>{{ $t('onboarding.step3Bullet3') }}</span></li>
          </ul>

          <div class="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left flex items-center gap-2">
            <span class="text-base">⚠️</span>
            <p class="text-xs text-amber-900">{{ $t('onboarding.step3PendingExample') }}</p>
          </div>
        </div>

        <!-- Step 3: Kedvenc csapat × dupla pont -->
        <div
          v-else-if="currentStep === 3"
          class="px-6 pt-6 pb-4 text-center"
          data-testid="step-3"
        >
          <div class="mx-auto mb-5 flex items-end justify-center gap-4">
            <div class="flex flex-col items-center gap-1 opacity-60">
              <div class="h-14 w-14 rounded-full bg-gray-100 border-2 border-gray-200 flex items-center justify-center text-2xl">🇩🇪</div>
              <span class="text-xs text-gray-400">{{ $t('onboarding.step4OtherTeam') }}</span>
            </div>
            <div class="relative flex flex-col items-center gap-1">
              <div class="h-16 w-16 rounded-full bg-red-50 border-2 border-red-400 flex items-center justify-center text-3xl shadow-md">🇭🇺</div>
              <span class="text-xs font-semibold text-red-700">{{ $t('onboarding.step4FavLabel') }}</span>
              <span class="absolute -top-2 -right-2 h-9 w-9 rounded-full bg-red-500 text-white font-bold text-sm flex items-center justify-center shadow-lg ring-4 ring-white tabular-nums">×2</span>
            </div>
          </div>

          <h2 class="text-2xl font-bold text-gray-900 mb-2">{{ $t('onboarding.step4Title') }}</h2>
          <p class="text-sm text-gray-600 leading-relaxed mb-4">{{ $t('onboarding.step4Desc') }}</p>

          <div class="rounded-xl border border-blue-200 bg-blue-50 p-3 text-left text-sm">
            <p class="text-xs uppercase tracking-wide text-blue-700 font-semibold mb-1">{{ $t('onboarding.step4ExampleLabel') }}</p>
            <div class="flex items-center justify-between text-gray-700">
              <span>{{ $t('onboarding.step4ExampleLeft') }}</span>
              <span class="font-bold text-blue-900 tabular-nums">{{ $t('onboarding.step4ExampleRight') }}</span>
            </div>
          </div>

          <p class="text-xs text-gray-500 mt-3 italic">{{ $t('onboarding.step4LockNote') }}</p>
        </div>

        <!-- Step 4: HUB -->
        <div
          v-else-if="currentStep === 4"
          class="px-6 pt-6 pb-4"
          data-testid="step-4"
        >
          <h2 class="text-2xl font-bold text-gray-900 mb-1 text-center">{{ $t('onboarding.step5Title') }}</h2>
          <p class="text-sm text-gray-600 leading-relaxed mb-5 text-center">{{ $t('onboarding.step5Desc') }}</p>

          <div class="grid grid-cols-2 gap-2.5 mb-2">
            <button
              v-for="card in hubCards"
              :key="card.key"
              type="button"
              class="rounded-xl border border-gray-200 bg-white p-3 text-left hover:border-blue-400 hover:shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-500"
              :data-testid="`hub-card-${card.key}`"
              :aria-label="$t(card.titleKey)"
              @click="openHub(card)"
            >
              <div class="text-xl mb-1" aria-hidden="true">{{ card.icon }}</div>
              <p class="text-sm font-semibold text-gray-900">{{ $t(card.titleKey) }}</p>
              <p v-if="card.liveBadgeKey" class="text-[11px] text-gray-500 mt-0.5 leading-snug">
                {{ $t(card.descKey, { liveBadge: '' }) }}
                <span class="inline-block px-1 rounded bg-red-100 text-red-700 text-[9px] font-bold align-middle">{{ $t(card.liveBadgeKey) }}</span>
              </p>
              <p v-else class="text-[11px] text-gray-500 mt-0.5 leading-snug">{{ $t(card.descKey) }}</p>
            </button>
          </div>

          <p class="text-[11px] text-gray-400 text-center mt-3">{{ $t('onboarding.step5ReplayHint') }}</p>
        </div>
      </div>

      <!-- Sticky footer: Vissza + primary -->
      <div class="flex items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 bg-gray-50/50 mt-auto">
        <button
          v-if="currentStep > 0"
          class="rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 transition focus:outline-none focus:ring-2 focus:ring-blue-500"
          :aria-label="$t('onboarding.back')"
          data-testid="back-button"
          @click="prevStep"
        >
          {{ $t('onboarding.back') }}
        </button>
        <span v-else />
        <button
          class="rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          :aria-label="primaryLabel"
          data-testid="next-button"
          @click="nextStep"
        >
          {{ primaryLabel }}
        </button>
      </div>
    </div>
  </div>
</template>
