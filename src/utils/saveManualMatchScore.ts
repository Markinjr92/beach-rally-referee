import { supabase } from '@/integrations/supabase/client'
import { Tables } from '@/integrations/supabase/types'
import { mapScoreRowsToGameState } from '@/lib/matchState'
import { saveMatchState } from '@/lib/matchStateService'
import { onMatchCompleted } from '@/lib/tournament/phaseAdvancement'
import type { Game } from '@/types/volleyball'

export type ManualSetScore = {
  setNumber: number
  teamAPoints: number
  teamBPoints: number
}

type MatchRow = Tables<'matches'>

export function buildGameFromMatch(
  match: MatchRow,
  teamAName: string,
  teamBName: string,
): Game {
  const pointsPerSet = Array.isArray(match.points_per_set)
    ? match.points_per_set.map((value) => Number(value))
    : [21, 21, 15]
  const sideSwitchSum = Array.isArray(match.side_switch_sum)
    ? match.side_switch_sum.map((value) => Number(value))
    : [7, 7, 5]
  const bestOf = match.best_of ?? pointsPerSet.length

  return {
    id: match.id,
    tournamentId: match.tournament_id,
    title: `${teamAName} x ${teamBName}`,
    category: 'Misto',
    modality: (match.modality as Game['modality']) || 'dupla',
    format: bestOf === 1 ? 'melhorDe1' : 'melhorDe3',
    teamA: {
      name: teamAName,
      players: [
        { name: 'A', number: 1 },
        { name: 'B', number: 2 },
      ],
    },
    teamB: {
      name: teamBName,
      players: [
        { name: 'A', number: 1 },
        { name: 'B', number: 2 },
      ],
    },
    pointsPerSet,
    needTwoPointLead: true,
    directWinFormat: match.direct_win_format ?? false,
    sideSwitchSum,
    hasTechnicalTimeout: false,
    technicalTimeoutSum: 0,
    teamTimeoutsPerSet: 2,
    teamTimeoutDurationSec: 30,
    coinTossMode: 'initialThenAlternate',
    status: 'finalizado',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

export function validateManualSets(sets: ManualSetScore[], bestOf: number): string | null {
  if (!sets.length) {
    return 'Informe ao menos um set com placar.'
  }

  const setsToWin = Math.ceil(bestOf / 2)
  let wonA = 0
  let wonB = 0

  for (const set of sets) {
    if (!Number.isFinite(set.teamAPoints) || !Number.isFinite(set.teamBPoints)) {
      return `Set ${set.setNumber}: informe pontuação válida.`
    }
    if (set.teamAPoints < 0 || set.teamBPoints < 0) {
      return `Set ${set.setNumber}: pontos não podem ser negativos.`
    }
    if (set.teamAPoints === set.teamBPoints) {
      return `Set ${set.setNumber}: não pode terminar empatado.`
    }

    if (set.teamAPoints > set.teamBPoints) {
      wonA += 1
    } else {
      wonB += 1
    }

    if (wonA > setsToWin || wonB > setsToWin) {
      return `Set ${set.setNumber}: a partida já deveria ter terminado antes deste set.`
    }
  }

  if (wonA < setsToWin && wonB < setsToWin) {
    return `O vencedor precisa ganhar ${setsToWin} set${setsToWin > 1 ? 's' : ''}.`
  }

  return null
}

export async function saveManualMatchScore(
  match: MatchRow,
  teamAName: string,
  teamBName: string,
  sets: ManualSetScore[],
): Promise<{ success: true } | { success: false; error: string }> {
  const bestOf = match.best_of ?? 3
  const validationError = validateManualSets(sets, bestOf)
  if (validationError) {
    return { success: false, error: validationError }
  }

  const scoreRows = sets.map((set) => ({
    match_id: match.id,
    set_number: set.setNumber,
    team_a_points: set.teamAPoints,
    team_b_points: set.teamBPoints,
  }))

  const game = buildGameFromMatch(match, teamAName, teamBName)
  const state = mapScoreRowsToGameState(scoreRows, game)
  state.isGameEnded = true

  try {
    await saveMatchState(state)

    const { error: statusError } = await supabase
      .from('matches')
      .update({ status: 'completed' })
      .eq('id', match.id)

    if (statusError) {
      return { success: false, error: statusError.message }
    }

    void onMatchCompleted(match.tournament_id)

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao salvar placar'
    return { success: false, error: message }
  }
}

export async function clearManualMatchScore(
  matchId: string,
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    await supabase.from('match_scores').delete().eq('match_id', matchId)
    await supabase.from('match_states').delete().eq('match_id', matchId)

    const { error } = await supabase
      .from('matches')
      .update({ status: 'scheduled' })
      .eq('id', matchId)

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro ao limpar placar'
    return { success: false, error: message }
  }
}
