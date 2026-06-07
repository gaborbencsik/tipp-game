<template>
  <AppLayout>
    <div class="flex items-center justify-between mb-4">
      <h1 class="text-2xl font-bold">Push üzenet küldés</h1>
    </div>
    <AdminNav />

    <section class="mb-4 p-4 bg-white rounded-lg border" data-testid="admin-push-automation-section">
      <h2 class="text-base font-semibold mb-2">Automatikus push-ok</h2>
      <p class="text-xs text-gray-500 mb-3">A Render cron service-ek által hívott háttérjobok ki/be kapcsolása. Ha kikapcsolod, a job a fut elején silent skip-pel kilép.</p>
      <div v-if="settingsLoading" class="text-xs text-gray-400">Betöltés…</div>
      <div v-else-if="settingsError" class="text-xs text-red-600">{{ settingsError }}</div>
      <div v-else class="flex flex-col gap-2">
        <label class="inline-flex items-center gap-3 text-sm">
          <input
            v-model="kickoffReminderEnabled"
            type="checkbox"
            data-testid="admin-push-toggle-kickoff-reminder"
            :disabled="settingsSaving"
            @change="saveSettings"
          />
          <div class="flex flex-col">
            <span class="font-medium">Kickoff reminder</span>
            <span class="text-xs text-gray-500">Meccs előtt 30–45 perccel reminder a tippnélküli usereknek (15 percenként fut)</span>
          </div>
        </label>
        <label class="inline-flex items-center gap-3 text-sm">
          <input
            v-model="dailyReviewEnabled"
            type="checkbox"
            data-testid="admin-push-toggle-daily-review"
            :disabled="settingsSaving"
            @change="saveSettings"
          />
          <div class="flex flex-col">
            <span class="font-medium">Daily review</span>
            <span class="text-xs text-gray-500">Naponta egyszer 12:00 CET-kor, 17:00 → másnap 07:00 közötti meccsek hiányos tippjei</span>
          </div>
        </label>
        <span v-if="settingsSavedAt" class="text-xs text-green-600">Elmentve.</span>
      </div>
    </section>

    <section class="mb-4 p-4 bg-white rounded-lg border" data-testid="admin-push-section">
      <fieldset class="mb-3 border rounded p-3" data-testid="admin-push-segment-group">
        <legend class="text-xs text-gray-600 px-1">Címzettek</legend>
        <div class="flex flex-col gap-1.5">
          <label class="inline-flex items-center gap-2 text-sm">
            <input
              v-model="segment"
              type="radio"
              value="all"
              data-testid="admin-push-segment-all"
              :disabled="sending"
            />
            <span>Mindenki</span>
          </label>
          <label class="inline-flex items-center gap-2 text-sm">
            <input
              v-model="segment"
              type="radio"
              value="missing-tournament-tips"
              data-testid="admin-push-segment-missing-tournament"
              :disabled="sending"
            />
            <span>Akiknek van hiányzó torna tippje</span>
          </label>
          <label class="inline-flex items-center gap-2 text-sm">
            <input
              v-model="segment"
              type="radio"
              value="missing-today-match-tips"
              data-testid="admin-push-segment-missing-match"
              :disabled="sending"
            />
            <span>Akiknek van hiányzó mai meccs tippje</span>
          </label>
        </div>
      </fieldset>

      <div class="text-xs text-gray-600 mb-3 flex items-center gap-3 flex-wrap" data-testid="admin-push-targets">
        <span v-if="targetsLoading" class="text-gray-400">Címzettek számolása…</span>
        <span v-else-if="targetsError" class="text-red-600">{{ targetsError }}</span>
        <template v-else>
          <span>
            Aktív címzettek (push engedélyezve, nem törölt{{ segmentSuffix }}):
            <span class="font-semibold">{{ targetCount }}</span>
          </span>
          <button
            v-if="targetCount > 0"
            type="button"
            class="text-blue-600 hover:underline disabled:text-gray-400"
            data-testid="admin-push-targets-details-button"
            :disabled="sending"
            @click="openTargetsModal"
          >
            Részletek
          </button>
        </template>
      </div>

      <div class="flex flex-col gap-1 mb-3">
        <label for="admin-push-title" class="text-xs text-gray-600">Cím <span class="text-gray-400">({{ title.length }}/100)</span></label>
        <input
          id="admin-push-title"
          v-model="title"
          type="text"
          maxlength="100"
          class="border rounded px-3 py-1.5 text-sm"
          data-testid="admin-push-title"
          :disabled="sending"
        />
      </div>

      <div class="flex flex-col gap-1 mb-3">
        <label for="admin-push-body" class="text-xs text-gray-600">Üzenet <span class="text-gray-400">({{ body.length }}/300)</span></label>
        <textarea
          id="admin-push-body"
          v-model="body"
          rows="3"
          maxlength="300"
          class="border rounded px-3 py-1.5 text-sm"
          data-testid="admin-push-body"
          :disabled="sending"
        ></textarea>
      </div>

      <div class="flex flex-col gap-1 mb-3">
        <label for="admin-push-url" class="text-xs text-gray-600">URL (opcionális)</label>
        <input
          id="admin-push-url"
          v-model="url"
          type="text"
          placeholder="/app/matches"
          class="border rounded px-3 py-1.5 text-sm"
          data-testid="admin-push-url"
          :disabled="sending"
        />
        <p class="text-xs text-gray-400">Kattintáskor erre az URL-re visz. Üresen hagyva a kezdőlapra.</p>
      </div>

      <div class="flex flex-wrap gap-4 mb-3">
        <label class="inline-flex items-center gap-2 text-sm">
          <input
            v-model="bypassQuietHours"
            type="checkbox"
            data-testid="admin-push-bypass-quiet-hours"
            :disabled="sending"
          />
          <span>Csendes órák átlépése</span>
        </label>
        <label class="inline-flex items-center gap-2 text-sm">
          <input
            v-model="bypassRateLimit"
            type="checkbox"
            data-testid="admin-push-bypass-rate-limit"
            :disabled="sending"
          />
          <span>Rate limit átlépése</span>
        </label>
      </div>

      <div class="flex items-center gap-3 flex-wrap mb-3">
        <button
          class="px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!canSend"
          data-testid="admin-push-send"
          @click="confirmAndSend"
        >
          <span v-if="sending">Küldés…</span>
          <span v-else>Üzenet küldése</span>
        </button>
        <span v-if="sendError" class="text-xs text-red-600" data-testid="admin-push-error">{{ sendError }}</span>
      </div>

      <div v-if="lastResult" class="p-3 rounded text-sm bg-green-50 border border-green-200" data-testid="admin-push-result">
        <div class="font-medium">✅ Elküldve</div>
        <div class="text-gray-700 mt-1">
          Szegmens: <span class="font-medium">{{ segmentLabel(lastResult.segment) }}</span> | Címzettek: {{ lastResult.totalTargets }} | Kézbesítve: {{ lastResult.delivered }} | Sikertelen: {{ lastResult.failed }}
        </div>
        <div v-if="lastResult.errors.length > 0" class="mt-2 text-xs text-red-600 space-y-0.5">
          <div v-for="(err, i) in lastResult.errors.slice(0, 5)" :key="i">{{ err }}</div>
          <div v-if="lastResult.errors.length > 5" class="text-gray-500">+ további {{ lastResult.errors.length - 5 }} hiba</div>
        </div>
      </div>

      <p class="text-xs text-gray-400 mt-2">
        Az üzenet minden olyan felhasználónak megy, aki engedélyezte a push értesítéseket.
        A küldés audit logba kerül.
      </p>
    </section>

    <Teleport to="body">
      <div
        v-if="targetsModalOpen"
        class="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
        data-testid="admin-push-targets-modal"
        @click.self="closeTargetsModal"
        @keydown.esc="closeTargetsModal"
      >
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[80vh] flex flex-col">
          <header class="px-4 py-3 border-b flex items-center justify-between">
            <h3 class="font-semibold text-base">
              Címzettek – {{ segmentLabel(segment) }}
              <span class="text-gray-500 text-sm font-normal">({{ targetCount }} felhasználó)</span>
            </h3>
            <button
              type="button"
              class="text-gray-500 hover:text-gray-800 text-xl leading-none"
              aria-label="Bezárás"
              data-testid="admin-push-targets-modal-close"
              @click="closeTargetsModal"
            >×</button>
          </header>
          <div class="overflow-y-auto px-4 py-3 flex-1">
            <div v-if="targetsModalLoading" class="text-sm text-gray-400">Betöltés…</div>
            <div v-else-if="targetsModalError" class="text-sm text-red-600">{{ targetsModalError }}</div>
            <div v-else-if="targetsModalUsers.length === 0" class="text-sm text-gray-500">
              Nincsenek címzettek a kiválasztott szegmensben.
            </div>
            <ul v-else class="divide-y" data-testid="admin-push-targets-list">
              <li
                v-for="u in targetsModalUsers"
                :key="u.id"
                class="py-2 text-sm"
                data-testid="admin-push-targets-list-row"
              >
                <div class="font-medium">{{ u.displayName || '— névtelen —' }}</div>
                <div class="text-xs text-gray-500">{{ u.email }}</div>
              </li>
            </ul>
            <p v-if="targetsModalTruncated" class="text-xs text-gray-400 mt-2">
              … az első 500 felhasználó látszik, a többi rejtve.
            </p>
          </div>
          <footer class="px-4 py-2 border-t flex justify-end">
            <button
              type="button"
              class="px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded"
              @click="closeTargetsModal"
            >Bezárás</button>
          </footer>
        </div>
      </div>
    </Teleport>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import AdminNav from '../components/admin/AdminNav.vue'
