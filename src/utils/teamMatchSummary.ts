import { Tables } from '@/integrations/supabase/types'
import { normalizeMatchStatus, type NormalizedMatchStatus } from '@/utils/matchStatus'

export type TeamMatchSummaryEntry = {
  matchId: string
  opponentId: string | null
  opponentName: string
  phase: string | null
  round: string | null
  label: string | null
  scheduledAt: string | null
  court: string | null
  status: NormalizedMatchStatus | null
  statusLabel: string
  outcome: 'win' | 'loss' | 'pending'
  resultLabel: string
  setsWonTeam: number
  setsWonOpponent: number
  sets: { label: string; teamPoints: number; opponentPoints: number }[]
}

type MatchRecord = Tables<'matches'>
type MatchScoreRecord = Tables<'match_scores'>

type MatchLike = MatchRecord & {
  teamA?: { name?: string | null } | null
  teamB?: { name?: string | null } | null
}

const STATUS_LABELS: Record<NonNullable<NormalizedMatchStatus>, string> = {
  scheduled: 'Agendado',
  in_progress: 'Em andamento',
  completed: 'Finalizado',
  canceled: 'Cancelado',
}

const getStatusLabel = (status: NormalizedMatchStatus | null) => {
  if (!status) return 'Status indefinido'
  return STATUS_LABELS[status] ?? 'Status indefinido'
}

const getTeamName = (
  teamId: string | null | undefined,
  teamNameMap: Map<string, string>,
  fallbackTeam?: { name?: string | null } | null,
) => {
  if (!teamId) return fallbackTeam?.name ?? 'Equipe'
  return teamNameMap.get(teamId) ?? fallbackTeam?.name ?? 'Equipe'
}

const getScoresForMatch = (scoresByMatch: Map<string, MatchScoreRecord[]>, matchId: string) => {
  return scoresByMatch.get(matchId) ?? []
}

export const buildTeamMatchSummaryMap = (
  matches: MatchLike[],
  scoresByMatch: Map<string, MatchScoreRecord[]>,
  teamNameMap: Map<string, string>,
): Map<string, TeamMatchSummaryEntry[]> => {
  const map = new Map<string, TeamMatchSummaryEntry[]>()

  matches.forEach((match) => {
    const teamAId = match.team_a_id
    const teamBId = match.team_b_id

    if (!teamAId && !teamBId) {
      return
    }

    const normalizedStatus = normalizeMatchStatus(match.status)
    const statusLabel = getStatusLabel(normalizedStatus)
    const recordedScores = getScoresForMatch(scoresByMatch, match.id)
    const sortedScores = [...recordedScores].sort((a, b) => a.set_number - b.set_number)

    let setsWonA = 0
    let setsWonB = 0

    sortedScores.forEach((score) => {
      if (score.team_a_points > score.team_b_points) {
        setsWonA += 1
      } else if (score.team_b_points > score.team_a_points) {
        setsWonB += 1
      }
    })

    const buildEntry = (isTeamA: boolean) => {
      const teamId = isTeamA ? teamAId : teamBId
      if (!teamId) return null

      if (!map.has(teamId)) {
        map.set(teamId, [])
      }

      const opponentId = isTeamA ? teamBId : teamAId
      const opponent = isTeamA ? match.teamB : match.teamA
      const opponentName = getTeamName(opponentId, teamNameMap, opponent)

      const teamSetsWon = isTeamA ? setsWonA : setsWonB
      const opponentSetsWon = isTeamA ? setsWonB : setsWonA

      const sets = sortedScores.map((score) => {
        const teamPoints = isTeamA ? score.team_a_points : score.team_b_points
        const opponentPoints = isTeamA ? score.team_b_points : score.team_a_points
        return {
          teamPoints,
          opponentPoints,
          label: `${teamPoints}x${opponentPoints}`,
        }
      })

      let outcome: 'win' | 'loss' | 'pending' = 'pending'
      let resultLabel = statusLabel

      if (normalizedStatus === 'completed' && sortedScores.length > 0) {
        if (teamSetsWon > opponentSetsWon) {
          outcome = 'win'
        } else if (teamSetsWon < opponentSetsWon) {
          outcome = 'loss'
        }
        resultLabel = `${teamSetsWon} x ${opponentSetsWon}`
      } else if (normalizedStatus === 'in_progress' && sortedScores.length > 0) {
        resultLabel = `${teamSetsWon} x ${opponentSetsWon}`
      }

      map.get(teamId)!.push({
        matchId: match.id,
        opponentId,
        opponentName,
        phase: match.phase ?? null,
        round: match.round ?? null,
        label: match.label ?? null,
        scheduledAt: match.scheduled_at ?? null,
        court: match.court ?? null,
        status: normalizedStatus,
        statusLabel,
        outcome,
        resultLabel,
        setsWonTeam: teamSetsWon,
        setsWonOpponent: opponentSetsWon,
        sets,
      })

      return null
    }

    if (teamAId) {
      buildEntry(true)
    }

    if (teamBId) {
      buildEntry(false)
    }
  })

  map.forEach((entries) => {
    entries.sort((a, b) => {
      const dateA = a.scheduledAt ? new Date(a.scheduledAt).getTime() : 0
      const dateB = b.scheduledAt ? new Date(b.scheduledAt).getTime() : 0

      if (dateA !== dateB) {
        return dateA - dateB
      }

      return a.matchId.localeCompare(b.matchId)
    })
  })

  return map
}
