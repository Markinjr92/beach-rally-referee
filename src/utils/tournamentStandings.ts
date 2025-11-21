import { Tables } from '@/integrations/supabase/types'
import { GameState } from '@/types/volleyball'
import { isMatchCompleted } from './matchStatus'
import { calculateMatchPoints, summarizeSets } from '@/lib/tournament/scoring'

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

  const groups = Array.from(rawGroups.entries()).map(([key, entry]) => ({
    key,
    label: entry.rawLabel ?? (multipleGroups ? 'Grupo Único' : 'Classificação Geral'),
    teamIds: entry.teamIds,
  }))

  return groups.sort((a, b) => a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' }))
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
  isCrossGroupFormat?: boolean // Para formatos com jogos cruzados entre grupos
}

/**
 * Calcula standings para fases eliminatórias (Semifinal, Final, etc.)
 */
export const computeStandingsByPhase = ({
  matches,
  scoresByMatch,
  matchStates,
  teamNameMap,
  phases = ['Semifinal', 'Disputa 3º lugar', 'Final'],
}: {
  matches: Match[]
  scoresByMatch?: Map<string, MatchScore[]> | Record<string, MatchScore[]>
  matchStates?: Record<string, GameState>
  teamNameMap: Map<string, string>
  phases?: string[]
}): GroupStanding[] => {
  const completedMatches = matches.filter((match) => isMatchCompleted(match.status))
  const phaseMatches = completedMatches.filter((match) => match.phase && phases.includes(match.phase))
  
  if (!phaseMatches.length) return []

  const phaseGroups = new Map<string, Set<string>>()
  
  // Agrupar equipes por fase
  phaseMatches.forEach((match) => {
    if (!match.phase || !match.team_a_id || !match.team_b_id) return
    
    if (!phaseGroups.has(match.phase)) {
      phaseGroups.set(match.phase, new Set())
    }
    phaseGroups.get(match.phase)!.add(match.team_a_id)
    phaseGroups.get(match.phase)!.add(match.team_b_id)
  })

  return Array.from(phaseGroups.entries()).map(([phase, teamIds]) => {
    const statsMap = new Map<string, StandingsEntry>()
    let hasResults = false

    // Inicializar entries para todas as equipes da fase
    teamIds.forEach((teamId) => {
      ensureStandingsEntry(statsMap, teamId, teamNameMap)
    })

    // Processar matches desta fase
    phaseMatches
      .filter((match) => match.phase === phase)
      .forEach((match) => {
        const teamAId = match.team_a_id
        const teamBId = match.team_b_id

        if (!teamAId || !teamBId) return

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

        const winner = setsWonA > setsWonB ? 'A' : setsWonB > setsWonA ? 'B' : null

        if (winner) {
          let sets: Array<{ setNumber: number; teamAScore: number; teamBScore: number }> = []

          if (recordedScores.length > 0) {
            sets = recordedScores.map((score, index) => ({
              setNumber: index + 1,
              teamAScore: score.team_a_points,
              teamBScore: score.team_b_points
            }))
          } else if (matchStates?.[match.id]) {
            const state = matchStates[match.id]
            sets = state.scores.teamA.map((scoreA, index) => ({
              setNumber: index + 1,
              teamAScore: scoreA,
              teamBScore: state.scores.teamB[index] ?? 0
            })).filter(set => set.teamAScore > 0 || set.teamBScore > 0)
          }

          if (sets.length > 0) {
            const matchPoints = calculateMatchPoints({ winner, sets })

            if (winner === 'A') {
              entryA.wins += 1
              entryA.matchPoints += matchPoints.teamA
              entryB.losses += 1
              entryB.matchPoints += matchPoints.teamB
            } else {
              entryB.wins += 1
              entryB.matchPoints += matchPoints.teamB
              entryA.losses += 1
              entryA.matchPoints += matchPoints.teamA
            }
          }
        } else {
          entryA.matchPoints += 1
          entryB.matchPoints += 1
        }
      })

    return {
      key: `phase-${phase}`,
      label: phase,
      standings: sortStandings(Array.from(statsMap.values())),
      hasResults,
    }
  })
}

