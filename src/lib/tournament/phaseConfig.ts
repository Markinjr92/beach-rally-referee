import { TournamentFormatId } from '@/types/volleyball'

export const phaseSequences: Partial<Record<TournamentFormatId, string[]>> = {
  groups_and_knockout: ['Fase de Grupos', 'Quartas de final', 'Semifinal', 'Final'],
  '3_groups_quarterfinals': ['Fase de Grupos', 'Quartas de final', 'Semifinal', 'Final'],
  '2_groups_5_quarterfinals': ['Fase de Grupos', 'Quartas de final', 'Semifinal', 'Final'],
  '2_groups_6_cross_semis': ['Fase de Grupos', 'Semifinal', 'Final'],
  '2_groups_3_cross_semis': ['Fase de Grupos', 'Semifinal', 'Final'],
  global_semis: ['Fase de Grupos', 'Semifinal', 'Final'],
  series_gold_silver: ['Fase de Grupos', 'Série Ouro', 'Série Prata'],
  single_elimination: ['Primeira Rodada', 'Quartas de final', 'Semifinal', 'Final'],
  double_elimination: ['Chave de Vencedores - R1', 'Chave de Vencedores - R2', 'Semifinal', 'Final'],
}

export const normalizePhaseName = (value: string) => value.trim().toLowerCase()

export const getNextPhaseLabel = (
  formatId: TournamentFormatId | null | undefined,
  currentPhase?: string,
): string | null => {
  if (!formatId || !currentPhase) return null
  const sequence = phaseSequences[formatId]
  if (!sequence || !sequence.length) return null
  const index = sequence.findIndex((phase) => normalizePhaseName(phase) === normalizePhaseName(currentPhase))
  if (index === -1 || index >= sequence.length - 1) return null
  return sequence[index + 1]
}

export const phaseFormatKeyMap: Record<string, 'groups' | 'quarterfinals' | 'semifinals' | 'final' | 'thirdPlace'> = {
  'fase de grupos': 'groups',
  'quartas de final': 'quarterfinals',
  'semifinal': 'semifinals',
  'semifinais': 'semifinals',
  final: 'final',
  'final ouro': 'final',
  'final prata': 'final',
  'disputa 3º lugar': 'thirdPlace',
  '3º lugar': 'thirdPlace',
  '3º lugar ouro': 'thirdPlace',
  '3º lugar prata': 'thirdPlace',
  'série ouro': 'semifinals',
  'série prata': 'semifinals',
  'primeira rodada': 'groups',
}