import { api } from '../api/index.js'
import { useAuthStore } from '../stores/auth.store.js'

type Segment = 'all' | 'missing-tournament-tips' | 'missing-today-match-tips'

interface SendResult {
  totalTargets: number
  delivered: number
  failed: number
  errors: string[]
  segment: Segment
}

const authStore = useAuthStore()

const segment = ref<Segment>('all')
const targetCount = ref(0)
const targetsLoading = ref(false)
const targetsError = ref('')

const kickoffReminderEnabled = ref(true)
const dailyReviewEnabled = ref(true)
const settingsLoading = ref(false)
const settingsError = ref('')
const settingsSaving = ref(false)
const settingsSavedAt = ref<number | null>(null)

const title = ref('')
const body = ref('')
const url = ref('')
const bypassQuietHours = ref(false)
const bypassRateLimit = ref(false)

const sending = ref(false)
const sendError = ref('')
const lastResult = ref<SendResult | null>(null)

const targetsModalOpen = ref(false)
const targetsModalLoading = ref(false)
const targetsModalError = ref('')
const targetsModalUsers = ref<{ id: string; displayName: string | null; email: string }[]>([])
const targetsModalTruncated = ref(false)

function segmentLabel(s: Segment): string {
  if (s === 'missing-tournament-tips') return 'Hiányzó torna tippek'
  if (s === 'missing-today-match-tips') return 'Hiányzó mai meccs tippek'
  return 'Mindenki'
}

