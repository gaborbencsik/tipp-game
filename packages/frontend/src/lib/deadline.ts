export interface DeadlineInfo {
  readonly label: string
  readonly cssClass: string
}

export function formatRelativeDeadline(deadline: string, now: number): DeadlineInfo {
  const deadlineMs = new Date(deadline).getTime()
  const diffMs = deadlineMs - now

  if (diffMs <= 0) {
    return { label: 'Lezárva', cssClass: 'text-gray-400' }
  }

  const diffMinutes = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMs / 3_600_000)
  const diffDays = Math.floor(diffMs / 86_400_000)

  if (diffMs < 2 * 3_600_000) {
    return {
      label: `${diffMinutes} perc múlva`,
      cssClass: 'text-red-600 font-semibold animate-pulse',
    }
  }

  if (diffMs < 48 * 3_600_000) {
    return {
      label: `${diffHours} óra múlva`,
      cssClass: 'text-amber-600 font-medium',
    }
  }

  return {
    label: `${diffDays} nap múlva`,
    cssClass: 'text-gray-500',
  }
}
