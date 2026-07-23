export interface UseScoringRulesConfigReturn {
  readonly isScoringRulesEnabled: boolean
}

export function useScoringRulesConfig(): UseScoringRulesConfigReturn {
  const envValue = import.meta.env.VITE_SCORING_RULES_ENABLED as string | undefined
  const isScoringRulesEnabled = envValue === 'true'
  return { isScoringRulesEnabled }
}
