import { Tables } from '@/integrations/supabase/types'
import type { GameState } from '@/types/volleyball'

type MatchScore = Tables<'match_scores'>

export type MatchScoreSummary = {
  setsWonA: number
  setsWonB: number
  setDetails: string[]
  hasScores: boolean
  winnerSide: 'A' | 'B' | null
}

export function summarizeMatchScores(scores: MatchScore[]): MatchScoreSummary {
  if (!scores.length) {
    return { setsWonA: 0, setsWonB: 0, setDetails: [], hasScores: false, winnerSide: null }
  }

  let setsWonA = 0
  let setsWonB = 0
  const setDetails: string[] = []

  scores
    .slice()
    .sort((a, b) => a.set_number - b.set_number)
    .forEach((setScore) => {
      if (setScore.team_a_points > setScore.team_b_points) {
        setsWonA += 1
      } else if (setScore.team_b_points > setScore.team_a_points) {
        setsWonB += 1
      }
      setDetails.push(`${setScore.team_a_points}-${setScore.team_b_points}`)
    })

  const winnerSide = setsWonA > setsWonB ? 'A' : setsWonB > setsWonA ? 'B' : null

  return { setsWonA, setsWonB, setDetails, hasScores: true, winnerSide }
}

/** Usa match_scores e, se vazio, o estado salvo da mesa (match_states). */
export function getMatchScoreSummary(
  recordedScores: MatchScore[],
  matchState?: GameState | null,
): MatchScoreSummary {
  if (recordedScores.length > 0) {
    return summarizeMatchScores(recordedScores)
  }

  if (!matchState) {
    return { setsWonA: 0, setsWonB: 0, setDetails: [], hasScores: false, winnerSide: null }
  }

  const setDetails = matchState.scores.teamA
    .map((pointsA, index) => {
      const pointsB = matchState.scores.teamB[index] ?? 0
      if (pointsA === 0 && pointsB === 0) return null
      return `${pointsA}-${pointsB}`
    })
    .filter((detail): detail is string => detail !== null)

  const setsWonA = matchState.setsWon.teamA
  const setsWonB = matchState.setsWon.teamB
  const hasScores = setDetails.length > 0 || setsWonA + setsWonB > 0
  const winnerSide = setsWonA > setsWonB ? 'A' : setsWonB > setsWonA ? 'B' : null

  return { setsWonA, setsWonB, setDetails, hasScores, winnerSide }
}

export function formatMatchScoreLabel(summary: MatchScoreSummary): string {
  if (!summary.hasScores) return ''
  const main = `${summary.setsWonA} × ${summary.setsWonB}`
  if (!summary.setDetails.length) return main
  return `${main} (${summary.setDetails.join(' · ')})`
}
