import { Tables } from '@/integrations/supabase/types'

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

export function formatMatchScoreLabel(summary: MatchScoreSummary): string {
  if (!summary.hasScores) return ''
  const main = `${summary.setsWonA} × ${summary.setsWonB}`
  if (!summary.setDetails.length) return main
  return `${main} (${summary.setDetails.join(' · ')})`
}
