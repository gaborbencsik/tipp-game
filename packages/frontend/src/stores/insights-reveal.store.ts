import { defineStore } from 'pinia'
import { ref } from 'vue'
import { api } from '../api/index.js'

export const useInsightsRevealStore = defineStore('insights-reveal', () => {
  const revealedByMatchId = ref<Record<string, boolean>>({})

  function isRevealed(matchId: string): boolean {
    return revealedByMatchId.value[matchId] === true
  }

  function setRevealed(matchId: string, value: boolean): void {
    revealedByMatchId.value = { ...revealedByMatchId.value, [matchId]: value }
  }

  async function reveal(token: string, matchId: string): Promise<void> {
    await api.matches.revealInsight(token, matchId)
    setRevealed(matchId, true)
  }

  return { isRevealed, setRevealed, reveal }
})
