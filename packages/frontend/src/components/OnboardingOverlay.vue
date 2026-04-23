<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRouter } from 'vue-router'

const emit = defineEmits<{
  complete: []
}>()

const router = useRouter()
const currentStep = ref(0)
const overlayRef = ref<HTMLElement | null>(null)
const direction = ref<'forward' | 'backward'>('forward')

function nextStep(): void {
  if (currentStep.value < 2) {
    direction.value = 'forward'
    currentStep.value++
  }
}

function skip(): void {
  emit('complete')
}

function goToCreateGroup(): void {
  emit('complete')
  void router.push('/app/groups?action=create')
}

function goToJoinGroup(): void {
  emit('complete')
  void router.push('/app/groups?action=join')
}

function goToMatches(): void {
  emit('complete')
  void router.push('/app/matches')
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
    const btn = overlayRef.value.querySelector<HTMLElement>('button')
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
    <div class="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
      <!-- Progress dots -->
      <div class="flex justify-center gap-2 pt-6" aria-hidden="true">
        <span
          v-for="i in 3"
          :key="i"
          class="h-2 w-2 rounded-full transition-colors duration-200"
          :class="i - 1 <= currentStep ? 'bg-blue-600' : 'bg-gray-300'"
          data-testid="progress-dot"
        />
      </div>

      <!-- Step content -->
      <div
        class="relative overflow-hidden"
        aria-live="polite"
      >
        <!-- Step 0: Üdvözlés -->
        <div
          v-if="currentStep === 0"
          class="px-6 py-8 text-center"
          data-testid="step-0"
        >
          <!-- Illusztráció: egyszerűsített meccskártya -->
          <div class="mx-auto mb-6 w-56 rounded-xl border border-gray-200 bg-gray-50 p-4">
            <div class="flex items-center justify-between gap-3">
              <div class="flex flex-col items-center gap-1">
                <div class="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-bold text-blue-700">A</div>
                <span class="text-xs text-gray-500">Csapat A</span>
              </div>
              <div class="flex items-center gap-2">
                <div class="h-9 w-10 rounded-md border-2 border-blue-400 bg-white flex items-center justify-center text-lg font-bold text-blue-700">2</div>
                <span class="text-gray-400 font-bold">:</span>
                <div class="h-9 w-10 rounded-md border-2 border-blue-400 bg-white flex items-center justify-center text-lg font-bold text-blue-700">1</div>
              </div>
              <div class="flex flex-col items-center gap-1">
                <div class="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center text-sm font-bold text-red-700">B</div>
                <span class="text-xs text-gray-500">Csapat B</span>
              </div>
            </div>
          </div>

          <h2 class="text-xl font-bold text-gray-900 mb-2">
            Üdvözlünk a VB Tippjátékban!
          </h2>
          <p class="text-gray-600 text-sm leading-relaxed mb-6">
            Tippeld meg a 2026-os VB meccseit, gyűjtsd a pontokat,
            és derüljön ki, kinek van a legjobb focitudása.
          </p>

          <div class="flex flex-col gap-3">
            <button
              class="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Hogyan működik a tippjáték"
              data-testid="next-button"
              @click="nextStep"
            >
              Hogyan működik?
            </button>
            <button
              class="text-sm text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:underline"
              aria-label="Bemutató kihagyása, tovább a meccsekhez"
              data-testid="skip-button"
              @click="skip"
            >
              Kihagyom, nézzük a meccseket
            </button>
          </div>
        </div>

        <!-- Step 1: Tippelés -->
        <div
          v-if="currentStep === 1"
          class="px-6 py-8 text-center"
          data-testid="step-1"
        >
          <!-- Vizuális idővonalon -->
          <div class="mx-auto mb-6 max-w-xs">
            <div class="relative flex items-center justify-between">
              <!-- Vonal -->
              <div class="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-green-400 via-yellow-400 to-red-400" />
              <!-- Pontok -->
              <div class="relative z-10 flex flex-col items-center gap-1">
                <div class="h-6 w-6 rounded-full bg-green-500 border-2 border-white shadow flex items-center justify-center">
                  <svg class="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                </div>
                <span class="text-xs font-medium text-green-700 mt-1">Tipp nyitva</span>
              </div>
              <div class="relative z-10 flex flex-col items-center gap-1">
                <div class="h-6 w-6 rounded-full bg-yellow-500 border-2 border-white shadow flex items-center justify-center">
                  <svg class="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="currentColor" /></svg>
                </div>
                <span class="text-xs font-medium text-yellow-700 mt-1">Meccs kezdés</span>
              </div>
              <div class="relative z-10 flex flex-col items-center gap-1">
                <div class="h-6 w-6 rounded-full bg-red-500 border-2 border-white shadow flex items-center justify-center">
                  <svg class="h-3 w-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M6 18L18 6M6 6l12 12" /></svg>
                </div>
                <span class="text-xs font-medium text-red-700 mt-1">Zárva</span>
              </div>
            </div>
          </div>

          <h2 class="text-xl font-bold text-gray-900 mb-2">
            Minden tipp számít!
          </h2>
          <p class="text-gray-600 text-sm leading-relaxed mb-6">
            A tipped a meccs kezdéséig bármikor leadható és módosítható.
            Pontos találat, helyes gólarány vagy jó végeredmény — mindegyikért jár pont!
          </p>

          <div class="flex flex-col gap-3">
            <button
              class="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Tovább a következő lépésre"
              data-testid="next-button"
              @click="nextStep"
            >
              Értem, tovább!
            </button>
            <button
              class="text-sm text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:underline"
              aria-label="Bemutató kihagyása"
              data-testid="skip-button"
              @click="skip"
            >
              Átugorva
            </button>
          </div>
        </div>

        <!-- Step 2: Csoportok -->
        <div
          v-if="currentStep === 2"
          class="px-6 py-8 text-center"
          data-testid="step-2"
        >
          <!-- Illusztráció: csoport ikonok -->
          <div class="mx-auto mb-6 flex items-center justify-center gap-3">
            <div class="flex -space-x-2">
              <div class="h-10 w-10 rounded-full bg-blue-200 border-2 border-white flex items-center justify-center text-sm font-bold text-blue-700">P</div>
              <div class="h-10 w-10 rounded-full bg-green-200 border-2 border-white flex items-center justify-center text-sm font-bold text-green-700">A</div>
              <div class="h-10 w-10 rounded-full bg-purple-200 border-2 border-white flex items-center justify-center text-sm font-bold text-purple-700">M</div>
            </div>
            <svg class="h-6 w-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
            <div class="h-10 w-10 rounded-full bg-yellow-200 border-2 border-white flex items-center justify-center">
              <svg class="h-5 w-5 text-yellow-700" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" /></svg>
            </div>
          </div>

          <h2 class="text-xl font-bold text-gray-900 mb-2">
            Csatlakozz egy csapathoz!
          </h2>
          <p class="text-gray-600 text-sm leading-relaxed mb-6">
            Hozz létre saját csoportot, vagy csatlakozz meghívó kóddal.
            Saját ranglista, saját riválisok.
          </p>

          <div class="flex gap-3 mb-3">
            <button
              class="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Csoport létrehozása"
              data-testid="create-group-button"
              @click="goToCreateGroup"
            >
              Csoport létrehozása
            </button>
            <button
              class="flex-1 rounded-lg border border-blue-600 px-4 py-2.5 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              aria-label="Meghívó kód beváltása"
              data-testid="join-group-button"
              @click="goToJoinGroup"
            >
              Meghívó kód beváltása
            </button>
          </div>
          <button
            class="text-sm text-gray-400 hover:text-gray-600 transition-colors focus:outline-none focus:underline"
            aria-label="Egyedül kezdek, tovább a meccsekhez"
            data-testid="later-button"
            @click="goToMatches"
          >
            Egyedül kezdek
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