const segmentSuffix = computed((): string => {
  if (segment.value === 'all') return ''
  return `, ${segmentLabel(segment.value).toLowerCase()}`
})

const canSend = computed((): boolean => {
  if (sending.value) return false
  if (title.value.trim().length === 0) return false
  if (body.value.trim().length === 0) return false
  return true
})

async function loadTargets(): Promise<void> {
  targetsLoading.value = true
  targetsError.value = ''
  try {
    const token = await authStore.getAccessToken()
    const data = await api.admin.push.targets(token, segment.value)
    targetCount.value = data.count
  } catch (err) {
    targetsError.value = err instanceof Error ? err.message : 'Hiba történt'
  } finally {
    targetsLoading.value = false
  }
}

async function loadSettings(): Promise<void> {
  settingsLoading.value = true
  settingsError.value = ''
  try {
    const token = await authStore.getAccessToken()
    const data = await api.admin.push.getSettings(token)
    kickoffReminderEnabled.value = data.kickoffReminderEnabled
    dailyReviewEnabled.value = data.dailyReviewEnabled
  } catch (err) {
    settingsError.value = err instanceof Error ? err.message : 'Hiba történt'
  } finally {
    settingsLoading.value = false
  }
}

async function saveSettings(): Promise<void> {
  settingsSaving.value = true
  settingsError.value = ''
  try {
    const token = await authStore.getAccessToken()
    const data = await api.admin.push.updateSettings(token, {
      kickoffReminderEnabled: kickoffReminderEnabled.value,
      dailyReviewEnabled: dailyReviewEnabled.value,
    })
    kickoffReminderEnabled.value = data.kickoffReminderEnabled
    dailyReviewEnabled.value = data.dailyReviewEnabled
    settingsSavedAt.value = Date.now()
    setTimeout(() => { settingsSavedAt.value = null }, 2000)
  } catch (err) {
    settingsError.value = err instanceof Error ? err.message : 'Hiba történt'
  } finally {
    settingsSaving.value = false
  }
}

