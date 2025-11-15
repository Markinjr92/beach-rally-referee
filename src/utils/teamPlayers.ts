import type { Player } from '@/types/volleyball'

type TeamRecord = {
  player_a: string
  player_b: string
  player_c?: string | null
  player_d?: string | null
}

/**
 * Constrói array de jogadores baseado na modalidade do torneio
 * @param team - Registro do time do banco de dados
 * @param modality - Modalidade do torneio ('dupla' ou 'quarteto')
 * @returns Array de jogadores com números 1-2 (dupla) ou 1-4 (quarteto)
 * @description Para quarteto, usa placeholders se player_c ou player_d não estiverem disponíveis
 */
export function buildPlayersFromTeam(
  team: TeamRecord,
  modality: 'dupla' | 'quarteto',
): Player[] {
  if (modality === 'quarteto') {
    return [
      { name: team.player_a, number: 1 },
      { name: team.player_b, number: 2 },
      { name: team.player_c || 'Jogador 3', number: 3 },
      { name: team.player_d || 'Jogador 4', number: 4 },
    ]
  }
  return [
    { name: team.player_a, number: 1 },
    { name: team.player_b, number: 2 },
  ]
}

/**
 * Valida se os jogadores obrigatórios estão preenchidos para a modalidade
 * @param team - Registro do time do banco de dados
 * @param modality - Modalidade do torneio ('dupla' ou 'quarteto')
 * @returns true se válido, false caso contrário
 */
export function validateTeamPlayers(
  team: TeamRecord,
  modality: 'dupla' | 'quarteto',
): boolean {
  if (modality === 'quarteto') {
    return !!(team.player_c && team.player_d)
  }
  return true
}