export const computeStandingsByGroup = ({
  matches,
  scoresByMatch,
  matchStates,
  groupAssignments,
  teamNameMap,
  isCrossGroupFormat = false,
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
      
      // Para jogos cruzados: considerar se pelo menos uma equipe está no grupo
      // Para jogos normais: considerar apenas se ambas as equipes estão no grupo
      let shouldProcessA = false
      let shouldProcessB = false
      
      if (isCrossGroupFormat) {
        // Jogos cruzados: considerar apenas as equipes que pertencem a este grupo
        // Mas o jogo só é relevante se pelo menos uma equipe estiver no grupo
        shouldProcessA = teamSet.has(teamAId)
        shouldProcessB = teamSet.has(teamBId)
        if (!shouldProcessA && !shouldProcessB) return
      } else {
        // Jogos normais: considerar apenas se ambas as equipes estão no grupo
        if (!teamSet.has(teamAId) || !teamSet.has(teamBId)) return
        shouldProcessA = true
        shouldProcessB = true
      }

      // Apenas processar equipes que pertencem a este grupo
      const entryA = shouldProcessA ? ensureStandingsEntry(statsMap, teamAId, teamNameMap) : null
      const entryB = shouldProcessB ? ensureStandingsEntry(statsMap, teamBId, teamNameMap) : null
      
      if (!entryA && !entryB) return

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

      // Apenas atualizar estatísticas das equipes que pertencem a este grupo
      if (entryA) {
        entryA.matchesPlayed += 1
        entryA.setsWon += setsWonA
        entryA.setsLost += setsWonB
        entryA.pointsFor += pointsA
        entryA.pointsAgainst += pointsB
      }
      
      if (entryB) {
        entryB.matchesPlayed += 1
        entryB.setsWon += setsWonB
        entryB.setsLost += setsWonA
        entryB.pointsFor += pointsB
        entryB.pointsAgainst += pointsA
      }

      // Calculate match points using the official scoring system
      const winner = setsWonA > setsWonB ? 'A' : setsWonB > setsWonA ? 'B' : null
      
      if (winner) {
        // Build sets array for scoring calculation
        let sets: Array<{ setNumber: number; teamAScore: number; teamBScore: number }> = []
        
        if (recordedScores.length > 0) {
          sets = recordedScores.map((score, index) => ({
            setNumber: index + 1,
            teamAScore: score.team_a_points,
            teamBScore: score.team_b_points
          }))
        } else if (matchStates?.[match.id]) {
          const state = matchStates[match.id]
          sets = state.scores.teamA.map((scoreA, index) => ({
            setNumber: index + 1,
            teamAScore: scoreA,
            teamBScore: state.scores.teamB[index] ?? 0
          })).filter(set => set.teamAScore > 0 || set.teamBScore > 0)
        }

        // Use official scoring system only if we have sets data
        if (sets.length > 0) {
          const matchPoints = calculateMatchPoints({ winner, sets })
          
          if (winner === 'A') {
            if (entryA) {
              entryA.wins += 1
              entryA.matchPoints += matchPoints.teamA
            }
            if (entryB) {
              entryB.losses += 1
              entryB.matchPoints += matchPoints.teamB
            }
          } else {
            if (entryB) {
              entryB.wins += 1
              entryB.matchPoints += matchPoints.teamB
            }
            if (entryA) {
              entryA.losses += 1
              entryA.matchPoints += matchPoints.teamA
            }
          }
        }
      } else {
        // Draw (shouldn't happen in volleyball, but handle it)
        if (entryA) entryA.matchPoints += 1
        if (entryB) entryB.matchPoints += 1
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