watch(segment, () => {
  void loadTargets()
  if (targetsModalOpen.value) {
    void loadTargetsModal()
  }
})

async function loadTargetsModal(): Promise<void> {
  targetsModalLoading.value = true
  targetsModalError.value = ''
  targetsModalTruncated.value = false
  try {
    const token = await authStore.getAccessToken()
    const data = await api.admin.push.targetsDetails(token, segment.value)
    targetsModalUsers.value = data.users
    targetsModalTruncated.value = data.users.length === 500 && targetCount.value > 500
  } catch (err) {
    targetsModalError.value = err instanceof Error ? err.message : 'Hiba történt'
  } finally {
    targetsModalLoading.value = false
  }
}

function openTargetsModal(): void {
  targetsModalOpen.value = true
  void loadTargetsModal()
}

function closeTargetsModal(): void {
  targetsModalOpen.value = false
  targetsModalUsers.value = []
  targetsModalError.value = ''
}

function onEscapeKey(e: KeyboardEvent): void {
  if (e.key === 'Escape' && targetsModalOpen.value) closeTargetsModal()
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onEscapeKey)
})

async function confirmAndSend(): Promise<void> {
  if (!canSend.value) return
  const ok = window.confirm(
    `Biztosan elküldöd ezt az üzenetet ${targetCount.value} felhasználónak (${segmentLabel(segment.value)})?\n\nCím: ${title.value.trim()}\nÜzenet: ${body.value.trim()}`,
  )
  if (!ok) return
  await send()
}

async function send(): Promise<void> {
  sending.value = true
  sendError.value = ''
  lastResult.value = null
  try {
    const token = await authStore.getAccessToken()
    const trimmedUrl = url.value.trim()
    const sentSegment = segment.value
    const result = await api.admin.push.send(token, {
      title: title.value.trim(),
      body: body.value.trim(),
      ...(trimmedUrl.length > 0 ? { url: trimmedUrl } : {}),
      bypassQuietHours: bypassQuietHours.value,
      bypassRateLimit: bypassRateLimit.value,
      segment: sentSegment,
    })
    lastResult.value = { ...result, segment: sentSegment }
    title.value = ''
    body.value = ''
    url.value = ''
    bypassQuietHours.value = false
    bypassRateLimit.value = false
    await loadTargets()
  } catch (err) {
    sendError.value = err instanceof Error ? err.message : 'Hiba történt'
  } finally {
    sending.value = false
  }
}

onMounted(async () => {
  window.addEventListener('keydown', onEscapeKey)
  await Promise.all([loadTargets(), loadSettings()])
})
</script>
