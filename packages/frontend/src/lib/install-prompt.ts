import { ref } from 'vue'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
}

export const installPromptEvent = ref<BeforeInstallPromptEvent | null>(null)
export const isStandalone = ref<boolean>(false)

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault()
    installPromptEvent.value = e as BeforeInstallPromptEvent
  })
  window.addEventListener('appinstalled', () => {
    installPromptEvent.value = null
    isStandalone.value = true
  })
  isStandalone.value = window.matchMedia?.('(display-mode: standalone)').matches
    || (navigator as Navigator & { standalone?: boolean }).standalone === true
}

export async function triggerInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const e = installPromptEvent.value
  if (!e) return 'unavailable'
  await e.prompt()
  const { outcome } = await e.userChoice
  installPromptEvent.value = null
  return outcome
}
