export interface DeadlineInfo {
  readonly label: string
  readonly cssClass: string
}

type TranslateFn = (key: string, params?: Record<string, unknown>) => string

export function formatRelativeDeadline(
  deadline: string | null | undefined,
  now: number,
  t?: TranslateFn,
): DeadlineInfo | null {
  if (deadline === null || deadline === undefined || deadline === '') return null
  const deadlineMs = new Date(deadline).getTime()
  if (Number.isNaN(deadlineMs)) return null
  const diffMs = deadlineMs - now

  if (diffMs <= 0) {
    return { label: t ? t('deadline.closed') : 'Lezárva', cssClass: 'text-gray-400' }
  }

  const diffMinutes = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMs < 2 * 3_600_000) {
    return {
      label: t ? t('deadline.minutesLeft', { n: diffMinutes }) : `${diffMinutes} perc múlva`,
      cssClass: 'text-red-600 font-semibold animate-pulse',
    }
  }

  if (diffMs < 48 * 3_600_000) {
    return {
      label: t ? t('deadline.hoursLeft', { n: diffHours }) : `${diffHours} óra múlva`,
      cssClass: 'text-amber-600 font-medium',
    }
  }

  return {
    label: t ? t('deadline.daysLeft', { n: diffDays }) : `${diffDays} nap múlva`,
    cssClass: 'text-gray-500',
  }
}
