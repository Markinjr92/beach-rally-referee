/**
 * Fases padronizadas de torneio — suporta desde fase de grupos até 32 avos.
 * Usar estas constantes em definições, UI e banco.
 */
export const BracketPhase = {
  GROUPS: 'Fase de Grupos',
  ROUND_32: '32 avos de final',
  ROUND_16: 'Oitavas de final',
  ROUND_8: 'Quartas de final',
  /** Alias legado usado em vários formatos */
  QUARTERFINALS: 'Quartas de final',
  SEMIFINALS: 'Semifinal',
  REPECHAGE: 'Repescagem',
  THIRD_PLACE: 'Disputa 3º lugar',
  FINAL: 'Final',
  FINALS: 'Finais',
  FIRST_ROUND: 'Primeira Rodada',
  WINNERS_R1: 'Chave de Vencedores - R1',
  WINNERS_R2: 'Chave de Vencedores - R2',
  SERIES_GOLD: 'Série Ouro',
  SERIES_SILVER: 'Série Prata',
  FINAL_GOLD: 'Final Ouro',
  FINAL_SILVER: 'Final Prata',
  THIRD_GOLD: 'Disputa 3º lugar Ouro',
  THIRD_SILVER: 'Disputa 3º lugar Prata',
} as const;

export type BracketPhaseName = (typeof BracketPhase)[keyof typeof BracketPhase];

export const KNOCKOUT_PHASE_ORDER: string[] = [
  BracketPhase.GROUPS,
  BracketPhase.FIRST_ROUND,
  BracketPhase.WINNERS_R1,
  BracketPhase.WINNERS_R2,
  BracketPhase.ROUND_32,
  BracketPhase.ROUND_16,
  BracketPhase.REPECHAGE,
  BracketPhase.QUARTERFINALS,
  BracketPhase.SEMIFINALS,
  BracketPhase.SERIES_GOLD,
  BracketPhase.SERIES_SILVER,
  BracketPhase.THIRD_GOLD,
  BracketPhase.THIRD_SILVER,
  BracketPhase.THIRD_PLACE,
  BracketPhase.FINALS,
  BracketPhase.FINAL_GOLD,
  BracketPhase.FINAL_SILVER,
  BracketPhase.FINAL,
];

export const phaseFormatKeyMap: Record<
  string,
  'groups' | 'quarterfinals' | 'semifinals' | 'final' | 'thirdPlace'
> = {
  'fase de grupos': 'groups',
  'primeira rodada': 'groups',
  '32 avos de final': 'quarterfinals',
  'oitavas de final': 'quarterfinals',
  'quartas de final': 'quarterfinals',
  semifinal: 'semifinals',
  semifinais: 'semifinals',
  repescagem: 'quarterfinals',
  'chave de vencedores - r1': 'groups',
  'chave de vencedores - r2': 'quarterfinals',
  'série ouro': 'semifinals',
  'série prata': 'semifinals',
  final: 'final',
  'final ouro': 'final',
  'final prata': 'final',
  finais: 'final',
  'disputa 3º lugar': 'thirdPlace',
  '3º lugar': 'thirdPlace',
  '3º lugar ouro': 'thirdPlace',
  '3º lugar prata': 'thirdPlace',
};

export const normalizePhaseName = (value: string) => value.trim().toLowerCase();

const singularize = (value: string) => {
  if (value.endsWith('ais') && value.length > 3) return `${value.slice(0, -3)}al`;
  if (value.endsWith('is') && value.length > 2) return value.slice(0, -1);
  return value;
};

export const phasesMatch = (a: string, b: string) => {
  const na = normalizePhaseName(a);
  const nb = normalizePhaseName(b);
  return na === nb || singularize(na) === singularize(nb);
};
