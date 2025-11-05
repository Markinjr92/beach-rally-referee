import { Tables } from '@/integrations/supabase/types'
import { GameState } from '@/types/volleyball'
import { isMatchCompleted } from './matchStatus'

export type StandingsEntry = {
  teamId: string
  teamName: string
  matchesPlayed: number
  wins: number
  losses: number
  setsWon: number
  setsLost: number
  pointsFor: number
  pointsAgainst: number
  matchPoints: number
}

export type GroupAssignment = {
  key: string
  label: string
  teamIds: string[]
}

export type GroupStanding = {
  key: string
  label: string
  standings: StandingsEntry[]
  hasResults: boolean
}

type Team = Tables<'teams'>
type Match = Tables<'matches'>
type MatchScore = Tables<'match_scores'>

const DEFAULT_GROUP_KEY = '__default__'

const getScoresForMatch = (
  source: Map<string, MatchScore[]> | Record<string, MatchScore[]> | undefined,
  matchId: string,
): MatchScore[] => {
  if (!source) return []
  if (source instanceof Map) {
    return source.get(matchId) ?? []
  }
  return source[matchId] ?? []
}

export const buildGroupAssignments = (
  teams: Team[],
  teamGroups: Record<string, string | null>,
): GroupAssignment[] => {
  if (!teams.length) return []

  const rawGroups = new Map<string, { rawLabel: string | null; teamIds: string[] }>()

  teams.forEach((team) => {
    const rawLabel = teamGroups[team.id] ?? null
    const key = rawLabel ?? DEFAULT_GROUP_KEY
    if (!rawGroups.has(key)) {
      rawGroups.set(key, { rawLabel, teamIds: [] })
    }
    rawGroups.get(key)!.teamIds.push(team.id)
  })

  const multipleGroups = rawGroups.size > 1

  return Array.from(rawGroups.entries()).map(([key, entry]) => ({
    key,
    label: entry.rawLabel ?? (multipleGroups ? 'Grupo Único' : 'Classificação Geral'),
    teamIds: entry.teamIds,
  }))
}

const ensureStandingsEntry = (
  statsMap: Map<string, StandingsEntry>,
  teamId: string,
  teamNameMap: Map<string, string>,
): StandingsEntry => {
  if (!statsMap.has(teamId)) {
    statsMap.set(teamId, {
      teamId,
      teamName: teamNameMap.get(teamId) ?? 'Equipe',
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      setsWon: 0,
      setsLost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      matchPoints: 0,
    })
  }

  const entry = statsMap.get(teamId)!
  if (teamNameMap.has(teamId)) {
    entry.teamName = teamNameMap.get(teamId) ?? entry.teamName
  }
  return entry
}

const sortStandings = (entries: StandingsEntry[]) => {
  return [...entries].sort((a, b) => {
    if (b.matchPoints !== a.matchPoints) {
      return b.matchPoints - a.matchPoints
    }

    const setDiffA = a.setsWon - a.setsLost
    const setDiffB = b.setsWon - b.setsLost
    if (setDiffB !== setDiffA) {
      return setDiffB - setDiffA
    }

    const pointDiffA = a.pointsFor - a.pointsAgainst
    const pointDiffB = b.pointsFor - b.pointsAgainst
    if (pointDiffB !== pointDiffA) {
      return pointDiffB - pointDiffA
    }

    return a.teamName.localeCompare(b.teamName)
  })
}

type StandingsComputationParams = {
  matches: Match[]
  scoresByMatch?: Map<string, MatchScore[]> | Record<string, MatchScore[]>
  matchStates?: Record<string, GameState>
  groupAssignments: GroupAssignment[]
  teamNameMap: Map<string, string>
}

export const computeStandingsByGroup = ({
  matches,
  scoresByMatch,
  matchStates,
  groupAssignments,
  teamNameMap,
}: StandingsComputationParams): GroupStanding[] => {
  if (!groupAssignments.length) return []

  const completedMatches = matches.filter((match) => isMatchCompleted(match.status))

  return groupAssignments.map((group) => {
    const teamSet = new Set(group.teamIds)
    const statsMap = new Map<string, StandingsEntry>()
    let hasResults = false

    group.teamIds.forEach((teamId) => {
      ensureStandingsEntry(statsMap, teamId, teamNameMap)
    })

    completedMatches.forEach((match) => {
      const teamAId = match.team_a_id
      const teamBId = match.team_b_id

      if (!teamAId || !teamBId) return
      if (!teamSet.has(teamAId) || !teamSet.has(teamBId)) return

      const entryA = ensureStandingsEntry(statsMap, teamAId, teamNameMap)
      const entryB = ensureStandingsEntry(statsMap, teamBId, teamNameMap)

      const recordedScores = getScoresForMatch(scoresByMatch, match.id)
      let setsWonA = 0
      let setsWonB = 0
      let pointsA = 0
      let pointsB = 0

      if (recordedScores.length > 0) {
        recordedScores.forEach((score) => {
          pointsA += score.team_a_points
          pointsB += score.team_b_points

          if (score.team_a_points > score.team_b_points) {
            setsWonA += 1
          } else if (score.team_b_points > score.team_a_points) {
            setsWonB += 1
          }
        })
      } else if (matchStates?.[match.id]) {
        const state = matchStates[match.id]
        setsWonA = state.setsWon.teamA
        setsWonB = state.setsWon.teamB

        state.scores.teamA.forEach((value, index) => {
          pointsA += value
          pointsB += state.scores.teamB[index] ?? 0
        })
      }

      if (setsWonA === 0 && setsWonB === 0 && pointsA === 0 && pointsB === 0) {
        return
      }

      hasResults = true

      entryA.matchesPlayed += 1
      entryB.matchesPlayed += 1
      entryA.setsWon += setsWonA
      entryA.setsLost += setsWonB
      entryB.setsWon += setsWonB
      entryB.setsLost += setsWonA
      entryA.pointsFor += pointsA
      entryA.pointsAgainst += pointsB
      entryB.pointsFor += pointsB
      entryB.pointsAgainst += pointsA

      if (setsWonA > setsWonB) {
        entryA.wins += 1
        entryB.losses += 1
        entryA.matchPoints += 2
      } else if (setsWonB > setsWonA) {
        entryB.wins += 1
        entryA.losses += 1
        entryB.matchPoints += 2
      } else {
        entryA.matchPoints += 1
        entryB.matchPoints += 1
      }
    })

    return {
      key: group.key,
      label: group.label,
      standings: sortStandings(Array.from(statsMap.values())),
      hasResults,
    }
  })
}

